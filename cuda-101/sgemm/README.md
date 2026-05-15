# CUDA SGEMM CMake Setup

This directory sets up VS Code and CMake for a CUDA SGEMM learning project.
The `simplest_kernel.cu` example is adapted from
[`SGEMM_CUDA`](https://github.com/siboehm/SGEMM_CUDA/blob/5a7dcc513d951ba764d51bc9d587b3163f3a894d/simplest_kernel.cu).

## Configure

```sh
cmake --preset debug
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

## Credit

The CUDA example source is adapted from
[`SGEMM_CUDA`](https://github.com/siboehm/SGEMM_CUDA).
