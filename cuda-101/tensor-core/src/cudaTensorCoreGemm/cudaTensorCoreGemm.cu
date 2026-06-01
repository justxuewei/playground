#include <assert.h>
#include <cuda.h>
#include <mma.h>
#include <stdio.h>

#include <helper_cuda.h>
#include <helper_functions.h>

#ifndef CPU_DEBUG

#define CPU_DEBUG 0
#endif

#ifndef SHARED_MEMORY_LIMIT_64K

#define SHARED_MEMORY_LIMIT_64K 1
#endif

#define WARP_SIZE 32

#define M 16
#define N 16
#define K 16

#define WMMA_M 16
#define WMMA_N 16
#define WMMA_K 16

#define M_TILES 256
#define N_TILES 256
#define K_TILES 256

#define M_GLOBAL (M * M_TILES)
#define N_GLOBAL (N * N_TILES)
#define K_GLOBAL (K * K_TILES)

#define C_LAYOUT wmma::mem_row_major

#define WARPS_PER_BLOCK 8
#define THREADS_PER_BLOCK (WARP_SIZE * WARPS_PER_BLOCK)

#if SHARED_MEMORY_LIMIT_64K

#define CHUNK_K 4
#else
#define CHUNK_K 8
#endif

#define CHUNK_LINE_BYTES (CHUNK_K * K * sizeof(half))
#define WARP_COPY_BYTES (WARP_SIZE * sizeof(int4))
#define CHUNK_COPY_LINES_PER_WARP (WARP_COPY_BYTES / CHUNK_LINE_BYTES)
#define CHUNK_COPY_LINE_LANES (WARP_SIZE / CHUNK_COPY_LINES_PER_WARP)

#define BLOCK_ROW_WARPS 2
#define BLOCK_COL_WARPS 4

#define WARP_ROW_TILES 4
#define WARP_COL_TILES 2

#define BLOCK_ROW_TILES (WARP_ROW_TILES * BLOCK_ROW_WARPS)
#define BLOCK_COL_TILES (WARP_COL_TILES * BLOCK_COL_WARPS)

#define GLOBAL_MEM_STRIDE N_GLOBAL

#define SHMEM_STRIDE (N * BLOCK_ROW_TILES)
#define SHMEM_OFFSET (N * WARP_ROW_TILES)

#define SKEW_HALF 16

#define checkKernelErrors(expr)                                               \
	do {                                                                  \
		expr;                                                         \
                                                                              \
		cudaError_t __err = cudaGetLastError();                       \
		if (__err != cudaSuccess) {                                   \
			printf("Line %d: '%s' failed: %s\n", __LINE__, #expr, \
			       cudaGetErrorString(__err));                    \
			abort();                                              \
		}                                                             \
	} while (0)

using namespace nvcuda;

__host__ void init_host_matrices(half *a, half *b, float *c)
{
	for (int i = 0; i < M_GLOBAL; i++) {
		for (int j = 0; j < K_GLOBAL; j++) {
			a[i * K_GLOBAL + j] = (half)(rand() % 3);
		}
	}

	for (int i = 0; i < N_GLOBAL; i++) {
		for (int j = 0; j < K_GLOBAL; j++) {
			b[i * K_GLOBAL + j] = (half)(rand() % 3);
		}
	}

	for (int t = 0; t < M_GLOBAL * N_GLOBAL; t++) {
		c[t] = static_cast<float>(rand() % 3);
	}
}

