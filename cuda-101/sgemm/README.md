# CUDA SGEMM CMake Setup

This directory sets up VS Code and CMake for a CUDA SGEMM learning project.
The `simplest_kernel.cu` example is adapted from
[`SGEMM_CUDA`](https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/simplest_kernel.cu).

## Configure

The simplest path is to use the Makefile wrapper:

```sh
make
```

This configures and builds the debug preset. For release:

```sh
make release
```

You can also call CMake directly:

```sh
cmake --preset debug
cmake --build --preset debug
```

The preset uses:

- CUDA compiler: `/usr/local/cuda/bin/nvcc`
- CUDA toolkit root: `/usr/local/cuda`
- CUDA architecture: `75`
- Build directory: `build/debug`
- Compile database: `build/debug/compile_commands.json`

Change `CMAKE_CUDA_ARCHITECTURES` in `CMakePresets.json` if your GPU uses a
different compute capability.

## VS Code

Open the parent `playground` folder as your VS Code workspace:

```sh
code /home/nxw/developer/playground
```

The root workspace config in `/home/nxw/developer/playground/.vscode`
points CMake Tools and the C/C++ extension at this project.

The C/C++ extension is configured to:

- treat `.cu` and `.cuh` files as CUDA C++;
- use CMake Tools as the configuration provider;
- read CMake's compile database;
- index local headers from `include/` and `src/`;
- index CUDA headers from `/usr/local/cuda/include`.

After adding source files, link targets to `sgemm_project_options` in
`CMakeLists.txt` so they inherit the CUDA include path, CUDA runtime link, and
debug CUDA flags.

## Benchmark Results

These benchmark results were recorded on an NVIDIA Tesla T4 GPU:

Percentage column uses GFLOPS:

- `Rel vs Prev` = `(kernel n release GFLOPS / kernel n-1 release GFLOPS - 1) * 100`.

Kernel: `0`, the cuBLAS FP32 reference implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000122 | 34.4 | N/A |
| 256 | 0.000112 | 298.4 | N/A |
| 512 | 0.000135 | 1990.3 | N/A |
| 1024 | 0.000829 | 2590.3 | N/A |

Kernel: `1`, the naive SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000243 | 17.2 | N/A |
| 256 | 0.001868 | 18.0 | N/A |
| 512 | 0.007006 | 38.3 | N/A |
| 1024 | 0.035274 | 60.9 | N/A |

Kernel: `2`, the global-memory coalescing SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000038 | 111.3 | +547.1% |
| 256 | 0.000142 | 235.6 | +1208.9% |
| 512 | 0.000962 | 279.0 | +628.5% |
| 1024 | 0.005219 | 411.5 | +575.7% |

Kernel: `3`, the shared-memory block SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000026 | 160.2 | +43.9% |
| 256 | 0.000106 | 316.7 | +34.4% |
| 512 | 0.000700 | 383.4 | +37.4% |
| 1024 | 0.004174 | 514.4 | +25.0% |

Kernel: `4`, the 1D block tiling SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000045 | 93.4 | -41.7% |
| 256 | 0.000082 | 409.5 | +29.3% |
| 512 | 0.000376 | 713.8 | +86.2% |
| 1024 | 0.002567 | 836.6 | +62.6% |

Kernel: `5`, the 2D block tiling SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000116 | 36.1 | -61.3% |
| 256 | 0.000196 | 170.8 | -58.3% |
| 512 | 0.000361 | 744.6 | +4.3% |
| 1024 | 0.001580 | 1358.8 | +62.4% |

Kernel: `6`, the vectorized memory access SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000094 | 44.4 | +23.0% |
| 256 | 0.000172 | 195.4 | +14.4% |
| 512 | 0.000330 | 814.1 | +9.3% |
| 1024 | 0.001430 | 1501.6 | +10.5% |

Kernel: `7`, the shared-memory bank conflict SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000094 | 44.5 | +0.2% |
| 256 | 0.000172 | 195.4 | +0.0% |
| 512 | 0.000331 | 811.8 | -0.3% |
| 1024 | 0.001304 | 1647.0 | +9.7% |

Kernel: `8`, the shared-memory B-row padding SGEMM implementation.

| Size | Release Time (s) | Release GFLOPS | Rel vs Prev |
| ---: | ---: | ---: | ---: |
| 128 | 0.000095 | 44.3 | -0.4% |
| 256 | 0.000173 | 193.4 | -1.0% |
| 512 | 0.000334 | 804.8 | -0.9% |
| 1024 | 0.001699 | 1263.9 | -23.3% |

## Credit

The CUDA example source is adapted from
[`SGEMM_CUDA`](https://github.com/siboehm/SGEMM_CUDA).
