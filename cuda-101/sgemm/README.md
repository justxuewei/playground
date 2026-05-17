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

Percentage columns use GFLOPS:

- `Rel vs Debug` = `(release GFLOPS / debug GFLOPS - 1) * 100`.
- `Rel vs Prev` = `(kernel n release GFLOPS / kernel n-1 release GFLOPS - 1) * 100`.

Kernel: `0`, the cuBLAS FP32 reference implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS | Rel vs Debug | Rel vs Prev |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000121 | 34.7 | 0.000122 | 34.4 | -0.9% | N/A |
| 256 | 0.000112 | 300.3 | 0.000112 | 298.4 | -0.6% | N/A |
| 512 | 0.000135 | 1987.7 | 0.000135 | 1990.3 | +0.1% | N/A |
| 1024 | 0.000829 | 2589.6 | 0.000829 | 2590.3 | +0.0% | N/A |

Kernel: `1`, the naive SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS | Rel vs Debug | Rel vs Prev |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000380 | 11.0 | 0.000243 | 17.2 | +56.4% | N/A |
| 256 | 0.001891 | 17.7 | 0.001868 | 18.0 | +1.7% | N/A |
| 512 | 0.006330 | 42.4 | 0.007006 | 38.3 | -9.7% | N/A |
| 1024 | 0.035482 | 60.5 | 0.035274 | 60.9 | +0.7% | N/A |

Kernel: `2`, the global-memory coalescing SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS | Rel vs Debug | Rel vs Prev |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000216 | 19.4 | 0.000038 | 111.3 | +473.7% | +547.1% |
| 256 | 0.000834 | 40.2 | 0.000142 | 235.6 | +486.1% | +1208.9% |
| 512 | 0.004313 | 62.2 | 0.000962 | 279.0 | +348.6% | +628.5% |
| 1024 | 0.020805 | 103.2 | 0.005219 | 411.5 | +298.7% | +575.7% |

Kernel: `3`, the shared-memory block SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS | Rel vs Debug | Rel vs Prev |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000258 | 16.3 | 0.000026 | 160.2 | +882.8% | +43.9% |
| 256 | 0.001004 | 33.4 | 0.000106 | 316.7 | +848.2% | +34.4% |
| 512 | 0.004318 | 62.2 | 0.000700 | 383.4 | +516.4% | +37.4% |
| 1024 | 0.019229 | 111.7 | 0.004174 | 514.4 | +360.5% | +25.0% |

Kernel: `4`, the 1D block tiling SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS | Rel vs Debug | Rel vs Prev |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 0.001831 | 2.3 | 0.000045 | 93.4 | +3960.9% | -41.7% |
| 256 | 0.002580 | 13.0 | 0.000082 | 409.5 | +3050.0% | +29.3% |
| 512 | 0.003586 | 74.9 | 0.000376 | 713.8 | +853.0% | +86.2% |
| 1024 | 0.022805 | 94.2 | 0.002567 | 836.6 | +788.1% | +62.6% |

Kernel: `5`, the 2D block tiling SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS | Rel vs Debug | Rel vs Prev |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 128 | 0.010903 | 0.4 | 0.000116 | 36.1 | +8925.0% | -61.3% |
| 256 | 0.014944 | 2.2 | 0.000196 | 170.8 | +7663.6% | -58.3% |
| 512 | 0.030167 | 8.9 | 0.000361 | 744.6 | +8266.3% | +4.3% |
| 1024 | 0.092790 | 23.1 | 0.001580 | 1358.8 | +5782.3% | +62.4% |

## Credit

The CUDA example source is adapted from
[`SGEMM_CUDA`](https://github.com/siboehm/SGEMM_CUDA).
