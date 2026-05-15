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

Kernel: `0`, the cuBLAS FP32 reference implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS |
| ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000121 | 34.7 | 0.000122 | 34.4 |
| 256 | 0.000112 | 300.3 | 0.000112 | 298.4 |
| 512 | 0.000135 | 1987.7 | 0.000135 | 1990.3 |
| 1024 | 0.000829 | 2589.6 | 0.000829 | 2590.3 |

Kernel: `1`, the naive SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS |
| ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000380 | 11.0 | 0.000243 | 17.2 |
| 256 | 0.001891 | 17.7 | 0.001868 | 18.0 |
| 512 | 0.006330 | 42.4 | 0.007006 | 38.3 |
| 1024 | 0.035482 | 60.5 | 0.035274 | 60.9 |

Kernel: `2`, the global-memory coalescing SGEMM implementation.

| Size | Debug Time (s) | Debug GFLOPS | Release Time (s) | Release GFLOPS |
| ---: | ---: | ---: | ---: | ---: |
| 128 | 0.000216 | 19.4 | 0.000038 | 111.3 |
| 256 | 0.000834 | 40.2 | 0.000142 | 235.6 |
| 512 | 0.004313 | 62.2 | 0.000962 | 279.0 |
| 1024 | 0.020805 | 103.2 | 0.005219 | 411.5 |

## Credit

The CUDA example source is adapted from
[`SGEMM_CUDA`](https://github.com/siboehm/SGEMM_CUDA).
