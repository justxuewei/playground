// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/9_kernel_autotuned.cuh

#pragma once

#include <cassert>
#include <cuda_runtime.h>

constexpr int K9_NUM_THREADS = 256;

// Kernel 9 keeps the vectorized shared-memory loading pattern, then changes
// the per-thread work layout. A block still computes one BM x BN C tile, but
// the block is partitioned into warp-sized subtiles. Each thread accumulates
// several TM x TN result patches across those subtiles.
template <const int BM, const int BN, const int BK, const int TM, const int TN>
__global__ void __launch_bounds__(K9_NUM_THREADS)
    sgemmAutotuned(int M, int N, int K, float alpha, const float *A,
                   const float *B, float beta, float *C) {
  const uint cTileRow = blockIdx.y;
  const uint cTileCol = blockIdx.x;

  constexpr uint WM = TM * 16;
  constexpr uint WN = TN * 16;
  constexpr uint WMITER = (BM + WM - 1) / WM;
  constexpr uint WNITER = (BN + WN - 1) / WN;

  const uint threadCol = threadIdx.x % (WN / TN);
  const uint threadRow = threadIdx.x / (WN / TN);

  __shared__ float As[BM * BK];
  __shared__ float Bs[BK * BN];

  A += cTileRow * BM * K;
  B += cTileCol * BN;
  C += cTileRow * BM * N + cTileCol * BN;

  const uint innerRowA = threadIdx.x / (BK / 4);
  const uint innerColA = threadIdx.x % (BK / 4);
  constexpr uint rowStrideA = (K9_NUM_THREADS * 4) / BK;
  const uint innerRowB = threadIdx.x / (BN / 4);
  const uint innerColB = threadIdx.x % (BN / 4);
  constexpr uint rowStrideB = K9_NUM_THREADS / (BN / 4);

  float threadResults[WMITER * WNITER * TM * TN] = {0.0f};
  float regM[TM] = {0.0f};
  float regN[TN] = {0.0f};

  for (uint bkIdx = 0; bkIdx < K; bkIdx += BK) {
    for (uint offset = 0; offset + rowStrideA <= BM; offset += rowStrideA) {
      const float4 aLoad = reinterpret_cast<const float4 *>(
          &A[(innerRowA + offset) * K + innerColA * 4])[0];
      As[(innerColA * 4 + 0) * BM + innerRowA + offset] = aLoad.x;
      As[(innerColA * 4 + 1) * BM + innerRowA + offset] = aLoad.y;
      As[(innerColA * 4 + 2) * BM + innerRowA + offset] = aLoad.z;
      As[(innerColA * 4 + 3) * BM + innerRowA + offset] = aLoad.w;
    }

    for (uint offset = 0; offset + rowStrideB <= BK; offset += rowStrideB) {
      reinterpret_cast<float4 *>(
          &Bs[(innerRowB + offset) * BN + innerColB * 4])[0] =
          reinterpret_cast<const float4 *>(
              &B[(innerRowB + offset) * N + innerColB * 4])[0];
    }
    __syncthreads();

    for (uint wmIdx = 0; wmIdx < WMITER; ++wmIdx) {
      for (uint wnIdx = 0; wnIdx < WNITER; ++wnIdx) {
        for (uint dotIdx = 0; dotIdx < BK; ++dotIdx) {
          for (uint i = 0; i < TM; ++i) {
            regM[i] = As[dotIdx * BM + wmIdx * WM + threadRow * TM + i];
          }
          for (uint i = 0; i < TN; ++i) {
            regN[i] = Bs[dotIdx * BN + wnIdx * WN + threadCol * TN + i];
          }
          for (uint resIdxM = 0; resIdxM < TM; ++resIdxM) {
            for (uint resIdxN = 0; resIdxN < TN; ++resIdxN) {
              threadResults[(wmIdx * TM + resIdxM) * (WNITER * TN) +
                            wnIdx * TN + resIdxN] +=
                  regM[resIdxM] * regN[resIdxN];
            }
          }
        }
      }
    }
    __syncthreads();

    A += BK;
    B += BK * N;
  }

  for (uint wmIdx = 0; wmIdx < WMITER; ++wmIdx) {
    for (uint wnIdx = 0; wnIdx < WNITER; ++wnIdx) {
      float *cInterim = C + wmIdx * WM * N + wnIdx * WN;
      for (uint resIdxM = 0; resIdxM < TM; ++resIdxM) {
        for (uint resIdxN = 0; resIdxN < TN; resIdxN += 4) {
          float4 cLoad = reinterpret_cast<float4 *>(
              &cInterim[(threadRow * TM + resIdxM) * N + threadCol * TN +
                        resIdxN])[0];
          const uint resultIdx =
              (wmIdx * TM + resIdxM) * (WNITER * TN) + wnIdx * TN + resIdxN;
          cLoad.x = alpha * threadResults[resultIdx + 0] + beta * cLoad.x;
          cLoad.y = alpha * threadResults[resultIdx + 1] + beta * cLoad.y;
          cLoad.z = alpha * threadResults[resultIdx + 2] + beta * cLoad.z;
          cLoad.w = alpha * threadResults[resultIdx + 3] + beta * cLoad.w;
          reinterpret_cast<float4 *>(
              &cInterim[(threadRow * TM + resIdxM) * N + threadCol * TN +
                        resIdxN])[0] = cLoad;
        }
      }
    }
  }
}
