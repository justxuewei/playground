#include <cstdio>
#include <cuda_runtime.h>

int main() {
  int count;
  cudaGetDeviceCount(&count);
  printf("CUDA devices: %d\n\n", count);

  for (int i = 0; i < count; i++) {
    cudaDeviceProp p;
    cudaGetDeviceProperties(&p, i);

    printf("Device %d: %s\n", i, p.name);
    printf("  Compute capability:        %d.%d\n", p.major, p.minor);
    printf("  SMs:                       %d\n", p.multiProcessorCount);
    printf("  Max threads/SM:            %d\n", p.maxThreadsPerMultiProcessor);
    printf("  Max threads/block:         %d\n", p.maxThreadsPerBlock);
    printf("  Max blocks/SM:             %d\n", p.maxBlocksPerMultiProcessor);
    printf("  Warp size:                 %d\n", p.warpSize);
    printf("  Registers/SM:              %d\n", p.regsPerMultiprocessor);
    printf("  Registers/block:           %d\n", p.regsPerBlock);
    printf("  Shared memory/SM:          %zu bytes\n", p.sharedMemPerMultiprocessor);
    printf("  Shared memory/block:       %zu bytes\n", p.sharedMemPerBlock);
    printf("  L2 cache:                  %d bytes\n", p.l2CacheSize);
    printf("  Global memory:             %zu bytes (%.1f GB)\n",
           p.totalGlobalMem, p.totalGlobalMem / 1e9);
    printf("  Memory bus width:          %d bits\n", p.memoryBusWidth);
    printf("  Memory clock:              %d MHz\n", p.memoryClockRate / 1000);
    printf("  Clock rate:                %d MHz\n", p.clockRate / 1000);
    printf("\n");
  }

  return 0;
}
