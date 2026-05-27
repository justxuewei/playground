(function () {
  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d");
  const tabs = document.querySelector("#tabs");
  const playButton = document.querySelector("#play");

  const W = 1200;
  const H = 680;
  const stageMs = 4200;
  const codeHotspots = [];
  let selectedCodeStep = null;

  const stages = [
    {
      title: "Code",
      note: "Read the shared-memory kernel in execution order. Click a line to pin the explanation.",
      codeLine: "sgemm_shared_mem_block<32><<<grid, 1024>>>(…)"
    },
    {
      title: "Thread",
      note: "One thread loads one A and one B element into shared memory, then computes one C element.",
      codeLine: "As[threadRow][threadCol] = A[…];  tmp += As[threadRow][dotIdx] * Bs[dotIdx][threadCol];"
    },
    {
      title: "Warp",
      note: "32 threads in a warp cooperatively load one row of As and one row of Bs.",
      codeLine: "warp 1: threadIdx.x 32..63 → threadRow=1, threadCol=0..31"
    },
    {
      title: "Block",
      note: "All 1024 threads cooperatively load the full 32×32 As and Bs tiles. This is the key idea.",
      codeLine: "32 warps load 32×32 As + 32×32 Bs → 2048 global loads, 65536 shared reads"
    },
    {
      title: "Grid",
      note: "Each block has its own private shared memory. The grid tiles C with independent blocks.",
      codeLine: "gridDim = (⌈M/32⌉, ⌈N/32⌉) → each block has private As, Bs"
    },
    {
      title: "Overview",
      note: "All four levels in one picture: Grid → Block → Warp → Thread, showing cooperative load + shared memory reuse.",
      codeLine: "grid → block(0,1) → warp 1 loads row 1 of As/Bs → thread 35 reads row 1 + col 3"
    },
    {
      title: "Why faster",
      note: "Kernel 2: redundant global reads across warps. Kernel 3: load once into shared memory, reuse 32×.",
      codeLine: "kernel 2: up to 1024K B reads | kernel 3: 64K total reads → 16× less traffic"
    }
  ];

  let stageIndex = 0;
  let playing = false;
  let stageStartedAt = performance.now();

  for (const [i, s] of stages.entries()) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `${i + 1}. ${s.title}`;
    b.addEventListener("click", () => setStage(i));
    tabs.appendChild(b);
  }

  document.querySelector("#prev").addEventListener("click", () =>
    setStage((stageIndex + stages.length - 1) % stages.length));
  document.querySelector("#next").addEventListener("click", () =>
    setStage((stageIndex + 1) % stages.length));
  document.querySelector("#reset").addEventListener("click", () => {
    playing = false;
    playButton.textContent = "Play";
    setStage(0);
  });
  playButton.addEventListener("click", () => {
    playing = !playing;
    playButton.textContent = playing ? "Pause" : "Play";
    stageStartedAt = performance.now();
  });
  canvas.addEventListener("click", (e) => {
    const hit = hotspotAt(e);
    if (hit === null) return;
    selectedCodeStep = hit;
    playing = false;
    playButton.textContent = "Play";
    draw();
  });
  canvas.addEventListener("mousemove", (e) => {
    canvas.style.cursor = hotspotAt(e) === null ? "default" : "pointer";
  });
  window.addEventListener("resize", () => { setupCanvas(); draw(); });

  function setStage(i) {
    stageIndex = i;
    selectedCodeStep = null;
    stageStartedAt = performance.now();
    updateTabs();
    draw();
  }

  function updateTabs() {
    [...tabs.children].forEach((b, i) =>
      b.classList.toggle("active", i === stageIndex));
  }

  function tick(now) {
    if (playing && now - stageStartedAt > stageMs)
      setStage((stageIndex + 1) % stages.length);
    draw(now);
    requestAnimationFrame(tick);
  }

  function setupCanvas() {
    const r = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * r);
    canvas.height = Math.round(rect.height * r);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function draw(now = performance.now()) {
    const p = Math.min(1, (now - stageStartedAt) / stageMs);
    ctx.clearRect(0, 0, W, H);
    drawBg();
    drawHeader();
    if (stageIndex === 0) drawCodeStage(p);
    else if (stageIndex === 1) drawThreadStage(p);
    else if (stageIndex === 2) drawWarpStage(p);
    else if (stageIndex === 3) drawBlockStage(p);
    else if (stageIndex === 4) drawGridStage(p);
    else if (stageIndex === 5) drawOverviewStage(p);
    else if (stageIndex === 6) drawWhyFasterStage(p);
  }

  // ── Stage 0: Code ──

  function drawCodeStage(p) {
    const cx = 48, cy = 100;
    codeHotspots.length = 0;
    const active = selectedCodeStep ?? Math.min(5, Math.floor(p * 6));

    const lines = [
      "const uint cTileRow = blockIdx.x;",
      "const uint cTileCol = blockIdx.y;",
      "__shared__ float As[32*32];",
      "__shared__ float Bs[32*32];",
      "threadCol = threadIdx.x % 32;",
      "threadRow = threadIdx.x / 32;",
      "A += cTileRow * 32 * K;  // ptr setup",
      "B += cTileCol * 32;",
      "for (bkIdx = 0; bkIdx < K; bkIdx += 32) {",
      "  As[threadRow][threadCol] = A[threadRow][threadCol];",
      "  Bs[threadRow][threadCol] = B[threadRow][threadCol];",
      "  __syncthreads();",
      "  for (dotIdx = 0; dotIdx < 32; ++dotIdx)",
      "    tmp += As[threadRow][dotIdx]*Bs[dotIdx][threadCol];",
      "  __syncthreads();",
      "}",
      "C[threadRow][threadCol] = alpha*tmp + beta*C[…];"
    ];

    const groupOf = (i) => {
      if (i <= 3) return 0;
      if (i <= 5) return 1;
      if (i <= 7) return 2;
      if (i <= 11) return 3;
      if (i <= 15) return 4;
      return 5;
    };

    roundRect(cx - 14, cy - 34, 620, 530, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 3 source", cx + 4, cy - 10);

    for (let i = 0; i < lines.length; i++) {
      const g = groupOf(i);
      const on = g === active;
      codeHotspots.push({ x: cx - 4, y: cy + i * 27 + 4, w: 590, h: 23, step: g });
      if (on) roundRect(cx - 4, cy + i * 27 + 4, 590, 23, 5, "#e8f7ef", "#118a4b");
      ctx.fillStyle = on ? "#14532d" : "#1d2433";
      ctx.font = "12.5px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(lines[i], cx + 4, cy + i * 27 + 20);
    }

    const cards = [
      ["Block index + shared mem", "blockIdx selects 32×32 C tile.", "As[32×32] and Bs[32×32] are block-private."],
      ["Thread mapping", "1024 threads → 32 rows × 32 cols.", "threadRow = threadIdx.x / 32"],
      ["Pointer setup", "A, B, C pointers advance to this block's tile.", ""],
      ["Load shared memory", "Each thread copies one A + one B from global.", "__syncthreads() ensures all loads complete."],
      ["Dot product loop", "tmp += As[row][dotIdx] × Bs[dotIdx][col].", "Second __syncthreads() before next K chunk."],
      ["Writeback", "Store accumulated tmp into C[row][col].", ""]
    ];
    const cardX = 670, cardY = 100;
    for (let i = 0; i < cards.length; i++) {
      const y = cardY + i * 82;
      const on = i === active;
      roundRect(cardX, y, 480, 66, 7, on ? "#fef3c7" : "#fff", on ? "#b45309" : "#d8dde8");
      ctx.fillStyle = on ? "#78350f" : "#1d2433";
      ctx.font = "700 13px ui-sans-serif, system-ui";
      ctx.fillText(`${i + 1}. ${cards[i][0]}`, cardX + 12, y + 20);
      ctx.fillStyle = "#5b6475";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(cards[i][1], cardX + 12, y + 38);
      if (cards[i][2]) ctx.fillText(cards[i][2], cardX + 12, y + 54);
    }
  }

  // ── Stage 1: Thread ──

  function drawThreadStage(p) {
    const tid = 35;
    const tRow = Math.floor(tid / 32);
    const tCol = tid % 32;

    drawCallout(48, 92, [
      "Example: threadIdx.x = 35",
      "",
      "  threadRow = 35 / 32 = 1",
      "  threadCol = 35 % 32 = 3",
      "",
      "LOAD phase (one K chunk):",
      "  As[1][3] = A[1][3]  (global → shared)",
      "  Bs[1][3] = B[1][3]  (global → shared)",
      "",
      "COMPUTE phase:",
      "  for dotIdx in 0..31:",
      "    tmp += As[1][dotIdx] * Bs[dotIdx][3]",
      "",
      "This thread reads row 1 of As",
      "and column 3 of Bs from shared memory."
    ]);

    const asX = 480, asY = 92, sz = 180;
    drawSmemGrid("As (shared)", asX, asY, sz, "#dbeafe", "#2563eb");
    drawSmemGrid("Bs (shared)", asX + sz + 60, asY, sz, "#fef3c7", "#b45309");

    const cell = sz / 8;
    const loadR = Math.floor(tRow / 4);
    const loadC = Math.floor(tCol / 4);
    ctx.fillStyle = "rgba(190, 18, 60, 0.45)";
    ctx.fillRect(asX + loadC * cell, asY + loadR * cell, cell, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(asX + loadC * cell, asY + loadR * cell, cell, cell);
    ctx.fillStyle = "#be123c";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("load", asX + loadC * cell + cell + 4, asY + loadR * cell + cell / 2 + 3);

    ctx.fillStyle = "rgba(190, 18, 60, 0.45)";
    ctx.fillRect(asX + sz + 60 + loadC * cell, asY + loadR * cell, cell, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(asX + sz + 60 + loadC * cell, asY + loadR * cell, cell, cell);

    ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
    ctx.fillRect(asX, asY + loadR * cell, sz, cell);
    ctx.fillStyle = "#2563eb";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("← reads row 1 of As", asX + sz + 4, asY + loadR * cell + cell / 2 + 3);

    const bsX = asX + sz + 60;
    ctx.fillStyle = "rgba(180, 83, 9, 0.15)";
    ctx.fillRect(bsX + loadC * cell, asY, cell, sz);
    ctx.fillStyle = "#b45309";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("↑ reads col 3 of Bs", bsX + loadC * cell - 10, asY + sz + 28);

    roundRect(480, 350, 460, 90, 7, "#ede9fe", "#6d28d9");
    ctx.fillStyle = "#6d28d9";
    ctx.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("tmp += As[1][dotIdx] * Bs[dotIdx][3]", 500, 382);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("dotIdx sweeps 0..31 — reads from shared memory, not global", 500, 405);
    ctx.fillText("register 'tmp' accumulates across all K chunks", 500, 423);

    drawCallout(480, 470, [
      "Key: this thread loads 1 A + 1 B from global",
      "but READS 32 As values + 32 Bs values from shared.",
      "That's 32× reuse per loaded element."
    ]);
  }

  // ── Stage 2: Warp ──

  function drawWarpStage(p) {
    drawCallout(48, 92, [
      "Warp 1: threadIdx.x = 32..63",
      "",
      "  All 32 threads have threadRow = 1",
      "  threadCol = 0, 1, 2, ... 31",
      "",
      "LOAD phase:",
      "  32 threads load As[1][0..31] (one row)",
      "  32 threads load Bs[1][0..31] (one row)",
      "  → 2 coalesced global memory reads",
      "",
      "COMPUTE phase:",
      "  All 32 threads read As[1][0..31]",
      "    (same row — broadcast-friendly)",
      "  Thread k reads Bs[dotIdx][k]",
      "    (each reads a different column)"
    ]);

    const asX = 500, asY = 92, sz = 180;
    drawSmemGrid("As (shared)", asX, asY, sz, "#dbeafe", "#2563eb");
    drawSmemGrid("Bs (shared)", asX + sz + 50, asY, sz, "#fef3c7", "#b45309");

    const cell = sz / 8;
    const rowIdx = 0;
    const a = 0.2 + 0.1 * Math.sin(p * Math.PI * 2);
    ctx.fillStyle = `rgba(190, 18, 60, ${a + 0.15})`;
    ctx.fillRect(asX, asY + rowIdx * cell, sz, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(asX, asY + rowIdx * cell, sz, cell);
    ctx.fillStyle = "#be123c";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("warp 1 loads this row", asX, asY + sz + 28);

    ctx.fillStyle = `rgba(190, 18, 60, ${a + 0.15})`;
    ctx.fillRect(asX + sz + 50, asY + rowIdx * cell, sz, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(asX + sz + 50, asY + rowIdx * cell, sz, cell);
    ctx.fillStyle = "#be123c";
    ctx.fillText("warp 1 loads this row", asX + sz + 50, asY + sz + 28);

    drawCallout(500, 370, [
      "Load: each thread in warp 1 loads one element",
      "from A row 1 and one element from B row 1.",
      "",
      "Compute: all 32 threads read the ENTIRE",
      "row 1 of As (shared mem broadcast), but",
      "each reads its own column of Bs.",
      "",
      "Global loads: 32 + 32 = 64 per warp per K chunk",
      "Shared reads: 32 × (32 + 32) = 2048 per warp"
    ]);

    roundRect(500, 580, 440, 50, 7, "#dcfce7", "#118a4b");
    ctx.fillStyle = "#118a4b";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("32× reuse: 64 global loads → 2048 shared reads", 520, 611);
  }

  // ── Stage 3: Block ──

  function drawBlockStage(p) {
    const asX = 48, asY = 100, sz = 200;
    drawSmemGrid("As (shared) — 32×32", asX, asY, sz, "#dbeafe", "#2563eb");
    drawSmemGrid("Bs (shared) — 32×32", asX + sz + 40, asY, sz, "#fef3c7", "#b45309");

    const cell = sz / 8;
    const a = 0.15 + 0.1 * Math.sin(p * Math.PI * 2);
    for (let w = 0; w < 8; w++) {
      ctx.fillStyle = `rgba(190, 18, 60, ${w === 0 ? a + 0.15 : a})`;
      ctx.fillRect(asX, asY + w * cell, sz, cell);
      ctx.fillRect(asX + sz + 40, asY + w * cell, sz, cell);
    }

    ctx.fillStyle = "#be123c";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("32 warps load all 32 rows (shown as 8 groups)", asX, asY + sz + 28);

    drawArrow(asX + sz / 2, asY + sz + 40, asX + sz / 2, asY + sz + 70, "#be123c", ease(p));

    roundRect(48, asY + sz + 75, 440, 70, 7, "#ffe4e6", "#be123c");
    ctx.fillStyle = "#be123c";
    ctx.font = "700 15px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("__syncthreads()", 68, asY + sz + 103);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("barrier: all 1024 threads must finish loading before any reads", 68, asY + sz + 125);

    const rx = 530, ry = 92;
    roundRect(rx, ry, 620, 300, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Block (0,0): cooperative load + reuse", rx + 14, ry + 26);

    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    const info = [
      "1024 threads work together:",
      "",
      "LOAD: each thread loads 1 A + 1 B element",
      "  → 1024 A loads + 1024 B loads = 2048 global reads",
      "  → fills entire 32×32 As and 32×32 Bs",
      "",
      "COMPUTE: each thread does 32 multiply-adds",
      "  → reads 32 As values + 32 Bs values from shared",
      "  → 1024 threads × 64 reads = 65,536 shared reads",
      "",
      "REUSE RATIO:",
      "  2048 global loads → 65,536 shared reads",
      "  = 32× data reuse per K chunk",
      "",
      "Each As element: loaded by 1 thread, read by 32",
      "Each Bs element: loaded by 1 thread, read by 32"
    ];
    for (let i = 0; i < info.length; i++) {
      ctx.fillStyle = info[i].startsWith("REUSE") ? "#118a4b" : (info[i] === "" ? "transparent" : "#1d2433");
      if (info[i].startsWith("REUSE")) ctx.font = "700 13px ui-sans-serif, system-ui";
      else ctx.font = "13px ui-sans-serif, system-ui";
      ctx.fillText(info[i], rx + 14, ry + 52 + i * 17);
    }

    roundRect(530, 410, 620, 88, 7, "#eef2f7", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText("Two barriers per K chunk", 550, 436);
    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillText("1st __syncthreads(): after load — no thread reads As/Bs until all loads complete", 550, 460);
    ctx.fillText("2nd __syncthreads(): after compute — no thread overwrites As/Bs until all reads complete", 550, 480);

    roundRect(530, 516, 620, 52, 7, "#dcfce7", "#118a4b");
    ctx.fillStyle = "#118a4b";
    ctx.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("global: 2048 loads/chunk  |  shared: 65536 reads/chunk  |  32× reuse", 546, 548);
  }

  // ── Stage 4: Grid ──

  function drawGridStage(p) {
    const gx = 420, gy = 110, gs = 320;
    const cells = 4;
    const cellS = gs / cells;

    roundRect(gx - 14, gy - 38, gs + 28, gs + 68, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText("C matrix (M=N=128) → 4×4 grid", gx, gy - 14);

    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const hit = r === 0 && c === 0;
        ctx.fillStyle = hit ? "#dcfce7" : "#f8fafc";
        ctx.strokeStyle = hit ? "#118a4b" : "#d8dde8";
        ctx.lineWidth = hit ? 3 : 1;
        ctx.fillRect(gx + c * cellS, gy + r * cellS, cellS, cellS);
        ctx.strokeRect(gx + c * cellS, gy + r * cellS, cellS, cellS);

        ctx.fillStyle = hit ? "#118a4b" : "#5b6475";
        ctx.font = "11px ui-sans-serif, system-ui";
        ctx.fillText(`(${r},${c})`, gx + c * cellS + 8, gy + r * cellS + 20);

        ctx.fillStyle = "#2563eb";
        ctx.font = "9px ui-sans-serif, system-ui";
        ctx.fillText("As", gx + c * cellS + 8, gy + r * cellS + 38);
        ctx.fillStyle = "#b45309";
        ctx.fillText("Bs", gx + c * cellS + 8, gy + r * cellS + 50);
      }
    }
    pulseRect(gx, gy, cellS, cellS, "#118a4b", p);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each block has its own private As and Bs", gx, gy + gs + 20);

    drawCallout(48, 110, [
      "Shared memory is per-block:",
      "",
      "  Block (0,0) has its own As, Bs",
      "  Block (0,1) has its own As, Bs",
      "  Block (1,0) has its own As, Bs",
      "  …etc",
      "",
      "Threads in different blocks",
      "CANNOT share data via smem.",
      "",
      "Each block independently loads",
      "its own A and B tiles from",
      "global memory."
    ]);

    drawCallout(800, 110, [
      "For block (r,c), first K chunk:",
      "",
      "  As = A[r*32..(r+1)*32-1]",
      "          [0..31]",
      "  Bs = B[0..31]",
      "          [c*32..(c+1)*32-1]",
      "",
      "Then A ptr advances by 32 cols,",
      "B ptr advances by 32 rows,",
      "and the next K chunk loads."
    ]);

    drawCallout(800, 410, [
      "Shared memory on the GPU:",
      "",
      "  ~100 KB per SM",
      "  ~100× faster than global",
      "  Lifetime: one block execution",
      "",
      "This is why loading into smem",
      "and reusing is so effective."
    ]);
  }

  // ── Stage 5: Overview ──

  function drawOverviewStage(p) {
    // ── Grid level (top-left) ──
    const gx = 40, gy = 100, gs = 140;
    const cells = 4, cellS = gs / cells;
    roundRect(gx - 6, gy - 26, gs + 12, gs + 42, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Grid: C matrix", gx, gy - 8);
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const hit = r === 0 && c === 1;
        ctx.fillStyle = hit ? "#dcfce7" : "#f8fafc";
        ctx.strokeStyle = hit ? "#118a4b" : "#d8dde8";
        ctx.lineWidth = hit ? 2.5 : 1;
        ctx.fillRect(gx + c * cellS, gy + r * cellS, cellS, cellS);
        ctx.strokeRect(gx + c * cellS, gy + r * cellS, cellS, cellS);
        if (hit) {
          ctx.fillStyle = "#118a4b";
          ctx.font = "9px ui-sans-serif, system-ui";
          ctx.fillText("(0,1)", gx + c * cellS + 3, gy + r * cellS + 14);
        }
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "9px ui-sans-serif, system-ui";
    ctx.fillText("each block has private As, Bs", gx, gy + gs + 12);

    // ── Zoom arrow: grid → block ──
    drawArrow(gx + gs + 10, gy + cellS / 2, 230, gy + cellS / 2, "#118a4b", ease(p));

    // ── Dashed zoom lines ──
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = "#9aa7bb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + cellS + cellS, gy);
    ctx.lineTo(240, gy - 14);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx + cellS + cellS, gy + cellS);
    ctx.lineTo(240, gy + 200);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Block level (middle) ──
    const bx = 240, by = 86;
    roundRect(bx - 6, by - 26, 250, 238, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Block (0,1)", bx, by - 8);

    // As and Bs mini grids
    const smSz = 80, smCell = smSz / 8;
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("As", bx + 4, by + 14);
    ctx.fillText("Bs", bx + smSz + 30, by + 14);
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const isWarpRow = r === 0;
        ctx.fillStyle = isWarpRow ? "rgba(190, 18, 60, 0.15)" : "#dbeafe";
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 0.5;
        ctx.fillRect(bx + 4 + c * smCell, by + 20 + r * smCell, smCell, smCell);
        ctx.strokeRect(bx + 4 + c * smCell, by + 20 + r * smCell, smCell, smCell);

        ctx.fillStyle = isWarpRow ? "rgba(190, 18, 60, 0.15)" : "#fef3c7";
        ctx.strokeStyle = "#b45309";
        ctx.fillRect(bx + smSz + 30 + c * smCell, by + 20 + r * smCell, smCell, smCell);
        ctx.strokeRect(bx + smSz + 30 + c * smCell, by + 20 + r * smCell, smCell, smCell);
      }
    }
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 4, by + 20, smSz, smCell);
    ctx.strokeRect(bx + smSz + 30, by + 20, smSz, smCell);
    ctx.fillStyle = "#be123c";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("warp 1 loads row 1", bx + 4, by + 20 + smSz + 14);

    // sync + compute
    roundRect(bx + 4, by + 130, 220, 28, 5, "#ffe4e6", "#be123c");
    ctx.fillStyle = "#be123c";
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("__syncthreads()", bx + 54, by + 148);

    roundRect(bx + 4, by + 166, 220, 28, 5, "#ede9fe", "#6d28d9");
    ctx.fillStyle = "#6d28d9";
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("tmp += As[row][d] * Bs[d][col]", bx + 20, by + 184);

    // ── Zoom arrow: block → warp ──
    drawArrow(bx + 244, by + 30, 530, by + 30, "#be123c", ease(p));

    // ── Warp level (right-top) ──
    const wx = 530, wy = 86;
    roundRect(wx - 6, wy - 26, 300, 120, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Warp 1: threadIdx.x 32..63", wx, wy - 8);
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("threadRow = 1 for all, threadCol = 0..31", wx, wy + 12);

    const tw = 24;
    for (let i = 0; i < 8; i++) {
      const a2 = 0.15 + 0.08 * Math.sin(p * Math.PI * 2);
      ctx.fillStyle = `rgba(190, 18, 60, ${a2 + 0.1})`;
      ctx.strokeStyle = "#be123c";
      ctx.lineWidth = 1.5;
      ctx.fillRect(wx + i * (tw + 2), wy + 24, tw, tw);
      ctx.strokeRect(wx + i * (tw + 2), wy + 24, tw, tw);
      ctx.fillStyle = "#1d2433";
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`t${32 + i}`, wx + i * (tw + 2) + 2, wy + 40);
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("… t63", wx + 8 * (tw + 2) + 4, wy + 40);
    ctx.fillText("LOAD: As[1][0..31], Bs[1][0..31] from global", wx, wy + 66);
    ctx.fillText("COMPUTE: reads row 1 of As + each col of Bs", wx, wy + 82);

    // ── Thread level (right-bottom) ──
    const tx = 530, ty = 220;
    roundRect(tx - 6, ty - 26, 300, 130, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Thread 35: threadRow=1, threadCol=3", tx, ty - 8);

    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("LOAD: As[1][3] = A[1][3]", tx, ty + 14);
    ctx.fillText("      Bs[1][3] = B[1][3]", tx, ty + 30);
    ctx.fillText("COMPUTE:", tx, ty + 52);
    ctx.fillStyle = "#6d28d9";
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("tmp += As[1][dotIdx] * Bs[dotIdx][3]", tx + 10, ty + 70);
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("reads 32 As + 32 Bs from shared → 1 C output", tx, ty + 90);

    // ── Matrix A and B on the bottom ──
    const matY = 380;
    roundRect(40, matY - 20, 500, 200, 7, "#f9fbff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Global memory (one K chunk)", 58, matY + 2);

    // Matrix A mini
    const maX = 60, maY = matY + 20, maW = 180, maH = 120;
    ctx.fillStyle = "#dbeafe";
    ctx.fillRect(maX, maY, maW, maH);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(maX, maY, maW, maH);
    const tileH = maH / 4;
    ctx.fillStyle = "rgba(37, 99, 235, 0.3)";
    ctx.fillRect(maX, maY, maW / 4, tileH);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(maX, maY, maW / 4, tileH);
    ctx.fillStyle = "#2563eb";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("A tile", maX + 4, maY + tileH / 2 + 4);
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Matrix A", maX, maY + maH + 16);
    ctx.fillStyle = "#5b6475";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("→ loaded into As", maX + 60, maY + maH + 16);

    // Matrix B mini
    const mbX = 300, mbY = matY + 20, mbW = 180, mbH = 120;
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(mbX, mbY, mbW, mbH);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mbX, mbY, mbW, mbH);
    const tileW = mbW / 4;
    ctx.fillStyle = "rgba(180, 83, 9, 0.3)";
    ctx.fillRect(mbX, mbY, tileW, mbH / 4);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.strokeRect(mbX, mbY, tileW, mbH / 4);
    ctx.fillStyle = "#b45309";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("B tile", mbX + 4, mbY + 18);
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Matrix B", mbX, mbY + mbH + 16);
    ctx.fillStyle = "#5b6475";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("→ loaded into Bs", mbX + 60, mbY + mbH + 16);

    // Arrows from global → smem
    drawArrow(maX + maW / 8, matY + 16, bx + 44, by + 20 + smSz, "#2563eb", ease(p));
    drawArrow(mbX + tileW / 2, matY + 16, bx + smSz + 70, by + 20 + smSz, "#b45309", ease(p));

    // ── Right summary ──
    roundRect(560, 380, 400, 200, 7, "#eef2f7", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Data flow summary", 578, 404);
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#5b6475";
    const lines = [
      "1. Grid tiles C into blocks",
      "2. Block(0,1) owns C[0..31][32..63]",
      "3. 32 warps cooperatively load A,B tiles",
      "   → global mem → shared mem (As, Bs)",
      "4. __syncthreads() barrier",
      "5. Each thread computes from shared mem",
      "   → 32 As reads + 32 Bs reads → 1 C",
      "6. __syncthreads(), next K chunk",
      "",
      "Per K chunk: 2048 global → 65536 shared"
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = lines[i].startsWith("Per") ? "#118a4b" : "#1d2433";
      ctx.font = lines[i].startsWith("Per") ? "700 12px ui-sans-serif, system-ui" : "11.5px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(lines[i], 578, 426 + i * 16);
    }

    // ── Bottom summary ──
    roundRect(40, 600, 920, 40, 7, "#dcfce7", "#118a4b");
    ctx.fillStyle = "#118a4b";
    ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Grid → Block → cooperative load (global→shared) → __sync → compute from shared → 32× reuse", 58, 626);
  }

  // ── Stage 6: Why faster ──

  function drawWhyFasterStage(p) {
    roundRect(40, 100, 370, 340, 8, "#fff7ed", "#be123c");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 2 — global memory only", 58, 130);

    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    const k2Lines = [
      "Each thread reads A[row][i] and B[i][col]",
      "directly from global memory.",
      "",
      "Per K step, warp w reads:",
      "  A[w][i]      → 1 value (broadcast)",
      "  B[i][0..31]  → 32 values (coalesced)",
      "",
      "But ALL 32 warps need B[i][0..31].",
      "Each warp fetches them independently.",
      "",
      "Per block per K step:",
      "  A: 32 unique values (OK)",
      "  B: 32 warps × 32 = 1024 loads",
      "     but only 32 unique values!",
      "     → 31 redundant loads per value",
      "",
      "Full K:  A = 32K,  B = up to 1024K"
    ];
    for (let i = 0; i < k2Lines.length; i++) {
      ctx.fillStyle = k2Lines[i].startsWith("     →") ? "#be123c" : "#1d2433";
      ctx.font = k2Lines[i].startsWith("     →") ? "700 13px ui-sans-serif, system-ui" : "12.5px ui-sans-serif, system-ui";
      ctx.fillText(k2Lines[i], 58, 156 + i * 17);
    }

    drawArrow(420, 270, 448, 270, "#118a4b", ease(p));

    roundRect(458, 100, 370, 340, 8, "#e8f7ef", "#118a4b");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 3 — shared memory", 476, 130);

    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    const k3Lines = [
      "The block cooperatively loads A and B",
      "tiles into shared memory first.",
      "",
      "Per K chunk (32-wide):",
      "  1024 threads load 32×32 A tile",
      "  1024 threads load 32×32 B tile",
      "  = 2048 global reads total",
      "",
      "Then ALL 1024 threads compute from",
      "shared memory (no global reads).",
      "",
      "Per block per K chunk:",
      "  A: 1024 loads (each unique)",
      "  B: 1024 loads (each unique)",
      "  → 0 redundant loads",
      "",
      "Full K:  A = 32K,  B = 32K  (64K total)"
    ];
    for (let i = 0; i < k3Lines.length; i++) {
      ctx.fillStyle = k3Lines[i].startsWith("  → 0") ? "#118a4b" : "#1d2433";
      ctx.font = k3Lines[i].startsWith("  → 0") ? "700 13px ui-sans-serif, system-ui" : "12.5px ui-sans-serif, system-ui";
      ctx.fillText(k3Lines[i], 476, 156 + i * 17);
    }

    roundRect(850, 100, 310, 340, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Why kernel 3 is faster", 870, 130);

    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    const whyLines = [
      "Same math, same C tile per block.",
      "",
      "The difference: data reuse.",
      "",
      "Kernel 2 B traffic (per block):",
      "  32 warps × 32 × K = 1024K",
      "",
      "Kernel 3 B traffic (per block):",
      "  32 × K = 32K",
      "",
      "Ratio: 1024K / 32K = 32×",
      "fewer B reads from global.",
      "",
      "Shared memory is ~100× faster",
      "than global memory, so even the",
      "shared reads are nearly free."
    ];
    for (let i = 0; i < whyLines.length; i++) {
      ctx.fillStyle = whyLines[i].startsWith("Ratio") ? "#118a4b" : "#1d2433";
      ctx.font = whyLines[i].startsWith("Ratio") ? "700 13px ui-sans-serif, system-ui" : "13px ui-sans-serif, system-ui";
      ctx.fillText(whyLines[i], 870, 156 + i * 17);
    }

    roundRect(40, 470, 1120, 52, 7, "#eef2f7", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Kernel 2: B reads = 1024K (32× redundant)   →   Kernel 3: B reads = 32K (0 redundant)   =   32× less global traffic", 62, 502);

    roundRect(40, 540, 1120, 52, 7, "#dcfce7", "#118a4b");
    ctx.fillStyle = "#118a4b";
    ctx.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("load once from global → store in shared memory → reused by 32 threads → 32× bandwidth savings", 62, 572);
  }

  // ── Drawing primitives ──

  function drawSmemGrid(title, x, y, size, fill, stroke) {
    roundRect(x - 8, y - 30, size + 16, size + 48, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 10);
    const cells = 8;
    const cell = size / cells;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.8;
        ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
        ctx.strokeRect(x + c * cell, y + r * cell, cell, cell);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("shown as 8×8 (actual 32×32)", x, y + size + 14);
  }

  function drawBg() {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#e3e8f2";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  }

  function drawHeader() {
    const s = stages[stageIndex];
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 22px ui-sans-serif, system-ui";
    ctx.fillText(`${stageIndex + 1}. ${s.title}`, 28, 38);
    ctx.fillStyle = "#5b6475";
    ctx.font = "14px ui-sans-serif, system-ui";
    ctx.fillText(s.note, 28, 62);
    roundRect(620, 10, 550, 36, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "11.5px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(s.codeLine, 632, 33);
  }

  function drawCallout(x, y, lines) {
    const lh = 20;
    const w = Math.max(...lines.map(l => measure(l))) + 28;
    const h = lines.length * lh + 22;
    roundRect(x, y, w, h, 8, "#f9fbff", "#d8dde8");
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = lines[i] === "" ? "transparent" : "#1d2433";
      ctx.fillText(lines[i], x + 14, y + 24 + i * lh);
    }
  }

  function drawArrow(x1, y1, x2, y2, color, progress) {
    const x = x1 + (x2 - x1) * progress;
    const y = y1 + (y2 - y1) * progress;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x, y); ctx.stroke();
    if (progress > 0.12) {
      const a = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12 * Math.cos(a - 0.5), y - 12 * Math.sin(a - 0.5));
      ctx.lineTo(x - 12 * Math.cos(a + 0.5), y - 12 * Math.sin(a + 0.5));
      ctx.closePath(); ctx.fill();
    }
  }

  function pulseRect(x, y, w, h, color, progress) {
    const a = 0.18 + 0.18 * Math.sin(progress * Math.PI * 2);
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = colorWithAlpha(color, a);
    ctx.fillRect(x, y, w, h);
  }

  function roundRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill !== "transparent") { ctx.fillStyle = fill; ctx.fill(); }
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
  }

  function measure(t) {
    ctx.save();
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    const w = ctx.measureText(t).width;
    ctx.restore();
    return w;
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function colorWithAlpha(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  function hotspotAt(e) {
    if (stageIndex !== 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    const hit = codeHotspots.find(s =>
      x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h);
    return hit ? hit.step : null;
  }

  setupCanvas();
  updateTabs();
  requestAnimationFrame(tick);
})();
