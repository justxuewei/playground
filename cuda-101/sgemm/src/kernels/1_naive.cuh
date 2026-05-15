// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/1_naive.cuh

#pragma once

#include <cuda_runtime.h>

// Matrix shapes:
// A is M x K, B is K x N, C is M x N.
//
// Launch shape used by runner.cu:
//   blockDim = (32, 32)
//   gridDim  = (ceil(M / 32), ceil(N / 32))
//
// Each block computes one 32x32 tile of C. blockIdx.x selects the row tile,
// blockIdx.y selects the column tile, and each thread computes one output
// element C[row][col].
//
// For example, with M = N = 128, gridDim = (4, 4):
//   block (0, 0) computes rows  0..31,  cols  0..31
//   block (1, 0) computes rows 32..63,  cols  0..31
//   block (0, 1) computes rows  0..31,  cols 32..63
//
// If M or N is not divisible by 32, extra threads are launched and ignored by
// the bounds check below.
__global__ void sgemm_naive(int M, int N, int K, float alpha, const float *A,
                            const float *B, float beta, float *C) {
  const uint row = blockIdx.x * blockDim.x + threadIdx.x;
  const uint col = blockIdx.y * blockDim.y + threadIdx.y;

  if (row < M && col < N) {
    float sum = 0.0f;
    for (int i = 0; i < K; ++i) {
      sum += A[row * K + i] * B[i * N + col];
    }

    C[row * N + col] = alpha * sum + beta * C[row * N + col];
  }
}
