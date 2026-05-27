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
      note: "Read the kernel in execution order. Click a code line to pin the matching explanation.",
      codeLine: "sgemm_global_mem_coalesce<32><<<grid, 1024>>>(…)"
    },
    {
      title: "Thread",
      note: "One thread computes one C element. threadIdx.x encodes both row and column.",
      codeLine: "row = blockIdx.x*32 + threadIdx.x/32;  col = blockIdx.y*32 + threadIdx.x%32;"
    },
    {
      title: "Warp",
      note: "Warp 0 = threadIdx.x 0..31 → row 0, cols 0..31. The warp is horizontal.",
      codeLine: "A[0][i] broadcast;  B[i][0..31] coalesced;  C[0][0..31] coalesced"
    },
    {
      title: "Block",
      note: "32 warps = 32 rows. One block of 1024 threads covers one 32×32 C tile.",
      codeLine: "blockDim = 1024;  gridDim = (⌈M/32⌉, ⌈N/32⌉)"
    },
    {
      title: "Grid",
      note: "The grid repeats the same block program across the full C matrix.",
      codeLine: "gridDim = (⌈M/32⌉, ⌈N/32⌉) → one block per 32×32 C tile"
    },
    {
      title: "Overview",
      note: "All four levels in one picture: Grid → Block → Warp → Thread, with memory access at each level.",
      codeLine: "grid → block(0,1) → warp 0 [t0..t31] → A broadcast, B consecutive"
    },
    {
      title: "Why faster",
      note: "Kernel 1 → vertical warp (strided memory). Kernel 2 → horizontal warp (coalesced memory).",
      codeLine: "same math, different threadIdx mapping → coalesced B/C"
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
    const cx = 58, cy = 108;
    codeHotspots.length = 0;
    const active = selectedCodeStep ?? Math.min(4, Math.floor(p * 5));

    const lines = [
      "// Launch: gridDim=(⌈M/32⌉,⌈N/32⌉), blockDim=1024",
      "",
      "row = blockIdx.x * 32 + threadIdx.x / 32;",
      "col = blockIdx.y * 32 + threadIdx.x % 32;",
      "",
      "if (row < M && col < N) {",
      "  float sum = 0.0f;",
      "  for (int i = 0; i < K; ++i) {",
      "    sum += A[row*K + i] * B[i*N + col];",
      "  }",
      "  C[row*N+col] = alpha*sum + beta*C[row*N+col];",
      "}"
    ];

    const groupOf = (i) => {
      if (i <= 1) return 0;
      if (i <= 4) return 1;
      if (i === 5) return 2;
      if (i <= 9) return 3;
      return 4;
    };

    roundRect(cx - 18, cy - 34, 640, 400, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 2 source", cx, cy - 10);

    for (let i = 0; i < lines.length; i++) {
      const g = groupOf(i);
      const on = g === active;
      codeHotspots.push({ x: cx - 8, y: cy + i * 28 + 4, w: 610, h: 24, step: g });
      if (on) roundRect(cx - 8, cy + i * 28 + 4, 610, 24, 5, "#e8f7ef", "#118a4b");
      ctx.fillStyle = on ? "#14532d" : "#1d2433";
      ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(lines[i], cx, cy + i * 28 + 21);
    }

    const cards = [
      ["Launch config", "gridDim tiles C into 32×32 blocks.", "blockDim = 1024 (1D)."],
      ["Thread → row, col", "threadIdx.x / 32 = local row.", "threadIdx.x % 32 = local col."],
      ["Bounds check", "Threads beyond M×N are skipped.", ""],
      ["K loop", "Each thread accumulates one C element.", "sum += A[row][i] × B[i][col]"],
      ["Writeback", "Store final sum into C[row][col].", ""]
    ];
    const cardX = 720, cardY = 108;
    for (let i = 0; i < cards.length; i++) {
      const y = cardY + i * 88;
      const on = i === active;
      roundRect(cardX, y, 410, 70, 7, on ? "#fef3c7" : "#fff", on ? "#b45309" : "#d8dde8");
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
    const row = Math.floor(tid / 32);
    const col = tid % 32;

    drawCallout(58, 100, [
      "Example: threadIdx.x = 35",
      "",
      "  row = blockIdx.x*32 + 35/32 = 0*32 + 1 = 1",
      "  col = blockIdx.y*32 + 35%32 = 0*32 + 3 = 3",
      "",
      "This thread computes C[1][3].",
      "",
      "It loops over K:",
      "  for i in 0..K-1:",
      "    sum += A[1][i] * B[i][3]",
      "",
      "One thread = one output element."
    ]);

    const tileX = 620, tileY = 100, tileS = 340;
    drawTile32("C tile (block 0,0): rows 0..31, cols 0..31", tileX, tileY, tileS);

    const cellS = tileS / 32;
    ctx.fillStyle = "rgba(37, 99, 235, 0.15)";
    ctx.fillRect(tileX, tileY + row * cellS, tileS, cellS);
    ctx.fillStyle = "rgba(180, 83, 9, 0.15)";
    ctx.fillRect(tileX + col * cellS, tileY, cellS, tileS);

    ctx.fillStyle = "rgba(190, 18, 60, 0.35)";
    ctx.fillRect(tileX + col * cellS, tileY + row * cellS, cellS, cellS);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3;
    ctx.strokeRect(tileX + col * cellS, tileY + row * cellS, cellS, cellS);

    drawDot(tileX + col * cellS + cellS / 2, tileY + row * cellS + cellS / 2, "#be123c", 5);

    ctx.fillStyle = "#be123c";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("C[1][3] ← this thread", tileX + col * cellS + cellS + 6, tileY + row * cellS + cellS / 2 + 4);

    ctx.fillStyle = "#2563eb";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("← row 1 of A", tileX + tileS + 8, tileY + row * cellS + cellS / 2 + 20);

    ctx.fillStyle = "#b45309";
    ctx.fillText("↑ col 3 of B", tileX + col * cellS - 4, tileY + tileS + 22);

    roundRect(620, 500, 370, 70, 7, "#ede9fe", "#6d28d9");
    ctx.fillStyle = "#6d28d9";
    ctx.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("sum += A[1][i] * B[i][3]", 640, 530);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("register accumulates across K iterations", 640, 553);
  }

  // ── Stage 2: Warp ──

  function drawWarpStage(p) {
    const tileX = 58, tileY = 100, tileS = 300;
    drawTile32("C tile — warp 0 highlighted", tileX, tileY, tileS);

    const cellS = tileS / 32;
    const alpha = 0.2 + 0.1 * Math.sin(p * Math.PI * 2);
    ctx.fillStyle = `rgba(190, 18, 60, ${alpha})`;
    ctx.fillRect(tileX, tileY, tileS, cellS);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3;
    ctx.strokeRect(tileX, tileY, tileS, cellS);

    ctx.fillStyle = "#be123c";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("warp 0: row 0, cols 0..31", tileX, tileY + tileS + 22);

    const mapX = 58, mapY = 460;
    roundRect(mapX, mapY, 300, 90, 7, "#f9fbff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Thread → position mapping", mapX + 12, mapY + 20);
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#5b6475";
    ctx.fillText("threadIdx.x  0   1   2  ... 31", mapX + 12, mapY + 42);
    ctx.fillText("row          0   0   0  ...  0", mapX + 12, mapY + 58);
    ctx.fillText("col          0   1   2  ... 31", mapX + 12, mapY + 74);

    const ax = 400, ay = 100;
    roundRect(ax, ay, 380, 260, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Memory access pattern (one K step)", ax + 14, ay + 26);

    drawAccessBar(ax + 14, ay + 50, "A", "A[0][i]", "all 32 lanes read same addr", "broadcast", "#2563eb", "#ede9fe", "#6d28d9");
    drawAccessBar(ax + 14, ay + 120, "B", "B[i][0], B[i][1], … B[i][31]", "32 consecutive addresses", "coalesced", "#b45309", "#dcfce7", "#118a4b");
    drawAccessBar(ax + 14, ay + 190, "C", "C[0][0], C[0][1], … C[0][31]", "32 consecutive addresses", "coalesced", "#118a4b", "#dcfce7", "#118a4b");

    drawCallout(400, 390, [
      "Key insight: all warp 0 threads share row = 0.",
      "They differ only in col = 0..31.",
      "",
      "So B[i][col] and C[0][col] are consecutive",
      "addresses → the GPU coalesces them into one",
      "memory transaction (128 bytes per warp)."
    ]);
  }

  function drawAccessBar(x, y, name, detail, desc, label, dotColor, badgeFill, badgeStroke) {
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText(name, x, y + 14);

    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(detail, x + 26, y + 14);

    roundRect(x + 26, y + 24, 240, 28, 5, "#f8fafc", "#d8dde8");
    if (label === "broadcast") {
      ctx.fillStyle = colorWithAlpha(dotColor, 0.6);
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.arc(x + 140 + Math.sin(i * 0.8) * 3, y + 38, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 32; i++) {
        ctx.fillStyle = colorWithAlpha(dotColor, 0.3);
        ctx.fillRect(x + 30 + i * 7.2, y + 27, 7, 22);
      }
      ctx.strokeStyle = dotColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 30, y + 27, 32 * 7.2, 22);
    }

    roundRect(x + 280, y + 27, 68, 24, 5, badgeFill, badgeStroke);
    ctx.fillStyle = badgeStroke;
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText(label, x + 289, y + 43);

    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText(desc, x + 26, y + 66);
  }

  // ── Stage 3: Block ──

  function drawBlockStage(p) {
    const tileX = 58, tileY = 100, tileS = 340;
    drawTile32("Block (0,0): 32 warps = 32 rows", tileX, tileY, tileS);

    const cellS = tileS / 32;
    for (let w = 0; w < 32; w++) {
      const isW0 = w === 0;
      const a = isW0 ? 0.25 + 0.1 * Math.sin(p * Math.PI * 2) : 0.08;
      ctx.fillStyle = `rgba(190, 18, 60, ${a})`;
      ctx.fillRect(tileX, tileY + w * cellS, tileS, cellS);
      if (w % 8 === 0) {
        ctx.strokeStyle = isW0 ? "#be123c" : "rgba(190, 18, 60, 0.3)";
        ctx.lineWidth = isW0 ? 2.5 : 0.8;
        ctx.strokeRect(tileX, tileY + w * cellS, tileS, cellS * 8);
      }
    }

    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(tileX, tileY, tileS, cellS);

    const labelY = tileY + tileS + 14;
    ctx.fillStyle = "#be123c";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("warp 0 → row 0", tileX, labelY);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("warp 1 → row 1  …  warp 31 → row 31", tileX, labelY + 18);

    drawCallout(440, 100, [
      "Block structure:",
      "",
      "  blockDim = 1024  (1D)",
      "  = 32 warps × 32 lanes",
      "",
      "  warp w → row w, cols 0..31",
      "",
      "All 32 warps together tile",
      "one 32×32 region of C.",
      "",
      "Each warp is horizontal →",
      "every warp gets coalesced",
      "B loads and C stores."
    ]);

    drawCallout(440, 430, [
      "Launch config:",
      "",
      "  gridDim = (⌈M/32⌉, ⌈N/32⌉)",
      "  blockDim = (1024)",
      "",
      "One block = one 32×32 C tile.",
      "One thread = one C element."
    ]);

    roundRect(800, 100, 340, 168, 7, "#f9fbff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText("Warp → C row mapping", 818, 126);
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#be123c";
    ctx.fillText("warp  0: threadIdx.x  0..31  → row 0", 818, 150);
    ctx.fillStyle = "#5b6475";
    ctx.fillText("warp  1: threadIdx.x 32..63  → row 1", 818, 170);
    ctx.fillText("warp  2: threadIdx.x 64..95  → row 2", 818, 190);
    ctx.fillText("  ⋮", 818, 210);
    ctx.fillText("warp 31: threadIdx.x 992..1023 → row 31", 818, 230);
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("row = threadIdx.x / 32", 818, 254);
  }

  // ── Stage 4: Grid ──

  function drawGridStage(p) {
    const gx = 400, gy = 120, gs = 360;
    const cells = 4;
    const cellS = gs / cells;

    roundRect(gx - 14, gy - 40, gs + 28, gs + 68, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText("C matrix (M=N=128) → 4×4 grid of blocks", gx, gy - 16);

    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const hit = r === 0 && c === 0;
        ctx.fillStyle = hit ? "#dcfce7" : "#f8fafc";
        ctx.strokeStyle = hit ? "#118a4b" : "#d8dde8";
        ctx.lineWidth = hit ? 3 : 1;
        ctx.fillRect(gx + c * cellS, gy + r * cellS, cellS, cellS);
        ctx.strokeRect(gx + c * cellS, gy + r * cellS, cellS, cellS);
        ctx.fillStyle = hit ? "#118a4b" : "#5b6475";
        ctx.font = "12px ui-sans-serif, system-ui";
        ctx.fillText(`(${r},${c})`, gx + c * cellS + cellS / 2 - 14, gy + r * cellS + cellS / 2 + 4);
      }
    }
    pulseRect(gx, gy, cellS, cellS, "#118a4b", p);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each cell = one 32×32 C tile = one block", gx, gy + gs + 20);

    drawCallout(58, 120, [
      "Grid:",
      "",
      "  gridDim.x = ⌈M / 32⌉ = 4",
      "  gridDim.y = ⌈N / 32⌉ = 4",
      "",
      "  16 blocks total",
      "  1024 threads each",
      "  = 16384 threads",
      "",
      "Block (r,c) computes:",
      "  C rows r*32..(r+1)*32-1",
      "  C cols c*32..(c+1)*32-1"
    ]);

    drawCallout(800, 120, [
      "Every block runs the same",
      "kernel program:",
      "",
      "  1. Map threadIdx → row, col",
      "  2. Loop over K",
      "  3. Write one C element",
      "",
      "blockIdx shifts which 32×32",
      "region of C this block owns."
    ]);
  }

  // ── Stage 5: Overview ──

  function drawOverviewStage(p) {
    // ── Grid level (left) ──
    const gx = 40, gy = 110, gs = 160;
    const cells = 4, cellS = gs / cells;
    roundRect(gx - 8, gy - 30, gs + 16, gs + 50, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Grid: C matrix", gx, gy - 10);
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
          ctx.font = "10px ui-sans-serif, system-ui";
          ctx.fillText("(0,1)", gx + c * cellS + 4, gy + r * cellS + 16);
        }
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("block(0,1) computes green tile", gx, gy + gs + 14);

    // ── Zoom arrow: grid → block ──
    drawArrow(gx + gs + 12, gy + cellS / 2, gx + gs + 50, gy + cellS / 2, "#118a4b", ease(p));

    // ── Block level (middle-left) ──
    const bx = 260, by = 92, bs = 200;
    roundRect(bx - 8, by - 30, bs + 16, bs + 50, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Block (0,1): 32×32 C tile", bx, by - 10);

    const bcell = bs / 8;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        ctx.fillStyle = r === 0 ? "rgba(190, 18, 60, 0.12)" : "#f8fafc";
        ctx.strokeStyle = "#e3e8f2";
        ctx.lineWidth = 0.6;
        ctx.fillRect(bx + c * bcell, by + r * bcell, bcell, bcell);
        ctx.strokeRect(bx + c * bcell, by + r * bcell, bcell, bcell);
      }
    }
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(bx, by, bs, bcell);
    ctx.fillStyle = "#be123c";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("warp 0 → row 0", bx, by + bs + 14);
    ctx.fillStyle = "#5b6475";
    ctx.font = "10px ui-sans-serif, system-ui";
    ctx.fillText("warp 1 → row 1 … warp 31 → row 31", bx, by + bs + 28);

    // ── Zoom arrow: block → warp ──
    drawArrow(bx + bs + 12, by + bcell / 2, bx + bs + 44, by + bcell / 2, "#be123c", ease(p));

    // ── Warp level (middle-right) ──
    const wx = 520, wy = 92;
    roundRect(wx - 8, wy - 30, 260, 110, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Warp 0: threadIdx.x 0..31", wx, wy - 10);

    const tw = 28;
    for (let i = 0; i < 8; i++) {
      const a2 = 0.15 + 0.08 * Math.sin(p * Math.PI * 2);
      ctx.fillStyle = `rgba(190, 18, 60, ${a2 + 0.1})`;
      ctx.strokeStyle = "#be123c";
      ctx.lineWidth = 1.5;
      ctx.fillRect(wx + i * (tw + 2), wy, tw, tw);
      ctx.strokeRect(wx + i * (tw + 2), wy, tw, tw);
      ctx.fillStyle = "#1d2433";
      ctx.font = "10px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`t${i}`, wx + i * (tw + 2) + 6, wy + 17);
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("… t31", wx + 8 * (tw + 2) + 4, wy + 17);
    ctx.fillText("row = 0 for all, col = 0..31", wx, wy + 40);
    ctx.fillText("→ horizontal warp (1 row, 32 cols)", wx, wy + 56);

    // ── Memory access (right side) ──
    const mx = 520, my = 210;
    roundRect(mx - 8, my - 30, 460, 250, 7, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Memory access per K step (warp 0)", mx, my - 10);

    // A row
    ctx.fillStyle = "#2563eb";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("A", mx, my + 16);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("A[0][i] — all lanes same addr", mx + 20, my + 16);
    roundRect(mx + 20, my + 24, 200, 24, 5, "#f8fafc", "#d8dde8");
    ctx.fillStyle = "rgba(37, 99, 235, 0.55)";
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(mx + 110 + Math.sin(i * 0.8) * 3, my + 36, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    roundRect(mx + 230, my + 26, 72, 20, 4, "#ede9fe", "#6d28d9");
    ctx.fillStyle = "#6d28d9";
    ctx.font = "700 10px ui-sans-serif, system-ui";
    ctx.fillText("broadcast", mx + 239, my + 40);

    const drawBar = (label, detail, yOff, color, badgeText, badgeFill, badgeStroke) => {
      ctx.fillStyle = color;
      ctx.font = "700 13px ui-sans-serif, system-ui";
      ctx.fillText(label, mx, my + yOff);
      ctx.fillStyle = "#5b6475";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(detail, mx + 20, my + yOff);
      roundRect(mx + 20, my + yOff + 8, 200, 24, 5, "#f8fafc", "#d8dde8");
      for (let i = 0; i < 32; i++) {
        ctx.fillStyle = colorWithAlpha(color, 0.3);
        ctx.fillRect(mx + 24 + i * 6, my + yOff + 10, 5.5, 20);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(mx + 24, my + yOff + 10, 32 * 6, 20);
      roundRect(mx + 230, my + yOff + 10, 72, 20, 4, badgeFill, badgeStroke);
      ctx.fillStyle = badgeStroke;
      ctx.font = "700 10px ui-sans-serif, system-ui";
      ctx.fillText(badgeText, mx + 239, my + yOff + 24);
    };

    drawBar("B", "B[i][0..31] — consecutive", 72, "#b45309", "coalesced", "#dcfce7", "#118a4b");
    drawBar("C", "C[0][0..31] — consecutive", 128, "#118a4b", "coalesced", "#dcfce7", "#118a4b");

    ctx.fillStyle = "#118a4b";
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText("Horizontal warp → B and C are coalesced → fewer memory transactions", mx, my + 200);

    // ── Dashed zoom lines ──
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "#9aa7bb";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx + cellS + cellS, gy);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx + cellS + cellS, gy + cellS);
    ctx.lineTo(bx, by + bs);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Bottom summary ──
    roundRect(40, 590, 940, 44, 7, "#eef2f7", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Grid → Block(0,1) → 32 horizontal warps → warp 0 [t0..t31] → A broadcast, B coalesced, C coalesced", 58, 618);
  }

  // ── Stage 6: Why faster ──

  function drawWhyFasterStage(p) {
    drawCompPanel(50, 110, "Kernel 1 — vertical warp", "#fff7ed", "#be123c", [
      "blockDim = (32, 32)  → 2D",
      "warp 0 = threadIdx.x 0..31",
      "  → row 0..31, col 0",
      "  → VERTICAL"
    ], true);

    drawCompPanel(420, 110, "Kernel 2 — horizontal warp", "#e8f7ef", "#118a4b", [
      "blockDim = 1024  → 1D",
      "warp 0 = threadIdx.x 0..31",
      "  → row 0, col 0..31",
      "  → HORIZONTAL"
    ], false);

    drawArrow(370, 280, 410, 280, "#118a4b", ease(p));

    const tx = 50, ty = 380;
    roundRect(tx, ty, 340, 170, 7, "#fff7ed", "#be123c");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Memory pattern (warp 0)", tx + 14, ty + 22);
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#be123c";
    ctx.fillText("A[0..31][i]  → strided by K", tx + 14, ty + 50);
    ctx.fillText("B[i][0]      → same address", tx + 14, ty + 72);
    ctx.fillText("C[0..31][0]  → strided by N", tx + 14, ty + 94);
    roundRect(tx + 14, ty + 112, 100, 24, 5, "#ffe4e6", "#be123c");
    ctx.fillStyle = "#be123c";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("NOT coalesced", tx + 24, ty + 128);

    const tx2 = 420;
    roundRect(tx2, ty, 340, 170, 7, "#e8f7ef", "#118a4b");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("Memory pattern (warp 0)", tx2 + 14, ty + 22);
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#118a4b";
    ctx.fillText("A[0][i]      → broadcast", tx2 + 14, ty + 50);
    ctx.fillText("B[i][0..31]  → consecutive", tx2 + 14, ty + 72);
    ctx.fillText("C[0][0..31]  → consecutive", tx2 + 14, ty + 94);
    roundRect(tx2 + 14, ty + 112, 76, 24, 5, "#dcfce7", "#118a4b");
    ctx.fillStyle = "#118a4b";
    ctx.font = "700 11px ui-sans-serif, system-ui";
    ctx.fillText("coalesced", tx2 + 24, ty + 128);

    roundRect(790, 110, 360, 440, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Why kernel 2 is faster", 810, 142);

    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    const lines = [
      "Both kernels compute the same math:",
      "  one thread → one C element",
      "  one block  → one 32×32 C tile",
      "",
      "The ONLY change is the threadIdx",
      "mapping inside each block:",
      "",
      "  Kernel 1: 2D (32,32)",
      "    warp = 32 rows × 1 col → vertical",
      "",
      "  Kernel 2: 1D (1024)",
      "    warp = 1 row × 32 cols → horizontal",
      "",
      "A horizontal warp means adjacent",
      "threads access adjacent memory addresses",
      "for B and C. The GPU combines these into",
      "fewer, wider memory transactions.",
      "",
      "This is called memory coalescing."
    ];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], 810, 172 + i * 20);
    }

    roundRect(50, 580, 710, 48, 7, "#eef2f7", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("Kernel 1: vertical warp → strided B/C    |    Kernel 2: horizontal warp → coalesced B/C", 72, 610);
  }

  function drawCompPanel(x, y, title, fill, stroke, lines, isVertical) {
    roundRect(x, y, 340, 248, 8, fill, stroke);
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x + 14, y + 28);

    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#5b6475";
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], x + 14, y + 56 + i * 18);
    }

    const mx = x + 40, my = y + 136, ms = 120;
    roundRect(mx, my, ms, ms, 4, "#f8fafc", "#d8dde8");

    if (isVertical) {
      const cw = ms / 8;
      ctx.fillStyle = "rgba(190, 18, 60, 0.25)";
      ctx.fillRect(mx, my, cw, ms);
      ctx.strokeStyle = "#be123c";
      ctx.lineWidth = 2;
      ctx.strokeRect(mx, my, cw, ms);
      ctx.fillStyle = "#be123c";
      ctx.font = "700 11px ui-sans-serif, system-ui";
      ctx.fillText("warp 0", mx + cw + 6, my + ms / 2 + 4);
      ctx.fillText("↕ vertical", mx + cw + 6, my + ms / 2 + 20);
    } else {
      const ch = ms / 8;
      ctx.fillStyle = "rgba(17, 138, 75, 0.25)";
      ctx.fillRect(mx, my, ms, ch);
      ctx.strokeStyle = "#118a4b";
      ctx.lineWidth = 2;
      ctx.strokeRect(mx, my, ms, ch);
      ctx.fillStyle = "#118a4b";
      ctx.font = "700 11px ui-sans-serif, system-ui";
      ctx.fillText("warp 0 ↔ horizontal", mx + 4, my + ch + 18);
    }
  }

  // ── Drawing primitives ──

  function drawTile32(title, x, y, size) {
    roundRect(x - 10, y - 34, size + 20, size + 56, 8, "#fff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 12);

    const n = 32;
    const cell = size / n;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#e3e8f2";
    ctx.lineWidth = 0.4;
    for (let i = 0; i <= n; i++) {
      ctx.beginPath(); ctx.moveTo(x + i * cell, y); ctx.lineTo(x + i * cell, y + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + i * cell); ctx.lineTo(x + size, y + i * cell); ctx.stroke();
    }

    ctx.strokeStyle = "#cad2df";
    ctx.lineWidth = 0.8;
    for (let i = 0; i <= 8; i++) {
      const p = (size / 8) * i;
      ctx.beginPath(); ctx.moveTo(x + p, y); ctx.lineTo(x + p, y + size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y + p); ctx.lineTo(x + size, y + p); ctx.stroke();
    }

    ctx.strokeStyle = "#118a4b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("32 × 32 elements", x, y + size + 18);
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
    roundRect(660, 10, 510, 36, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(s.codeLine, 672, 33);
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

  function drawDot(x, y, color, r) {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
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
