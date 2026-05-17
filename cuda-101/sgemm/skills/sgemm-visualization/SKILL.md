---
name: sgemm-visualization
description: Build or update cuda-101 SGEMM kernel visualizations. Use when Codex is asked to add a new kernel visualization, revise an existing SGEMM animation, explain a CUDA kernel with code-to-block-to-tile-to-matrix flow, or keep visualization files consistent with SGEMM kernel source files under cuda-101/sgemm.
---

# SGEMM Visualization

## Workflow

1. Read `cuda-101/sgemm/STEPS.md` before adding a new kernel.
2. Inspect the target kernel source in `src/kernels/*.cuh` and its launcher in
   `src/runner.cu`.
3. Match the established visualization flow:
   code walkthrough -> first block -> tile work -> register/shared-memory
   reuse -> next K chunk -> matrix grid -> why faster.
4. Start examples from `blockIdx = (0, 0)` unless the user asks otherwise.
5. Make the first code walkthrough stage clickable:
   clicking a code line should pin the matching explanation card.
6. For kernel 2 and later, make the final page a `Why faster` comparison
   against kernel `N-1`.
7. Keep text concise and inside canvas bounds at desktop and mobile widths.
8. Verify JavaScript with `node --check`.
9. If CUDA source changes are part of the task, build `sgemm` before finishing.

## File Pattern

- Add one HTML file in `visualizations/kernelN_topic.html`.
- Add one JS file in `visualizations/kernelN_topic.js`.
- Reuse `visualizations/kernel_animation.css`.
- Do not put visualization logic for new kernels into unrelated pages.
- Keep legends consistent: C tile, thread outputs or thread tile, A/As, B/Bs,
  and registers when applicable.

## Teaching Rules

- Explain what the code does before zooming out to the block and matrix.
- Show the first block's exact C rows and columns.
- Label shared-memory tile shapes explicitly, such as `As 128x8` and
  `Bs 8x128`.
- Compare only the relevant new idea against the previous kernel, and put that
  comparison on the final `Why faster` page.
- Use GFLOPS and benchmark data only when the user provides measured results.

## References

Read `references/sgemm-animation-patterns.md` when creating or substantially
rewriting a visualization.
