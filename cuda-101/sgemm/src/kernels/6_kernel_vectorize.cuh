// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/6_kernel_vectorize.cuh

#pragma once

#include <cassert>
#include <cuda_runtime.h>

// Kernel 6 keeps kernel 5's 2D register tile, but vectorizes memory traffic.
//
// Each thread still computes an 8x8 C patch. The difference is that global
// memory movement uses float4 loads/stores:
//   A: load four adjacent K values, then transpose them into shared memory
//   B: load four adjacent N values directly into shared memory
//   C: load/store four adjacent output values at a time
//
// Transposing A in shared memory changes the compute-time access from
// As[(row * BK) + dotIdx] to As[(dotIdx * BM) + row]. That keeps the
// vectorized global load while making the later shared-memory read pattern
// match the dot-product loop.
template <const int BM, const int BN, const int BK, const int TM, const int TN>
__global__ void sgemmVectorize(int M, int N, int K, float alpha,
                               const float *A, const float *B, float beta,
                               float *C) {
  const uint cTileRow = blockIdx.y;
  const uint cTileCol = blockIdx.x;

  const uint totalResultsBlocktile = BM * BN;
  const uint numThreadsBlocktile = totalResultsBlocktile / (TM * TN);
  assert(numThreadsBlocktile == blockDim.x);
  (void)numThreadsBlocktile;

  const uint threadCol = threadIdx.x % (BN / TN);
  const uint threadRow = threadIdx.x / (BN / TN);

  __shared__ float As[BM * BK];
  __shared__ float Bs[BK * BN];

  A += cTileRow * BM * K;
  B += cTileCol * BN;
  C += cTileRow * BM * N + cTileCol * BN;

  const uint innerRowA = threadIdx.x / (BK / 4);
  const uint innerColA = threadIdx.x % (BK / 4);
  const uint innerRowB = threadIdx.x / (BN / 4);
  const uint innerColB = threadIdx.x % (BN / 4);

  float threadResults[TM * TN] = {0.0f};
  float regM[TM] = {0.0f};
  float regN[TN] = {0.0f};

  for (uint bkIdx = 0; bkIdx < K; bkIdx += BK) {
    const float4 aLoad =
        reinterpret_cast<const float4 *>(&A[innerRowA * K + innerColA * 4])[0];
    As[(innerColA * 4 + 0) * BM + innerRowA] = aLoad.x;
    As[(innerColA * 4 + 1) * BM + innerRowA] = aLoad.y;
    As[(innerColA * 4 + 2) * BM + innerRowA] = aLoad.z;
    As[(innerColA * 4 + 3) * BM + innerRowA] = aLoad.w;

    reinterpret_cast<float4 *>(&Bs[innerRowB * BN + innerColB * 4])[0] =
        reinterpret_cast<const float4 *>(
            &B[innerRowB * N + innerColB * 4])[0];
    __syncthreads();

    A += BK;
    B += BK * N;

    for (uint dotIdx = 0; dotIdx < BK; ++dotIdx) {
      for (uint i = 0; i < TM; ++i) {
        regM[i] = As[dotIdx * BM + threadRow * TM + i];
      }
      for (uint i = 0; i < TN; ++i) {
        regN[i] = Bs[dotIdx * BN + threadCol * TN + i];
      }
      for (uint resIdxM = 0; resIdxM < TM; ++resIdxM) {
        for (uint resIdxN = 0; resIdxN < TN; ++resIdxN) {
          threadResults[resIdxM * TN + resIdxN] +=
              regM[resIdxM] * regN[resIdxN];
        }
      }
    }
    __syncthreads();
  }

  for (uint resIdxM = 0; resIdxM < TM; ++resIdxM) {
    for (uint resIdxN = 0; resIdxN < TN; resIdxN += 4) {
      float4 cLoad = reinterpret_cast<float4 *>(
          &C[(threadRow * TM + resIdxM) * N + threadCol * TN + resIdxN])[0];
      cLoad.x =
          alpha * threadResults[resIdxM * TN + resIdxN + 0] + beta * cLoad.x;
      cLoad.y =
          alpha * threadResults[resIdxM * TN + resIdxN + 1] + beta * cLoad.y;
      cLoad.z =
          alpha * threadResults[resIdxM * TN + resIdxN + 2] + beta * cLoad.z;
      cLoad.w =
          alpha * threadResults[resIdxM * TN + resIdxN + 3] + beta * cLoad.w;
      reinterpret_cast<float4 *>(
          &C[(threadRow * TM + resIdxM) * N + threadCol * TN + resIdxN])[0] =
          cLoad;
    }
  }
}