__global__ void compute_gemm(const half *A, const half *B, const float *C,
			     float *D, float alpha, float beta)
{
	extern __shared__ half shmem[][CHUNK_K * K + SKEW_HALF];

	const unsigned int warpId = threadIdx.x / WARP_SIZE;
	const unsigned int laneId = threadIdx.x % WARP_SIZE;

	const size_t shmem_idx_b_off = BLOCK_COL_TILES * M;

	float *shmem_warp_tile_ptr = (float *)&shmem[0][0] +
				     (warpId / 2) * SHMEM_STRIDE * K * 2 +
				     (warpId % 2) * SHMEM_OFFSET;

	float *shmem_warp_stream_ptr =
		(float *)&shmem[0][0] + warpId * SHMEM_STRIDE * K;

	beta /= alpha;

	for (unsigned int block_pos = blockIdx.x;; block_pos += gridDim.x) {
		const unsigned int block_tile_i =
			((block_pos * BLOCK_ROW_TILES) / N_TILES) *
			(BLOCK_COL_TILES);
		const unsigned int block_tile_j =
			(block_pos * BLOCK_ROW_TILES) % N_TILES;

		if (block_tile_i >= M_TILES) {
			break;
		}

		const size_t gmem_idx =
			(block_tile_i + warpId) * M * GLOBAL_MEM_STRIDE +
			block_tile_j * N;
		const float *src_gmem_warp_stream_ptr = &C[gmem_idx];

#pragma unroll
		for (int i = 0; i < K; i++) {
			typedef int4 copy_t;

			*((copy_t *)(shmem_warp_stream_ptr + SHMEM_STRIDE * i) +
			  laneId) = *((copy_t *)(src_gmem_warp_stream_ptr +
						 GLOBAL_MEM_STRIDE * i) +
				      laneId);
		}

		__syncthreads();

		wmma::fragment<wmma::accumulator, M, N, K, float>
			c[WARP_COL_TILES][WARP_ROW_TILES];

#pragma unroll
		for (int i = 0; i < WARP_COL_TILES; i++) {
#pragma unroll
			for (int j = 0; j < WARP_ROW_TILES; j++) {
				const float *tile_ptr = shmem_warp_tile_ptr +
							i * SHMEM_STRIDE * K +
							j * N;

				wmma::load_matrix_sync(c[i][j], tile_ptr,
						       SHMEM_STRIDE, C_LAYOUT);
			}
		}

		__syncthreads();

#pragma unroll
		for (int i = 0; i < WARP_COL_TILES; i++) {
#pragma unroll
			for (int j = 0; j < WARP_ROW_TILES; j++) {
#pragma unroll
				for (int t = 0; t < c[i][j].num_elements; t++) {
					c[i][j].x[t] *= beta;
				}
			}
		}

		const half *warp_ptr =
			(warpId < 4) ? (&A[block_tile_i * M * K_GLOBAL] +
					M * K_GLOBAL * (warpId % 4) * 2) :
				       (&B[block_tile_j * N * K_GLOBAL] +
					N * K_GLOBAL * (warpId % 4) * 2);

#pragma unroll
		for (int tile_k = 0; tile_k < K_TILES; tile_k += CHUNK_K) {
			size_t shmem_idx =
				warpId < (WARPS_PER_BLOCK / 2) ?
					(M * (warpId % (WARPS_PER_BLOCK / 2)) *
					 2) :
					(N * (warpId % (WARPS_PER_BLOCK / 2)) *
						 2 +
					 shmem_idx_b_off);

			int4 *lane_ptr =
				(int4 *)(warp_ptr + tile_k * K +
					 (laneId / CHUNK_COPY_LINE_LANES) *
						 K_GLOBAL) +
				(laneId % CHUNK_COPY_LINE_LANES);

			shmem_idx += laneId / CHUNK_COPY_LINE_LANES;

#pragma unroll
			for (int i = 0;
			     i <
			     ((WARP_SIZE / 2) / CHUNK_COPY_LINES_PER_WARP) * 2;
			     i++) {
				*((int4 *)&shmem[shmem_idx][0] +
				  (laneId % CHUNK_COPY_LINE_LANES)) = *lane_ptr;

				lane_ptr =
					(int4 *)((half *)lane_ptr +
						 K_GLOBAL *
							 CHUNK_COPY_LINES_PER_WARP);
				shmem_idx += CHUNK_COPY_LINES_PER_WARP;
			}

			__syncthreads();

#pragma unroll
			for (int k_step = 0; k_step < CHUNK_K; k_step++) {
				wmma::fragment<wmma::matrix_a, M, N, K, half,
					       wmma::row_major>
					a[WARP_COL_TILES];
				wmma::fragment<wmma::matrix_b, M, N, K, half,
					       wmma::col_major>
					b[WARP_ROW_TILES];

#pragma unroll
				for (int i = 0; i < WARP_COL_TILES; i++) {
					size_t shmem_idx_a =
						(warpId / 2) * M * 2 + (i * M);
					const half *tile_ptr =
						&shmem[shmem_idx_a][k_step * K];

					wmma::load_matrix_sync(
						a[i], tile_ptr,
						K * CHUNK_K + SKEW_HALF);

#pragma unroll
					for (int j = 0; j < WARP_ROW_TILES;
					     j++) {
						if (i == 0) {
							size_t shmem_idx_b =
								shmem_idx_b_off +
								(WARP_ROW_TILES *
								 N) * (warpId %
								       2) +
								(j * N);
							const half *tile_ptr =
								&shmem[shmem_idx_b]
								      [k_step *
								       K];

							wmma::load_matrix_sync(
								b[j], tile_ptr,
								K * CHUNK_K +
									SKEW_HALF);
						}

						wmma::mma_sync(c[i][j], a[i],
							       b[j], c[i][j]);
					}
				}
			}

			__syncthreads();
		}

#pragma unroll
		for (int i = 0; i < WARP_COL_TILES; i++) {
#pragma unroll
			for (int j = 0; j < WARP_ROW_TILES; j++) {
#pragma unroll

				for (int t = 0; t < c[i][j].num_elements; t++)
					c[i][j].x[t] *= alpha;

				float *tile_ptr = shmem_warp_tile_ptr +
						  i * SHMEM_STRIDE * K + j * N;

				wmma::store_matrix_sync(tile_ptr, c[i][j],
							SHMEM_STRIDE, C_LAYOUT);
			}
		}

		__syncthreads();

		float *dst_gmem_warp_stream_ptr = &D[gmem_idx];

#pragma unroll
		for (int i = 0; i < K; i++) {
			*((int4 *)(dst_gmem_warp_stream_ptr +
				   GLOBAL_MEM_STRIDE * i) +
			  laneId) = *((int4 *)(shmem_warp_stream_ptr +
					       SHMEM_STRIDE * i) +
				      laneId);
		}

		__syncthreads();
	}
}

