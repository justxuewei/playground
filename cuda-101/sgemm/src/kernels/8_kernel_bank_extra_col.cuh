// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/kernels/8_kernel_bank_extra_col.cuh

#pragma once

#include <cassert>
#include <cuda_runtime.h>

// Kernel 8 keeps kernel 6's vectorized global memory movement and 8x8
// register tile, then pads each Bs row in shared memory.
//
// Kernel 6 uses a natural 8x128 Bs tile, so adjacent dot rows start exactly
// 128 floats apart. Since 128 is a multiple of 32 shared-memory banks, the
// bank pattern repeats row by row.
//
// Kernel 8 stores Bs with five extra columns:
//   Bs[dotIdx * (BN + 5) + col]
//
// The values are still read as a logical 8x128 tile, but the physical row
// stride becomes 133 floats. That shifts the bank mapping between dot rows and
// reduces repeated bank conflicts in the regN load.
template <const int BM, const int BN, const int BK, const int TM, const int TN>
__global__ void sgemmResolveBankExtraCol(int M, int N, int K, float alpha,
                                         const float *A, const float *B,
                                         float beta, float *C) {
  const uint cTileRow = blockIdx.y;
  const uint cTileCol = blockIdx.x;

  const uint totalResultsBlocktile = BM * BN;
  const uint numThreadsBlocktile = totalResultsBlocktile / (TM * TN);
  assert(numThreadsBlocktile == blockDim.x);
  (void)numThreadsBlocktile;

  const uint threadCol = threadIdx.x % (BN / TN);
  const uint threadRow = threadIdx.x / (BN / TN);

  constexpr uint extraCols = 5;
  __shared__ float As[BM * BK];
  __shared__ float Bs[BK * (BN + extraCols)];

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

    const float4 bLoad =
        reinterpret_cast<const float4 *>(&B[innerRowB * N + innerColB * 4])[0];
    Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 0] = bLoad.x;
    Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 1] = bLoad.y;
    Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 2] = bLoad.z;
    Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 3] = bLoad.w;
    __syncthreads();

    A += BK;
    B += BK * N;

    for (uint dotIdx = 0; dotIdx < BK; ++dotIdx) {
      for (uint i = 0; i < TM; ++i) {
        regM[i] = As[dotIdx * BM + threadRow * TM + i];
      }
      for (uint i = 0; i < TN; ++i) {
        regN[i] = Bs[dotIdx * (BN + extraCols) + threadCol * TN + i];
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
