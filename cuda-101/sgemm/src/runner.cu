// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/runner.cu

#include "kernels.cuh"
#include "runner.cuh"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <iomanip>
#include <stdexcept>
#include <sys/time.h>

float get_current_sec() {
  struct timeval time;
  gettimeofday(&time, nullptr);
  return time.tv_sec + 1e-6 * time.tv_usec;
}

float cpu_elapsed_time(float &beg, float &end) { return 1.0e-6 * (end - beg); }

void cudaCheck(cudaError_t error, const char *file, int line) {
  if (error != cudaSuccess) {
    printf("[CUDA ERROR] at file %s:%d:\n%s\n", file, line,
           cudaGetErrorString(error));
    exit(EXIT_FAILURE);
  }
}

void CudaDeviceInfo() {
  int deviceId;
  cudaGetDevice(&deviceId);

  cudaDeviceProp props{};
  cudaGetDeviceProperties(&props, deviceId);

  printf("Device ID: %d\n\
    Name: %s\n\
    Compute Capability: %d.%d\n\
    memoryBusWidth: %d\n\
    maxThreadsPerBlock: %d\n\
    maxThreadsPerMultiProcessor: %d\n\
    maxRegsPerBlock: %d\n\
    maxRegsPerMultiProcessor: %d\n\
    totalGlobalMem: %zuMB\n\
    sharedMemPerBlock: %zuKB\n\
    sharedMemPerMultiprocessor: %zuKB\n\
    totalConstMem: %zuKB\n\
    multiProcessorCount: %d\n\
    Warp Size: %d\n",
         deviceId, props.name, props.major, props.minor, props.memoryBusWidth,
         props.maxThreadsPerBlock, props.maxThreadsPerMultiProcessor,
         props.regsPerBlock, props.regsPerMultiprocessor,
         props.totalGlobalMem / 1024 / 1024, props.sharedMemPerBlock / 1024,
         props.sharedMemPerMultiprocessor / 1024, props.totalConstMem / 1024,
         props.multiProcessorCount, props.warpSize);
}

void randomize_matrix(float *mat, int N) {
  struct timeval time {};
  gettimeofday(&time, nullptr);
  srand(time.tv_usec);
  for (int i = 0; i < N; i++) {
    float tmp = (float)(rand() % 5) + 0.01f * (rand() % 5);
    tmp = (rand() % 2 == 0) ? tmp : tmp * (-1.0f);
    mat[i] = tmp;
  }
}

void range_init_matrix(float *mat, int N) {
  for (int i = 0; i < N; i++) {
    mat[i] = i;
  }
}

void zero_init_matrix(float *mat, int N) {
  for (int i = 0; i < N; i++) {
    mat[i] = 0.0f;
  }
}

void copy_matrix(const float *src, float *dest, int N) {
  int i;
  for (i = 0; src + i && dest + i && i < N; i++) {
    *(dest + i) = *(src + i);
  }
  if (i != N) {
    printf("copy failed at %d while there are %d elements in total.\n", i, N);
  }
}

void print_matrix(const float *A, int M, int N, std::ofstream &fs) {
  fs << std::setprecision(2) << std::fixed;
  fs << "[";
  for (int i = 0; i < M * N; i++) {
    if ((i + 1) % N == 0) {
      fs << std::setw(5) << A[i];
    } else {
      fs << std::setw(5) << A[i] << ", ";
    }
    if ((i + 1) % N == 0 && i + 1 < M * N) {
      fs << ";\n";
    }
  }
  fs << "]\n";
}

bool verify_matrix(float *matRef, float *matOut, int N) {
  for (int i = 0; i < N; i++) {
    double diff = std::fabs(matRef[i] - matOut[i]);
    if (isnan(diff) || diff > 0.01) {
      printf("Divergence! Should %5.2f, Is %5.2f (Diff %5.2f) at %d\n",
             matRef[i], matOut[i], diff, i);
      return false;
    }
  }
  return true;
}

void runCublasFP32(cublasHandle_t handle, int M, int N, int K, float alpha,
                   float *A, float *B, float beta, float *C) {
  // cuBLAS uses column-major storage. Swapping A/B and M/N lets row-major
  // matrices produce the same result as C = alpha * A * B + beta * C.
  cublasGemmEx(handle, CUBLAS_OP_N, CUBLAS_OP_N, N, M, K, &alpha, B,
               CUDA_R_32F, N, A, CUDA_R_32F, K, &beta, C, CUDA_R_32F, N,
               CUBLAS_COMPUTE_32F, CUBLAS_GEMM_DEFAULT_TENSOR_OP);
}

