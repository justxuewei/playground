// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/sgemm.cu

#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iostream>
#include <runner.cuh>
#include <vector>

#define cudaCheck(err) (cudaCheck(err, __FILE__, __LINE__))

const std::string errLogFile = "matrixValidationFailure.txt";

int main(int argc, char **argv) {
  if (argc != 2) {
    std::cerr << "Please select a kernel: 0 for cuBLAS, 1 for naive SGEMM, "
                 "2 for global-memory coalescing, "
                 "3 for shared-memory blocking, "
                 "4 for 1D block tiling, "
                 "5 for 2D block tiling, "
                 "6 for vectorized memory access, "
                 "7 for resolving shared-memory bank conflicts, "
                 "8 for padding shared-memory B rows, "
                 "9 for autotuned tiling"
              << std::endl;
    exit(EXIT_FAILURE);
  }

  const int kernel_num = std::stoi(argv[1]);
  if (kernel_num < 0 || kernel_num > 9) {
    std::cerr
        << "Please enter a valid kernel number (0, 1, 2, 3, 4, 5, 6, 7, 8, or 9)"
        << std::endl;
    exit(EXIT_FAILURE);
  }

  // DEVICE lets you choose a GPU without recompiling, for example:
  // DEVICE=1 ./sgemm 1
  int deviceIdx = 0;
  if (getenv("DEVICE") != nullptr) {
    deviceIdx = atoi(getenv("DEVICE"));
  }
  cudaCheck(cudaSetDevice(deviceIdx));

  printf("Running kernel %d on device %d.\n", kernel_num, deviceIdx);

  cublasHandle_t handle;
  if (cublasCreate(&handle)) {
    std::cerr << "Create cublas handle error." << std::endl;
    exit(EXIT_FAILURE);
  }

  // CUDA events measure elapsed GPU time around repeated kernel launches.
  float elapsed_time;
  cudaEvent_t beg, end;
  cudaEventCreate(&beg);
  cudaEventCreate(&end);

  // Keep the first harness checkpoint small enough to run quickly.
  std::vector<int> SIZE = {128, 256, 512, 1024, 4092};

  const long max_size = SIZE.back();
  std::cout << "Max size: " << max_size << std::endl;

  // GEMM computes C = alpha * A * B + beta * C.
  float alpha = 0.5;
  float beta = 3.0;

  float *A = nullptr;
  float *B = nullptr;
  float *C = nullptr;
  float *C_ref = nullptr;

  float *dA = nullptr;
  float *dB = nullptr;
  float *dC = nullptr;
  float *dC_ref = nullptr;

  A = (float *)malloc(sizeof(float) * max_size * max_size);
  B = (float *)malloc(sizeof(float) * max_size * max_size);
  C = (float *)malloc(sizeof(float) * max_size * max_size);
  C_ref = (float *)malloc(sizeof(float) * max_size * max_size);

  randomize_matrix(A, max_size * max_size);
  randomize_matrix(B, max_size * max_size);
  randomize_matrix(C, max_size * max_size);

  cudaCheck(cudaMalloc((void **)&dA, sizeof(float) * max_size * max_size));
  cudaCheck(cudaMalloc((void **)&dB, sizeof(float) * max_size * max_size));
  cudaCheck(cudaMalloc((void **)&dC, sizeof(float) * max_size * max_size));
  cudaCheck(cudaMalloc((void **)&dC_ref, sizeof(float) * max_size * max_size));

  cudaCheck(cudaMemcpy(dA, A, sizeof(float) * max_size * max_size,
                       cudaMemcpyHostToDevice));
  cudaCheck(cudaMemcpy(dB, B, sizeof(float) * max_size * max_size,
                       cudaMemcpyHostToDevice));
  cudaCheck(cudaMemcpy(dC, C, sizeof(float) * max_size * max_size,
                       cudaMemcpyHostToDevice));
  cudaCheck(cudaMemcpy(dC_ref, C, sizeof(float) * max_size * max_size,
                       cudaMemcpyHostToDevice));

  int repeat_times = 50;
  for (int size : SIZE) {
    const long m = size;
    const long n = size;
    const long k = size;

    std::cout << "dimensions(m=n=k) " << m << ", alpha: " << alpha
              << ", beta: " << beta << std::endl;

    // Validate custom kernels against cuBLAS before timing them.
    if (kernel_num != 0) {
      // Kernel 0 is the cuBLAS reference implementation.
      // It computes dC_ref = alpha * dA * dB + beta * dC_ref.
      run_kernel(0, m, n, k, alpha, dA, dB, beta, dC_ref, handle);

      // The selected custom kernel writes its result into dC.
      // Later we copy dC and dC_ref back to the CPU and compare them.
      run_kernel(kernel_num, m, n, k, alpha, dA, dB, beta, dC, handle);
      cudaCheck(cudaDeviceSynchronize());
      cudaCheck(cudaGetLastError());

      cudaMemcpy(C, dC, sizeof(float) * m * n, cudaMemcpyDeviceToHost);
      cudaMemcpy(C_ref, dC_ref, sizeof(float) * m * n,
                 cudaMemcpyDeviceToHost);

      if (!verify_matrix(C_ref, C, m * n)) {
        std::cout
            << "Failed to pass correctness verification against cuBLAS."
            << std::endl;
        if (m <= 128) {
          std::cout << "Logging faulty output into " << errLogFile << "\n";
          std::ofstream fs;
          fs.open(errLogFile);
          fs << "A:\n";
          print_matrix(A, m, n, fs);
          fs << "B:\n";
          print_matrix(B, m, n, fs);
          fs << "C:\n";
          print_matrix(C, m, n, fs);
          fs << "Should:\n";
          print_matrix(C_ref, m, n, fs);
        }
        exit(EXIT_FAILURE);
      }
    }

    cudaEventRecord(beg);
    for (int j = 0; j < repeat_times; j++) {
      run_kernel(kernel_num, m, n, k, alpha, dA, dB, beta, dC, handle);
    }
    cudaEventRecord(end);
    cudaEventSynchronize(beg);
    cudaEventSynchronize(end);
    cudaEventElapsedTime(&elapsed_time, beg, end);
    elapsed_time /= 1000.0;

    const long flops = 2 * m * n * k;
    printf("Average elapsed time: (%7.6f) s, performance: (%7.1f) GFLOPS. "
           "size: (%ld).\n",
           elapsed_time / repeat_times,
           (repeat_times * flops * 1e-9) / elapsed_time, m);
    fflush(stdout);

    // Restore dC after timing because repeated GEMM calls update C in-place.
    cudaCheck(cudaMemcpy(dC, dC_ref, sizeof(float) * m * n,
                         cudaMemcpyDeviceToDevice));
  }

  free(A);
  free(B);
  free(C);
  free(C_ref);
  cudaFree(dA);
  cudaFree(dB);
  cudaFree(dC);
  cudaFree(dC_ref);
  cublasDestroy(handle);

  return 0;
}
