# CUDA Tensor Core Samples

This directory is a build environment for selected CUDA Samples tensor-core
GEMM examples. It mirrors the CMake preset flow used by `../sgemm`.

## Layout

Copy CUDA sample sources into flat sample directories under `src`:

```text
src/immaTensorCoreGemm/immaTensorCoreGemm.cu
src/bf16TensorCoreGemm/bf16TensorCoreGemm.cu
src/tf32TensorCoreGemm/tf32TensorCoreGemm.cu
src/cudaTensorCoreGemm/cudaTensorCoreGemm.cu
src/dmmaTensorCoreGemm/dmmaTensorCoreGemm.cu
```

`src/cudaTensorCoreGemm` contains the CUDA Samples `cudaTensorCoreGemm` source
with non-license comments removed.

If the copied samples include CUDA Samples helper headers such as
`helper_cuda.h`, put those headers under `src/Common`.

`visualizations/` is reserved for notes, diagrams, or generated visualization
assets.

## Build

Configure and build the debug preset:

```sh
make
```

Build release:

```sh
make release
```

You can also call CMake directly:

```sh
cmake --preset debug
cmake --build --preset debug
```

Missing sample files are skipped during configure. Once a `.cu` file is copied
into one of the expected paths, CMake creates an executable target with the same
name as the sample directory.

The preset matches `../sgemm` and targets `sm_75`:

- CUDA compiler: `/usr/local/cuda/bin/nvcc`
- CUDA toolkit root: `/usr/local/cuda`
- CUDA architecture: `75`
- Build directory: `build/debug` or `build/release`

All enabled sample targets inherit that `sm_75` architecture from the active
CMake preset.
