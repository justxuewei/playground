// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/src/runner.cuh

#pragma once

#include <cublas_v2.h>
#include <cuda_runtime.h>
#include <fstream>

void cudaCheck(cudaError_t error, const char *file, int line);
void CudaDeviceInfo();

void range_init_matrix(float *mat, int N);
void randomize_matrix(float *mat, int N);
void zero_init_matrix(float *mat, int N);
void copy_matrix(const float *src, float *dest, int N);
void print_matrix(const float *A, int M, int N, std::ofstream &fs);
bool verify_matrix(float *mat1, float *mat2, int N);

float get_current_sec();
float cpu_elapsed_time(float &beg, float &end);

void run_kernel(int kernel_num, int m, int n, int k, float alpha, float *A,
                float *B, float beta, float *C, cublasHandle_t handle);
