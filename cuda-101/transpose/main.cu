// CUDA headers
#include <cuda_runtime_api.h>
// C++ standard library headers
#include <cmath>
#include <cstdlib>
// C / system headers
#include <stdio.h>

#define TILE_DIM 32
#define BLOCK_ROWS 8

#define CHECK_CUDA(call)                                                     \
	do {                                                                 \
		cudaError_t err = (call);                                    \
		if (err != cudaSuccess) {                                    \
			fprintf(stderr, "%s:%d: CUDA error: %s\n", __FILE__, \
				__LINE__, cudaGetErrorString(err));          \
			std::exit(EXIT_FAILURE);                             \
		}                                                            \
	} while (0)

__global__ void transposeSharedMemory(const float *input, float *output,
				      int width, int height)
{
	__shared__ float tile[TILE_DIM][TILE_DIM + 1];

	/*
	 * Matrix transpose:
	 *
	 *   output[col][row] = input[row][col]
	 *
	 * Example:
	 *
	 *   input matrix A: height x width
	 *
	 *             columns
	 *             0   1   2   3
	 *           +---+---+---+---+
	 *   row 0   | a | b | c | d |
	 *           +---+---+---+---+
	 *   row 1   | e | f | g | h |
	 *           +---+---+---+---+
	 *   row 2   | i | j | k | l |
	 *           +---+---+---+---+
	 *
	 *   output matrix B: width x height
	 *
	 *             columns
	 *             0   1   2
	 *           +---+---+---+
	 *   row 0   | a | e | i |
	 *           +---+---+---+
	 *   row 1   | b | f | j |
	 *           +---+---+---+
	 *   row 2   | c | g | k |
	 *           +---+---+---+
	 *   row 3   | d | h | l |
	 *           +---+---+---+
	 *
	 * Tiled shared-memory flow:
	 *
	 *   1. Read one global input tile by rows.
	 *
	 *      global input A
	 *      +---+---+---+---+
	 *      | a | b | c | d |  -> coalesced row read
	 *      +---+---+---+---+
	 *      | e | f | g | h |  -> coalesced row read
	 *      +---+---+---+---+
	 *      | i | j | k | l |  -> coalesced row read
	 *      +---+---+---+---+
	 *
	 *   2. Store that data in shared memory, then read the shared tile
	 *      with swapped indexes: tile[col][row].
	 *
	 *      shared tile read as:
	 *
	 *      a e i
	 *      b f j
	 *      c g k
	 *      d h l
	 *
	 *   3. Write one global output tile by rows.
	 *
	 *      global output B
	 *      +---+---+---+
	 *      | a | e | i |  -> coalesced row write
	 *      +---+---+---+
	 *      | b | f | j |  -> coalesced row write
	 *      +---+---+---+
	 *      | c | g | k |  -> coalesced row write
	 *      +---+---+---+
	 *      | d | h | l |  -> coalesced row write
	 *      +---+---+---+
	 *
	 * Global memory does row reads and row writes. The column-style
	 * swapped access happens in shared memory, which is much cheaper than
	 * strided global memory access. TILE_DIM + 1 padding reduces shared
	 * memory bank conflicts when reading tile[col][row].
	 */

	int x = blockIdx.x * TILE_DIM + threadIdx.x;
	int y = blockIdx.y * TILE_DIM + threadIdx.y;

	// Global memory -> shared memory: row access
	for (int rowOffset = 0; rowOffset < TILE_DIM; rowOffset += BLOCK_ROWS) {
		int row = y + rowOffset;

		if (x < width && row < height) {
			tile[threadIdx.y + rowOffset][threadIdx.x] =
				input[row * width + x];
		}
	}

	__syncthreads();

	x = blockIdx.y * TILE_DIM + threadIdx.x;
	y = blockIdx.x * TILE_DIM + threadIdx.y;

	// Shared memory -> global memory: row access
	for (int rowOffset = 0; rowOffset < TILE_DIM; rowOffset += BLOCK_ROWS) {
		int row = y + rowOffset;

		if (x < height && row < width) {
			output[row * height + x] =
				tile[threadIdx.x][threadIdx.y + rowOffset];
		}
	}
}

void initMatrix(float *matrix, int width, int height)
{
	for (int row = 0; row < height; row++) {
		for (int col = 0; col < width; col++) {
			matrix[row * width + col] = row * width + col;
		}
	}
}

bool verifyTranspose(const float *input, const float *output, int width,
		     int height, float epsilon = 0.00001)
{
	for (int row = 0; row < height; row++) {
		for (int col = 0; col < width; col++) {
			float expected = input[row * width + col];
			float actual = output[col * height + row];

			if (std::fabs(actual - expected) > epsilon) {
				printf("Mismatch: input[%d][%d] should equal "
				       "output[%d][%d], %f != %f\n",
				       row, col, col, row, expected, actual);
				return false;
			}
		}
	}
	return true;
}

void sharedMemoryTransposeExample(int width, int height)
{
	int matrixSize = width * height;
	size_t matrixBytes = matrixSize * sizeof(float);

	float *input = nullptr;
	float *output = nullptr;

	float *devInput = nullptr;
	float *devOutput = nullptr;

	CHECK_CUDA(cudaMallocHost(&input, matrixBytes));
	CHECK_CUDA(cudaMallocHost(&output, matrixBytes));

	initMatrix(input, width, height);

	CHECK_CUDA(cudaMalloc(&devInput, matrixBytes));
	CHECK_CUDA(cudaMalloc(&devOutput, matrixBytes));

	CHECK_CUDA(cudaMemcpy(devInput, input, matrixBytes, cudaMemcpyDefault));
	CHECK_CUDA(cudaMemset(devOutput, 0, matrixBytes));

	dim3 threads(TILE_DIM, BLOCK_ROWS);
	dim3 blocks((width + TILE_DIM - 1) / TILE_DIM,
		    (height + TILE_DIM - 1) / TILE_DIM);

	transposeSharedMemory<<<blocks, threads>>>(devInput, devOutput, width,
						   height);
	CHECK_CUDA(cudaGetLastError());
	CHECK_CUDA(cudaDeviceSynchronize());

	CHECK_CUDA(
		cudaMemcpy(output, devOutput, matrixBytes, cudaMemcpyDefault));

	if (verifyTranspose(input, output, width, height)) {
		printf("Shared Memory Transpose: verification passed\n");
	} else {
		printf("Shared Memory Transpose: verification failed\n");
	}

	CHECK_CUDA(cudaFree(devInput));
	CHECK_CUDA(cudaFree(devOutput));
	CHECK_CUDA(cudaFreeHost(input));
	CHECK_CUDA(cudaFreeHost(output));
}

int main(int argc, char **argv)
{
	int width = 1024;
	int height = 768;

	if (argc >= 2) {
		width = std::atoi(argv[1]);
	}
	if (argc >= 3) {
		height = std::atoi(argv[2]);
	}

	if (width <= 0 || height <= 0) {
		printf("Usage: %s [positive_width] [positive_height]\n",
		       argv[0]);
		return 1;
	}

	sharedMemoryTransposeExample(width, height);

	return 0;
}
