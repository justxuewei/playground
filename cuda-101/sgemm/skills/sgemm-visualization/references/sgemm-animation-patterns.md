# SGEMM Animation Patterns

## Stage Shape

Use this stage order for new SGEMM kernel visualizations:

1. `Code walkthrough`
2. `Block setup`
3. `Tile work`
4. Kernel-specific reuse stage
5. `Next K chunk`
6. `Matrix grid`
7. `Why faster`

For kernel 2 and later, `Why faster` must be the final stage. It should compare
kernel `N` with kernel `N-1` and explain only the main reason the new kernel is
faster.

The code walkthrough should render real kernel-like lines on the left and
explanation cards on the right. Use a `codeHotspots` array and
`selectedCodeStep` state so line clicks pin a matching card.

## First Block Convention

Start with `blockIdx = (0, 0)`:

- Kernel 1-3: `C rows 0..31, C cols 0..31`
- Kernel 4: `C rows 0..63, C cols 0..63`
- Kernel 5-6: `C rows 0..127, C cols 0..127`

For kernels that use `gridDim.x` for columns and `gridDim.y` for rows, say so
explicitly in the matrix stage.

## Kernel Comparison Focus

- Kernel 1: one block -> one `32x32` tile, one thread -> one C element.
- Kernel 2: same tile, but 1D thread mapping makes warp 0 horizontal.
- Kernel 3: adds shared memory with `As 32x32` and `Bs 32x32`.
- Kernel 4: one thread computes an `8x1` vertical register tile.
- Kernel 5: one thread computes an `8x8` register tile using `regM[8]` and
  `regN[8]`.
- Kernel 6: keeps kernel 5's `8x8` register tile and uses `float4`
  vectorized global loads/stores with a transposed `As` shared-memory layout.

## Why Faster Page

Keep the page compact and comparative:

- left panel: kernel `N-1`
- right panel: kernel `N`
- short metric rows for the key tradeoff
- one formula-style summary line at the bottom

Examples:

- Kernel 2 vs 1: vertical warp with strided memory -> horizontal warp with
  coalesced B loads and C stores.
- Kernel 3 vs 2: repeated global reads -> shared-memory tiles reused by the
  block.
- Kernel 4 vs 3: one C value per thread -> `8x1` register tile per thread.
- Kernel 5 vs 4: `8x1` register tile -> `8x8` register tile with more shared
  memory and more FMAs per shared-memory load.
- Kernel 6 vs 5: same `8x8` register math -> `float4` global loads/stores
  and transposed `As` to reduce memory instruction overhead.

## Verification

Always run:

```sh
node --check cuda-101/sgemm/visualizations/kernelN_topic.js
```

When CUDA source was changed, also run:

```sh
cmake --build --preset debug --target sgemm
cmake --build --preset release --target sgemm
```

Running `./build/*/sgemm N` may fail in local environments without a compatible
CUDA driver. Report that separately from compile success.
