// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/4_kernel_1D_blocktiling.cuh

#pragma once

#include <cassert>
#include <cuda_runtime.h>

// Matrix shapes:
// A is M x K, B is K x N, C is M x N.
//
// Kernel 3:
//   one block computes one 32x32 C tile
//   one thread computes one C element
//
// Kernel 4:
//   one block computes one 64x64 C tile
//   one thread computes 8 C elements in the same output column
//
// With BM = 64, BN = 64, BK = 8, TM = 8:
//   BM -> rows in the C tile
//   BN -> columns in the C tile
//   BK -> K dimension chunk loaded into shared memory per loop
//   TM -> per-thread vertical C results
//
// A block has (BM * BN) / TM = 512 threads.
// Those 512 threads produce BM * BN = 4096 output elements because each thread
// keeps 8 partial sums in registers.
template <const int BM, const int BN, const int BK, const int TM>
__global__ void sgemm1DBlocktiling(int M, int N, int K, float alpha,
                                   const float *A, const float *B, float beta,
                                   float *C) {
  // Kernel 4 uses gridDim.x for C column tiles and gridDim.y for C row tiles.
  //
  // With BM = BN = 64:
  //   block (0, 0) -> C rows  0..63, cols  0..63
  //   block (1, 0) -> C rows  0..63, cols 64..127
  //   block (0, 1) -> C rows 64..127, cols  0..63
  //
  // This orientation keeps neighboring block IDs moving through neighboring
  // columns of B, which improves spatial locality in the cache.
  const uint cTileRow = blockIdx.y;
  const uint cTileCol = blockIdx.x;

  // threadCol selects one of the 64 output columns in the C tile.
  // threadRow selects one vertical group of 8 output rows.
  //
  // Example with threadIdx.x = 66:
  //   threadCol = 66 % 64 = 2
  //   threadRow = 66 / 64 = 1
  //   this thread computes rows 8..15 in column 2 of the tile
  const uint threadCol = threadIdx.x % BN;
  const uint threadRow = threadIdx.x / BN;

  __shared__ float As[BM * BK];
  __shared__ float Bs[BK * BN];

  // Move A, B, and C to the first element of this block's tile.
  A += cTileRow * BM * K;
  B += cTileCol * BN;
  C += cTileRow * BM * N + cTileCol * BN;

  // Each block loads a 64x8 tile of A and an 8x64 tile of B.
  // Both tiles contain 512 values, which matches the 512 threads in the block,
  // so each thread copies one A value and one B value per K chunk.
  assert(BM * BK == blockDim.x);
  assert(BN * BK == blockDim.x);
  const uint innerColA = threadIdx.x % BK;
  const uint innerRowA = threadIdx.x / BK;
  const uint innerColB = threadIdx.x % BN;
  const uint innerRowB = threadIdx.x / BN;

  // A thread-local register tile. Each thread owns 8 vertical C elements and
  // accumulates all 8 partial sums before writing C.
  float threadResults[TM] = {0.0f};

  for (uint bkIdx = 0; bkIdx < K; bkIdx += BK) {
    As[innerRowA * BK + innerColA] = A[innerRowA * K + innerColA];
    Bs[innerRowB * BN + innerColB] = B[innerRowB * N + innerColB];
    __syncthreads();

    A += BK;
    B += BK * N;

    for (uint dotIdx = 0; dotIdx < BK; ++dotIdx) {
      // Reuse one B value for all 8 vertical results owned by this thread.
      float tmpB = Bs[dotIdx * BN + threadCol];
      for (uint resIdx = 0; resIdx < TM; ++resIdx) {
        threadResults[resIdx] +=
            As[(threadRow * TM + resIdx) * BK + dotIdx] * tmpB;
      }
    }
    __syncthreads();
  }

  for (uint resIdx = 0; resIdx < TM; ++resIdx) {
    C[(threadRow * TM + resIdx) * N + threadCol] =
        alpha * threadResults[resIdx] +
        beta * C[(threadRow * TM + resIdx) * N + threadCol];
  }
}