void run_sgemm_naive(int M, int N, int K, float alpha, float *A, float *B,
                     float beta, float *C) {
  dim3 gridDim((M + 31) / 32, (N + 31) / 32);
  dim3 blockDim(32, 32);
  sgemm_naive<<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_coalesce(int M, int N, int K, float alpha, float *A, float *B,
                        float beta, float *C) {
  dim3 gridDim((M + 31) / 32, (N + 31) / 32);
  dim3 blockDim(32 * 32);
  sgemm_global_mem_coalesce<32>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_shared_mem_block(int M, int N, int K, float alpha, float *A,
                                float *B, float beta, float *C) {
  dim3 gridDim((M + 31) / 32, (N + 31) / 32);
  dim3 blockDim(32 * 32);
  cudaFuncSetAttribute(sgemm_shared_mem_block<32>,
                       cudaFuncAttributePreferredSharedMemoryCarveout,
                       cudaSharedmemCarveoutMaxShared);
  sgemm_shared_mem_block<32>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_1d_blocktiling(int M, int N, int K, float alpha, float *A,
                              float *B, float beta, float *C) {
  const uint BM = 64;
  const uint BN = 64;
  const uint BK = 8;
  const uint TM = 8;
  dim3 gridDim((N + BN - 1) / BN, (M + BM - 1) / BM);
  dim3 blockDim((BM * BN) / TM);
  sgemm1DBlocktiling<BM, BN, BK, TM>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_2d_blocktiling(int M, int N, int K, float alpha, float *A,
                              float *B, float beta, float *C) {
  const uint BK = 8;
  const uint TM = 8;
  const uint TN = 8;
  const uint BM = 128;
  const uint BN = 128;
  dim3 gridDim((N + BN - 1) / BN, (M + BM - 1) / BM);
  dim3 blockDim((BM * BN) / (TM * TN));
  sgemm2DBlocktiling<BM, BN, BK, TM, TN>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_vectorize(int M, int N, int K, float alpha, float *A, float *B,
                         float beta, float *C) {
  const uint BK = 8;
  const uint TM = 8;
  const uint TN = 8;
  const uint BM = 128;
  const uint BN = 128;
  dim3 gridDim((N + BN - 1) / BN, (M + BM - 1) / BM);
  dim3 blockDim((BM * BN) / (TM * TN));
  sgemmVectorize<BM, BN, BK, TM, TN>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_resolve_bank_conflicts(int M, int N, int K, float alpha,
                                      float *A, float *B, float beta,
                                      float *C) {
  const uint BK = 8;
  const uint TM = 8;
  const uint TN = 8;
  const uint BM = 128;
  const uint BN = 128;
  dim3 gridDim((N + BN - 1) / BN, (M + BM - 1) / BM);
  dim3 blockDim((BM * BN) / (TM * TN));
  sgemmResolveBankConflicts<BM, BN, BK, TM, TN>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_resolve_bank_extra_col(int M, int N, int K, float alpha,
                                      float *A, float *B, float beta,
                                      float *C) {
  const uint BK = 8;
  const uint TM = 8;
  const uint TN = 8;
  const uint BM = 128;
  const uint BN = 128;
  dim3 gridDim((N + BN - 1) / BN, (M + BM - 1) / BM);
  dim3 blockDim((BM * BN) / (TM * TN));
  sgemmResolveBankExtraCol<BM, BN, BK, TM, TN>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_sgemm_autotuned(int M, int N, int K, float alpha, float *A, float *B,
                         float beta, float *C) {
  const uint K9_BK = 16;
  const uint K9_TM = 8;
  const uint K9_TN = 8;
  const uint K9_BM = 128;
  const uint K9_BN = 128;

  static_assert((K9_NUM_THREADS * 4) % K9_BK == 0,
                "K9_NUM_THREADS*4 must be a multiple of K9_BK");
  static_assert((K9_NUM_THREADS * 4) % K9_BN == 0,
                "K9_NUM_THREADS*4 must be a multiple of K9_BN");
  static_assert(K9_BN % (16 * K9_TN) == 0,
                "K9_BN must be a multiple of 16*K9_TN");
  static_assert(K9_BM % (16 * K9_TM) == 0,
                "K9_BM must be a multiple of 16*K9_TM");
  static_assert((K9_BM * K9_BK) % (4 * K9_NUM_THREADS) == 0,
                "K9_BM*K9_BK must be a multiple of 4*K9_NUM_THREADS");
  static_assert((K9_BN * K9_BK) % (4 * K9_NUM_THREADS) == 0,
                "K9_BN*K9_BK must be a multiple of 4*K9_NUM_THREADS");

  dim3 gridDim((N + K9_BN - 1) / K9_BN, (M + K9_BM - 1) / K9_BM);
  dim3 blockDim(K9_NUM_THREADS);
  sgemmAutotuned<K9_BM, K9_BN, K9_BK, K9_TM, K9_TN>
      <<<gridDim, blockDim>>>(M, N, K, alpha, A, B, beta, C);
}

void run_kernel(int kernel_num, int M, int N, int K, float alpha, float *A,
                float *B, float beta, float *C, cublasHandle_t handle) {
  switch (kernel_num) {
  case 0:
    runCublasFP32(handle, M, N, K, alpha, A, B, beta, C);
    break;
  case 1:
    run_sgemm_naive(M, N, K, alpha, A, B, beta, C);
    break;
  case 2:
    run_sgemm_coalesce(M, N, K, alpha, A, B, beta, C);
    break;
  case 3:
    run_sgemm_shared_mem_block(M, N, K, alpha, A, B, beta, C);
    break;
  case 4:
    run_sgemm_1d_blocktiling(M, N, K, alpha, A, B, beta, C);
    break;
  case 5:
    run_sgemm_2d_blocktiling(M, N, K, alpha, A, B, beta, C);
    break;
  case 6:
    run_sgemm_vectorize(M, N, K, alpha, A, B, beta, C);
    break;
  case 7:
    run_sgemm_resolve_bank_conflicts(M, N, K, alpha, A, B, beta, C);
    break;
  case 8:
    run_sgemm_resolve_bank_extra_col(M, N, K, alpha, A, B, beta, C);
    break;
  case 9:
    run_sgemm_autotuned(M, N, K, alpha, A, B, beta, C);
    break;
  default:
    throw std::invalid_argument("Unknown kernel number");
  }
}
