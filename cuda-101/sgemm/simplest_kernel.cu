// Adapted from SGEMM_CUDA:
// https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/simplest_kernel.cu

#include <cuda_runtime.h>

#include <iostream>
#include <vector>

// After all 16 threads run, the matrices contain:
//
// A = row indices          B = column indices
// 0 0 0 0                  0 1 2 3
// 1 1 1 1                  0 1 2 3
// 2 2 2 2                  0 1 2 3
// 3 3 3 3                  0 1 2 3
__global__ void kernel(uint *A, uint *B, int row) {
  // Map the 1D thread index to a 2D 4x4 matrix coordinate.
  // x is the row index, y is the column index.
  auto x = threadIdx.x / 4;
  auto y = threadIdx.x % 4;

  // Convert (row, col) to a row-major array index.
  A[x * row + y] = x;
  B[x * row + y] = y;
}

int main(int argc, char **argv) {
  // Host pointers live in CPU memory.
  uint *Xs, *Ys;

  // Device pointers live in GPU memory.
  uint *Xs_d, *Ys_d;

  uint SIZE = 4;

  // Allocate CPU memory for the result arrays.
  Xs = (uint *)malloc(SIZE * SIZE * sizeof(uint));
  Ys = (uint *)malloc(SIZE * SIZE * sizeof(uint));

  // Allocate GPU memory for the arrays that the kernel writes.
  cudaMalloc((void **)&Xs_d, SIZE * SIZE * sizeof(uint));
  cudaMalloc((void **)&Ys_d, SIZE * SIZE * sizeof(uint));

  // This grid has 1*1*1 block (1 block)
  dim3 grid_size(1, 1, 1);
  // One block with 4*4 threads (16 threads)
  dim3 block_size(4 * 4);

  // Kernel launch syntax:
  //   kernel_name<<<grid_size, block_size>>>(arguments...)
  kernel<<<grid_size, block_size>>>(Xs_d, Ys_d, 4);

  // Copy GPU results back to CPU memory so the host can print them.
  cudaMemcpy(Xs, Xs_d, SIZE * SIZE * sizeof(uint), cudaMemcpyDeviceToHost);
  cudaMemcpy(Ys, Ys_d, SIZE * SIZE * sizeof(uint), cudaMemcpyDeviceToHost);

  // Wait for all previously issued GPU work to complete before exiting.
  cudaDeviceSynchronize();

  // Print each matrix element as [row_index|column_index].
  for (int row = 0; row < SIZE; ++row) {
    for (int col = 0; col < SIZE; ++col) {
      std::cout << "[" << Xs[row * SIZE + col] << "|" << Ys[row * SIZE + col]
                << "] ";
    }
    std::cout << "\n";
  }

  // Release GPU memory first, then CPU memory.
  cudaFree(Xs_d);
  cudaFree(Ys_d);
  free(Xs);
  free(Ys);
}