__global__ void simple_wmma_gemm(half *a, half *b, float *c, float *d, int m_ld,
				 int n_ld, int k_ld, float alpha, float beta)
{
	int lda = k_ld;
	int ldb = k_ld;
	int ldc = n_ld;

	int warpM = (blockIdx.x * blockDim.x + threadIdx.x) / warpSize;
	int warpN = (blockIdx.y * blockDim.y + threadIdx.y);

	wmma::fragment<wmma::matrix_a, WMMA_M, WMMA_N, WMMA_K, half,
		       wmma::row_major>
		a_frag;
	wmma::fragment<wmma::matrix_b, WMMA_M, WMMA_N, WMMA_K, half,
		       wmma::col_major>
		b_frag;
	wmma::fragment<wmma::accumulator, WMMA_M, WMMA_N, WMMA_K, float>
		acc_frag;
	wmma::fragment<wmma::accumulator, WMMA_M, WMMA_N, WMMA_K, float> c_frag;

	wmma::fill_fragment(acc_frag, 0.0f);

	for (int i = 0; i < k_ld; i += WMMA_K) {
		int aCol = i;
		int aRow = warpM * WMMA_M;
		int bCol = warpN * N;
		int bRow = i;

		if (aRow < m_ld && aCol < k_ld && bRow < k_ld && bCol < n_ld) {
			wmma::load_matrix_sync(a_frag, a + aCol + aRow * lda,
					       lda);
			wmma::load_matrix_sync(b_frag, b + bRow + bCol * ldb,
					       ldb);

			wmma::mma_sync(acc_frag, a_frag, b_frag, acc_frag);
		}
	}

	int cCol = warpN * WMMA_N;
	int cRow = warpM * WMMA_M;

	if (cRow < m_ld && cCol < n_ld) {
		wmma::load_matrix_sync(c_frag, c + cCol + cRow * ldc, ldc,
				       wmma::mem_row_major);

		for (int i = 0; i < c_frag.num_elements; i++) {
			c_frag.x[i] =
				alpha * acc_frag.x[i] + beta * c_frag.x[i];
		}

		wmma::store_matrix_sync(d + cCol + cRow * ldc, c_frag, ldc,
					wmma::mem_row_major);
	}
}

