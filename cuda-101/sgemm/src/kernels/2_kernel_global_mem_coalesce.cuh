// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/2_kernel_global_mem_coalesce.cuh

#pragma once

#include <cuda_runtime.h>

// Matrix shapes:
// A is M x K, B is K x N, C is M x N.
//
// Launch shape used by runner.cu:
//   blockDim = (32 * 32)
//   gridDim  = (ceil(M / 32), ceil(N / 32))
//
// At block level, both kernel 1 and kernel 2 compute one 32x32 tile of C:
//   one block -> 32 rows x 32 columns
//
// Kernel 2 uses a 1D block with 1024 threads. Inside block (0, 0):
//   warp 0  -> C[0][0..31]
//   warp 1  -> C[1][0..31]
//   warp 2  -> C[2][0..31]
//   ...
//   warp 31 -> C[31][0..31]
//
// For other blocks, blockIdx shifts the tile:
//   block (1, 0), warp 0 -> C[32][0..31]
//   block (0, 1), warp 0 -> C[0][32..63]
//
// The key difference is how each warp inside that block maps to the tile:
//   kernel 1 warp -> 32 rows x 1 fixed column
//   kernel 2 warp -> 1 row x 32 consecutive columns
//
// Within one kernel 2 warp, when BLOCKSIZE = 32:
//   threadIdx.x: 0    1    2    ... 31
//   row-in-tile: 0    0    0    ... 0
//   col-in-tile: 0    1    2    ... 31
//
// At each K-loop step i, the warp accesses:
//   A[row * K + i]                 -> same address, broadcast/cache-friendly
//   B[i * N + 0..31]               -> consecutive addresses, coalesced load
//   C[row * N + 0..31]             -> consecutive addresses, coalesced store
//
// This horizontal mapping is the main reason kernel 2 improves global memory
// access compared with the naive 2D thread layout.
template <const uint BLOCKSIZE>
__global__ void sgemm_global_mem_coalesce(int M, int N, int K, float alpha,
                                          const float *A, const float *B,
                                          float beta, float *C) {
  const uint row = blockIdx.x * BLOCKSIZE + threadIdx.x / BLOCKSIZE;
  const uint col = blockIdx.y * BLOCKSIZE + threadIdx.x % BLOCKSIZE;

  if (row < M && col < N) {
    float sum = 0.0f;
    for (int i = 0; i < K; ++i) {
      sum += A[row * K + i] * B[i * N + col];
    }

    C[row * N + col] = alpha * sum + beta * C[row * N + col];
  }
}
