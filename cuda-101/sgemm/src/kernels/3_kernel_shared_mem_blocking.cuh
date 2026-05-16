// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/3_kernel_shared_mem_blocking.cuh

#pragma once

#include <cuda_runtime.h>

// Matrix shapes:
// A is M x K, B is K x N, C is M x N.
//
// At block level, this kernel still computes one 32x32 tile of C:
//   one block -> 32 rows x 32 columns
//
// Kernel 2 reads A and B directly from global memory inside the K loop.
// Kernel 3 splits K into 32-column chunks and caches each chunk in shared
// memory first:
//   As -> a 32x32 tile from A
//   Bs -> a 32x32 tile from B
//
// Within block (0, 0), the first K chunk uses:
//   As = A[0..31][0..31]
//   Bs = B[0..31][0..31]
//
// Then the block computes partial dot products from shared memory, advances to
// the next K chunk, and repeats:
//   As = A[0..31][32..63]
//   Bs = B[32..63][0..31]
//
// __syncthreads() is required after loading shared memory so no thread starts
// reading As/Bs before the whole 32x32 tile is ready. It is required again
// before the next loop iteration so no thread overwrites As/Bs while another
// thread is still using the previous tile.
//
// This learning kernel assumes M, N, and K are multiples of BLOCKSIZE. The
// benchmark harness currently uses 128, 256, 512, and 1024, so that condition
// holds for BLOCKSIZE = 32.
template <const int BLOCKSIZE>
__global__ void sgemm_shared_mem_block(int M, int N, int K, float alpha,
                                       const float *A, const float *B,
                                       float beta, float *C) {
  // Each block computes one 32x32 tile of output matrix C.
  //
  // blockIdx.x selects the 32-row tile of C.
  // blockIdx.y selects the 32-column tile of C.
  //
  // With BLOCKSIZE = 32:
  //   block (0, 0) -> C rows  0..31, cols  0..31
  //   block (1, 0) -> C rows 32..63, cols  0..31
  //   block (0, 1) -> C rows  0..31, cols 32..63
  //   block (1, 1) -> C rows 32..63, cols 32..63
  const uint cTileRow = blockIdx.x;
  const uint cTileCol = blockIdx.y;

  __shared__ float As[BLOCKSIZE * BLOCKSIZE];
  __shared__ float Bs[BLOCKSIZE * BLOCKSIZE];

  const uint threadCol = threadIdx.x % BLOCKSIZE;
  const uint threadRow = threadIdx.x / BLOCKSIZE;

  A += cTileRow * BLOCKSIZE * K;
  B += cTileCol * BLOCKSIZE;
  C += cTileRow * BLOCKSIZE * N + cTileCol * BLOCKSIZE;

  float tmp = 0.0f;
  for (int bkIdx = 0; bkIdx < K; bkIdx += BLOCKSIZE) {
    As[threadRow * BLOCKSIZE + threadCol] = A[threadRow * K + threadCol];
    Bs[threadRow * BLOCKSIZE + threadCol] = B[threadRow * N + threadCol];

    __syncthreads();
    A += BLOCKSIZE;
    B += BLOCKSIZE * N;

    for (int dotIdx = 0; dotIdx < BLOCKSIZE; ++dotIdx) {
      tmp += As[threadRow * BLOCKSIZE + dotIdx] *
             Bs[dotIdx * BLOCKSIZE + threadCol];
    }

    __syncthreads();
  }

  C[threadRow * N + threadCol] =
      alpha * tmp + beta * C[threadRow * N + threadCol];
}