__host__ void matMultiplyOnHost(half *A, half *B, float *C, float alpha,
				float beta, int numARows, int numAColumns,
				int numBRows, int numBColumns, int numCRows,
				int numCColumns)
{
	for (int i = 0; i < numCRows; i++) {
		for (int j = 0; j < numCColumns; j++) {
			float temp = 0.0;

			for (int k = 0; k < numAColumns; k++) {
				temp += (float)A[i * numAColumns + k] *
					(float)B[j * numBRows + k];
			}

			C[i * numCColumns + j] =
				temp * alpha + beta * C[i * numCColumns + j];
		}
	}
}

int main(int argc, char **argv)
{
	printf("Initializing...\n");

	int dev = findCudaDevice(argc, (const char **)argv);

	cudaDeviceProp deviceProp;
	checkCudaErrors(cudaGetDeviceProperties(&deviceProp, dev));

	if (deviceProp.major < 7) {
		printf("cudaTensorCoreGemm requires SM 7.0 or higher to use Tensor "
		       "Cores.  Exiting...\n");
		exit(EXIT_WAIVED);
	}

	printf("M: %d (%d x %d)\n", M_GLOBAL, M, M_TILES);
	printf("N: %d (%d x %d)\n", N_GLOBAL, N, N_TILES);
	printf("K: %d (%d x %d)\n", K_GLOBAL, K, K_TILES);

	half *A_h = NULL;
	half *B_h = NULL;
	float *C_h = NULL;
#if CPU_DEBUG
	float *result_hD = NULL;
	float *result_host = NULL;
#endif

	A_h = (half *)malloc(sizeof(half) * M_GLOBAL * K_GLOBAL);
	B_h = (half *)malloc(sizeof(half) * K_GLOBAL * N_GLOBAL);
	C_h = (float *)malloc(sizeof(float) * M_GLOBAL * N_GLOBAL);
#if CPU_DEBUG
	result_hD = (float *)malloc(sizeof(float) * M_GLOBAL * N_GLOBAL);
	result_host = (float *)malloc(sizeof(float) * M_GLOBAL * N_GLOBAL);
#endif

	half *A = NULL;
	half *B = NULL;
	float *C = NULL;
	float *D = NULL;

	checkCudaErrors(cudaMalloc(reinterpret_cast<void **>(&A),
				   sizeof(half) * M_GLOBAL * K_GLOBAL));
	checkCudaErrors(cudaMalloc(reinterpret_cast<void **>(&B),
				   sizeof(half) * N_GLOBAL * K_GLOBAL));
	checkCudaErrors(cudaMalloc(reinterpret_cast<void **>(&C),
				   sizeof(float) * M_GLOBAL * N_GLOBAL));
	checkCudaErrors(cudaMalloc(reinterpret_cast<void **>(&D),
				   sizeof(float) * M_GLOBAL * N_GLOBAL));

	assert(((unsigned long long)A) % 128 == 0);
	assert(((unsigned long long)B) % 128 == 0);
	assert(((unsigned long long)C) % 128 == 0);
	assert(((unsigned long long)D) % 128 == 0);

	init_host_matrices(A_h, B_h, C_h);

	printf("Preparing data for GPU...\n");

	checkCudaErrors(cudaMemcpy(A, A_h, sizeof(half) * M_GLOBAL * K_GLOBAL,
				   cudaMemcpyHostToDevice));
	checkCudaErrors(cudaMemcpy(B, B_h, sizeof(half) * N_GLOBAL * K_GLOBAL,
				   cudaMemcpyHostToDevice));
	checkCudaErrors(cudaMemcpy(C, C_h, sizeof(float) * M_GLOBAL * N_GLOBAL,
				   cudaMemcpyHostToDevice));
	checkCudaErrors(cudaMemset(D, 0, sizeof(float) * M_GLOBAL * N_GLOBAL));

	enum {

		SHMEM_SZ = MAX(sizeof(half) * (BLOCK_COL_TILES * M) *
				       (CHUNK_K * K + SKEW_HALF) * 2,
			       M * (BLOCK_ROW_WARPS * WARP_ROW_TILES) * N *
				       (BLOCK_COL_WARPS * WARP_COL_TILES) *
				       sizeof(float))
	};

	printf("Required shared memory size: %lu Kb\n", SHMEM_SZ / 1024UL);

	const float alpha = 1.1f;
	const float beta = 1.2f;

	cudaEvent_t start, stop;

	checkCudaErrors(cudaEventCreate(&start));
	checkCudaErrors(cudaEventCreate(&stop));
	checkCudaErrors(cudaEventRecord(start));

	if (deviceProp.sharedMemPerMultiprocessor >= SHMEM_SZ) {
		printf("Computing... using high performance kernel compute_gemm \n");

		checkCudaErrors(cudaFuncSetAttribute(
			compute_gemm,
			cudaFuncAttributeMaxDynamicSharedMemorySize, SHMEM_SZ));
		checkKernelErrors(
			(compute_gemm<<<deviceProp.multiProcessorCount,
					THREADS_PER_BLOCK, SHMEM_SZ>>>(
				A, B, C, D, alpha, beta)));
#if CPU_DEBUG
		checkCudaErrors(cudaMemcpy(result_hD, D,
					   sizeof(float) * M_GLOBAL * N_GLOBAL,
					   cudaMemcpyDeviceToHost));
#endif
	} else {
		dim3 gridDim;
		dim3 blockDim;

		blockDim.x = 128;
		blockDim.y = 4;

		gridDim.x = (M_GLOBAL + (WMMA_M * blockDim.x / 32 - 1)) /
			    (WMMA_M * blockDim.x / 32);
		gridDim.y = (N_GLOBAL + WMMA_N * blockDim.y - 1) /
			    (WMMA_N * blockDim.y);

		printf("Computing... using simple_wmma_gemm kernel\n");
		simple_wmma_gemm<<<gridDim, blockDim>>>(
			A, B, C, D, M_GLOBAL, N_GLOBAL, K_GLOBAL, alpha, beta);
#if CPU_DEBUG
		checkCudaErrors(cudaMemcpy(result_hD, D,
					   sizeof(float) * M_GLOBAL * N_GLOBAL,
					   cudaMemcpyDeviceToHost));
#endif
	}

	checkCudaErrors(cudaEventRecord(stop));
	checkCudaErrors(cudaEventSynchronize(stop));

#if CPU_DEBUG
	printf("Verifying correctness of the computations...\n");

	memcpy(result_host, C_h, sizeof(float) * M_GLOBAL * N_GLOBAL);

	matMultiplyOnHost(A_h, B_h, result_host, alpha, beta, M_GLOBAL,
			  K_GLOBAL, K_GLOBAL, N_GLOBAL, M_GLOBAL, N_GLOBAL);

	for (int i = 0; i < N_GLOBAL * M_GLOBAL; i++) {
		if (fabs(result_hD[i] - result_host[i]) > 0.1f)
			printf("mismatch i=%d result_hD=%f result_host=%f\n", i,
			       result_hD[i], result_host[i]);
	}
	free(result_hD);
	free(result_host);
#endif

	float milliseconds = 0;

	checkCudaErrors(cudaEventElapsedTime(&milliseconds, start, stop));

	printf("Time: %f ms\n", milliseconds);
	printf("TFLOPS: %.2f\n",
	       static_cast<double>((static_cast<double>(M_GLOBAL) * N_GLOBAL *
				    K_GLOBAL * 2) /
				   (milliseconds / 1000.)) /
		       1e12);

	free(A_h);
	free(B_h);
	free(C_h);
	checkCudaErrors(cudaFree(reinterpret_cast<void *>(A)));
	checkCudaErrors(cudaFree(reinterpret_cast<void *>(B)));
	checkCudaErrors(cudaFree(reinterpret_cast<void *>(C)));
	checkCudaErrors(cudaFree(reinterpret_cast<void *>(D)));

	return 0;
}
