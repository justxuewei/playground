(function () {
  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d");
  const tabs = document.querySelector("#tabs");
  const playButton = document.querySelector("#play");

  const W = 1200;
  const H = 680;
  const BM = 64;
  const BN = 64;
  const BK = 8;
  const TM = 8;
  const selected = { row: 0, col: 0 };
  const stageMs = 3600;
  const codeHotspots = [];
  let selectedCodeStep = null;

  const stages = [
    {
      title: "Code walkthrough",
      note: "Read the kernel in execution order: constants, block index, thread mapping, shared memory, K loop, writeback."
    },
    {
      title: "Block setup",
      note: "One CUDA block has 512 threads; each thread owns one output column and 8 output rows."
    },
    {
      title: "Tile work",
      note: "The block computes one 64x64 C tile by repeatedly loading A[64x8] and B[8x64] chunks."
    },
    {
      title: "Register reuse",
      note: "One B value is reused across 8 thread-local accumulators."
    },
    {
      title: "Next K chunk",
      note: "The block advances by BK=8 and repeats load, sync, compute."
    },
    {
      title: "Matrix grid",
      note: "The grid repeats that same block-level tile across the full C matrix."
    }
  ];

  let stageIndex = 0;
  let playing = false;
  let stageStartedAt = performance.now();

  for (const [index, stage] of stages.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${index + 1}. ${stage.title}`;
    button.addEventListener("click", () => setStage(index));
    tabs.appendChild(button);
  }

  document.querySelector("#prev").addEventListener("click", () => {
    setStage((stageIndex + stages.length - 1) % stages.length);
  });

  document.querySelector("#next").addEventListener("click", () => {
    setStage((stageIndex + 1) % stages.length);
  });

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

  canvas.addEventListener("click", (event) => {
    const hit = codeHotspotAt(event);
    if (hit === null) return;
    selectedCodeStep = hit;
    playing = false;
    playButton.textContent = "Play";
    draw();
  });

  canvas.addEventListener("mousemove", (event) => {
    canvas.style.cursor = codeHotspotAt(event) === null ? "default" : "pointer";
  });

  window.addEventListener("resize", () => {
    setupCanvas();
    draw();
  });

  function setStage(index) {
    stageIndex = index;
    selectedCodeStep = null;
    stageStartedAt = performance.now();
    updateTabs();
    draw();
  }

  function updateTabs() {
    for (const [index, button] of [...tabs.children].entries()) {
      button.classList.toggle("active", index === stageIndex);
    }
  }

  function tick(now) {
    if (playing && now - stageStartedAt > stageMs) {
      setStage((stageIndex + 1) % stages.length);
    }
    draw(now);
    requestAnimationFrame(tick);
  }

  function setupCanvas() {
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
  }

  function draw(now = performance.now()) {
    const progress = Math.min(1, (now - stageStartedAt) / stageMs);
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    drawHeader();

    if (stageIndex === 0) drawCodeWalkthroughStage(progress);
    if (stageIndex === 1) drawBlockStage(progress);
    if (stageIndex === 2) drawTileWorkStage(progress);
    if (stageIndex === 3) drawReuseStage(progress);
    if (stageIndex === 4) drawNextKStage(progress);
    if (stageIndex === 5) drawMatrixStage(progress);
  }

  function drawBackground() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#e3e8f2";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function drawHeader() {
    const stage = stages[stageIndex];
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 22px ui-sans-serif, system-ui";
    ctx.fillText(`${stageIndex + 1}. ${stage.title}`, 28, 38);
    ctx.fillStyle = "#5b6475";
    ctx.font = "14px ui-sans-serif, system-ui";
    ctx.fillText(stage.note, 28, 62);
    drawCodeLine(770, 28);
  }

  function drawCodeLine(x, y) {
    const lines = [
      "sgemm1DBlocktiling<BM=64, BN=64, BK=8, TM=8>",
      "threadCol = threadIdx.x % 64; threadRow = threadIdx.x / 64;",
      "As[64x8] and Bs[8x64] cache one K chunk;",
      "tmpB = Bs[dotIdx * BN + threadCol];",
      "A += BK; B += BK * N;",
      "gridDim repeats the 64x64 block tile across C;"
    ];
    roundRect(x, y - 19, 405, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(lines[stageIndex], x + 12, y + 5);
  }

  function drawCodeWalkthroughStage(progress) {
    const codeX = 58;
    const codeY = 110;
    codeHotspots.length = 0;
    const active = selectedCodeStep ?? Math.min(7, Math.floor(progress * 8));
    const codeLines = [
      "const uint cTileRow = blockIdx.y;",
      "const uint cTileCol = blockIdx.x;",
      "const uint threadCol = threadIdx.x % BN;",
      "const uint threadRow = threadIdx.x / BN;",
      "__shared__ float As[BM * BK];",
      "__shared__ float Bs[BK * BN];",
      "float threadResults[TM] = {0.0f};",
      "for (uint bkIdx = 0; bkIdx < K; bkIdx += BK) {",
      "  As[...] = A[...]; Bs[...] = B[...];",
      "  __syncthreads();",
      "  for (uint dotIdx = 0; dotIdx < BK; ++dotIdx) {",
      "    tmpB = Bs[dotIdx * BN + threadCol];",
      "    threadResults[resIdx] += As[...] * tmpB;",
      "  }",
      "  __syncthreads();",
      "}",
      "C[...] = alpha * threadResults[resIdx] + beta * C[...];"
    ];

    roundRect(codeX - 18, codeY - 34, 680, 528, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel execution order", codeX, codeY - 10);

    for (let i = 0; i < codeLines.length; i += 1) {
      const group = codeGroupForLine(i);
      const isActive = group === active;
      codeHotspots.push({
        x: codeX - 8,
        y: codeY + i * 24 + 6,
        w: 645,
        h: 22,
        step: group
      });
      if (isActive) {
        roundRect(codeX - 8, codeY + i * 24 + 6, 645, 22, 5, "#e8f7ef", "#118a4b");
      }
      ctx.fillStyle = isActive ? "#14532d" : "#1d2433";
      ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(codeLines[i], codeX, codeY + i * 24 + 22);
    }

    const steps = [
      ["Block index", "blockIdx chooses which 64x64 C tile this block owns."],
      ["Thread index", "threadIdx.x maps to one column plus 8 rows."],
      ["Shared memory", "As has 64x8 floats, Bs has 8x64 floats."],
      ["Registers", "threadResults[8] holds this thread's 8 partial sums."],
      ["Load chunk", "Each of 512 threads copies one A value and one B value."],
      ["Compute chunk", "BK=8 dot steps update all 8 registers."],
      ["Next chunk", "A and B pointers advance by 8 along K."],
      ["Write C", "The 8 registers become 8 global C elements."]
    ];

    const cardX = 792;
    const cardY = 122;
    for (let i = 0; i < steps.length; i += 1) {
      const y = cardY + i * 62;
      const isActive = i === active;
      roundRect(cardX, y, 342, 48, 7, isActive ? "#fef3c7" : "#ffffff", isActive ? "#b45309" : "#d8dde8");
      ctx.fillStyle = isActive ? "#78350f" : "#1d2433";
      ctx.font = "700 13px ui-sans-serif, system-ui";
      ctx.fillText(`${i + 1}. ${steps[i][0]}`, cardX + 12, y + 19);
      ctx.fillStyle = "#5b6475";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(steps[i][1], cardX + 12, y + 36);
    }
  }

  function codeGroupForLine(line) {
    if (line <= 1) return 0;
    if (line <= 3) return 1;
    if (line <= 5) return 2;
    if (line === 6) return 3;
    if (line <= 9) return 4;
    if (line <= 13) return 5;
    if (line <= 15) return 6;
    return 7;
  }

  function codeHotspotAt(event) {
    if (stageIndex !== 0) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    const hit = codeHotspots.find((spot) =>
      x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h
    );
    return hit ? hit.step : null;
  }

  function drawBlockStage(progress) {
    drawCTileWithThreadOutputs(366, 116, 380, progress);
    drawRegisterStack(862, 176, progress);
    drawThreadBlockPanel(60, 138, progress);

    drawCallout(770, 444, [
      "Block view:",
      "",
      "blockDim.x = (64 * 64) / 8",
      "= 512 threads",
      "",
      "threadCol chooses a C column.",
      "threadRow chooses an 8-row group."
    ]);
  }

  function drawTileWorkStage(progress) {
    drawGlobalTiles(0);
    drawSharedTiles(455, 365, progress);

    const t = ease(progress);
    drawArrow(315, 258, 492, 405, "#2563eb", t);
    drawArrow(882, 258, 680, 405, "#b45309", t);

    drawCallout(405, 100, [
      "Tile view:",
      "",
      "One block owns one 64x64 C tile.",
      "",
      "Each K loop loads:",
      "A tile: 64x8 = 512 floats",
      "B tile: 8x64 = 512 floats"
    ]);
  }

  function drawMatrixStage(progress) {
    drawMatrixTiles("Full C matrix, shown as 64x64 tiles", 420, 122, 360, 360, {
      row: selected.row,
      col: selected.col,
      fill: "#dcfce7",
      stroke: "#118a4b"
    });
    pulseRect(420, 122, 90, 90, "#118a4b", progress);

    drawCallout(62, 128, [
      "Matrix view:",
      "",
      "Every grid cell launches the same",
      "512-thread block program.",
      "",
      "Each block computes one 64x64",
      "tile of C, then the grid covers",
      "the complete output matrix."
    ]);

    drawCallout(812, 126, [
      "The grid axes are flipped here:",
      "",
      "blockIdx.x selects the C column tile.",
      "blockIdx.y selects the C row tile.",
      "",
      "Start with blockIdx = (0, 0):",
      "C rows 0..63, C cols 0..63"
    ]);
  }

  function drawReuseStage(progress) {
    const dot = Math.min(BK - 1, Math.floor(progress * BK));
    drawSharedTiles(92, 138, 1);
    drawReuseHighlights(92, 138, dot);
    drawRegisterStack(785, 156, progress);
    drawArrow(456, 260, 760, 245, "#6d28d9", 1);

    drawFormula(
      340,
      570,
      `dotIdx = ${dot}: 8 registers += As[8..15][${dot}] * Bs[${dot}][2]`
    );

    drawCallout(742, 420, [
      "This is the main new idea.",
      "",
      "One thread loads one Bs value into tmpB.",
      "That same tmpB is reused for 8 FMAs,",
      "one for each register result.",
      "",
      "Kernel 3 had one register result/thread."
    ]);
  }

  function drawNextKStage(progress) {
    drawChunkTimeline(138, 130, progress);
    drawSharedTiles(430, 360, 1);

    drawCallout(690, 125, [
      "BK = 8, so the K loop moves",
      "through the dot-product dimension",
      "8 columns/rows at a time.",
      "",
      "After every chunk:",
      "A moves right by 8 columns.",
      "B moves down by 8 rows."
    ]);

    drawArrow(352, 248, 492, 403, "#2563eb", ease(progress));
    drawArrow(646, 248, 660, 403, "#b45309", ease(progress));
  }

  function drawWriteStage(progress) {
    drawCTileWithThreadOutputs(238, 112, 410, progress);
    drawRegisterStack(795, 160, 1);
    drawArrow(795, 300, 650, 294, "#118a4b", ease(progress));

    drawCallout(730, 432, [
      "After all K chunks are accumulated,",
      "each thread writes 8 C elements.",
      "",
      "512 threads x 8 results/thread",
      "= 4096 values",
      "= one full 64x64 C tile."
    ]);
  }

  function drawThreadBlockPanel(x, y, progress) {
    roundRect(x - 18, y - 38, 268, 328, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("One CUDA block", x, y - 14);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("512 threads = 8 row groups x 64 columns", x, y + 18);

    const cols = 16;
    const rows = 8;
    const cell = 12;
    const gap = 3;
    const gridX = x + 6;
    const gridY = y + 44;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const index = row * 64 + col;
        const selectedThread = row === 1 && col === 2;
        const alpha = selectedThread ? 1 : 0.58 + 0.16 * Math.sin(progress * Math.PI * 2 + row * 0.5);
        ctx.fillStyle = selectedThread ? "#ede9fe" : `rgba(219, 234, 254, ${alpha})`;
        ctx.fillRect(gridX + col * (cell + gap), gridY + row * (cell + gap), cell, cell);
        ctx.strokeStyle = selectedThread ? "#6d28d9" : "#bfdbfe";
        ctx.lineWidth = selectedThread ? 2 : 1;
        ctx.strokeRect(gridX + col * (cell + gap), gridY + row * (cell + gap), cell, cell);
        if (selectedThread) {
          ctx.fillStyle = "#6d28d9";
          ctx.font = "10px ui-sans-serif, system-ui";
          ctx.fillText("66", gridX + col * (cell + gap) - 1, gridY + row * (cell + gap) - 5);
        }
      }
    }

    roundRect(x + 2, y + 204, 218, 34, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("thread 66 -> col 2", x + 12, y + 218);
    ctx.fillText("rows 8..15", x + 12, y + 234);
  }

  function drawGlobalTiles(chunk) {
    const kStart = chunk * BK;
    drawThinMatrix("A global", 70, 132, 250, 250, {
      fill: "#dbeafe",
      stroke: "#2563eb",
      label: `rows 0..63, cols ${kStart}..${kStart + BK - 1}`
    });
    drawWideMatrix("B global", 880, 132, 250, 250, {
      fill: "#fef3c7",
      stroke: "#b45309",
      label: `rows ${kStart}..${kStart + BK - 1}, cols 0..63`
    });
  }

  function drawChunkTimeline(x, y, progress) {
    roundRect(x - 20, y - 48, 500, 252, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("K dimension chunks", x, y - 20);

    for (let i = 0; i < 5; i += 1) {
      const fill = i === 0 ? "#e8f7ef" : i === 1 ? "#fef3c7" : "#f4f7fb";
      const stroke = i <= 1 ? "#118a4b" : "#9aa7bb";
      roundRect(x + i * 88, y + 20, 68, 96, 6, fill, stroke);
      ctx.fillStyle = "#1d2433";
      ctx.font = "700 13px ui-sans-serif, system-ui";
      ctx.fillText(`K ${i * BK}`, x + i * 88 + 18, y + 58);
      ctx.fillStyle = "#5b6475";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(`..${i * BK + 7}`, x + i * 88 + 20, y + 80);
    }

    const arrowX = x + 68 + ease(progress) * 88;
    drawArrow(arrowX, y + 148, arrowX + 56, y + 148, "#118a4b", 1);

    drawFormula(x + 30, y + 172, "load chunk -> sync -> compute -> sync -> next chunk");
  }

  function drawCTileWithThreadOutputs(x, y, size, progress) {
    roundRect(x - 18, y - 44, size + 36, size + 78, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Selected 64x64 C tile", x, y - 18);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Grid lines are groups of 8 rows/cols for readability.", x, y + size + 22);

    const cell = size / 8;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#d8dde8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * cell, y);
      ctx.lineTo(x + i * cell, y + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + i * cell);
      ctx.lineTo(x + size, y + i * cell);
      ctx.stroke();
    }

    const warpAlpha = 0.24 + 0.12 * Math.sin(progress * Math.PI * 2);
    ctx.fillStyle = `rgba(190, 18, 60, ${warpAlpha})`;
    ctx.fillRect(x, y, cell * 4, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cell * 4, cell);

    const selectedCol = 2;
    const selectedGroup = 1;
    ctx.fillStyle = "rgba(109, 40, 217, 0.28)";
    ctx.fillRect(x + selectedCol * (cell / 8), y + selectedGroup * cell, cell / 8, cell);
    ctx.strokeStyle = "#6d28d9";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + selectedCol * (cell / 8), y + selectedGroup * cell, cell / 8, cell);

    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("warp 0: cols 0..31, rows 0..7", x + 12, y + 23);
    ctx.fillStyle = "#6d28d9";
    ctx.fillText("thread 66: rows 8..15, col 2", x + 12, y + cell + 20);
  }

  function drawRegisterStack(x, y, progress) {
    roundRect(x - 18, y - 40, 245, 230, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("One thread's registers", x, y - 14);
    for (let i = 0; i < TM; i += 1) {
      const pulse = 0.12 + 0.1 * Math.sin(progress * Math.PI * 2 + i * 0.35);
      roundRect(x, y + i * 22, 185, 16, 4, "#ede9fe", "#6d28d9");
      ctx.fillStyle = `rgba(109, 40, 217, ${pulse})`;
      ctx.fillRect(x + 4, y + i * 22 + 4, 177, 8);
      ctx.fillStyle = "#1d2433";
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`threadResults[${i}]`, x + 8, y + i * 22 + 12);
    }
  }

  function drawSharedTiles(x, y, progress) {
    const alpha = 0.3 + 0.7 * ease(progress);
    ctx.globalAlpha = alpha;
    drawThinMatrix("As shared 64x8", x, y, 170, 170, {
      fill: "#dbeafe",
      stroke: "#2563eb",
      label: "64 rows x 8 cols"
    });
    drawWideMatrix("Bs shared 8x64", x + 250, y, 170, 170, {
      fill: "#fef3c7",
      stroke: "#b45309",
      label: "8 rows x 64 cols"
    });
    ctx.globalAlpha = 1;
  }

  function drawReuseHighlights(x, y, dot) {
    const size = 170;
    const aCellH = size / 8;
    const aCellW = size / 8;
    ctx.fillStyle = "rgba(37, 99, 235, 0.18)";
    ctx.fillRect(x + dot * aCellW, y + aCellH, aCellW, aCellH);
    ctx.fillStyle = "rgba(37, 99, 235, 0.3)";
    ctx.fillRect(x + dot * aCellW, y + aCellH, aCellW, aCellH);

    const bx = x + 250;
    const bCellH = size / 8;
    const bCellW = size / 8;
    ctx.fillStyle = "rgba(180, 83, 9, 0.24)";
    ctx.fillRect(bx, y + dot * bCellH, bCellW, bCellH);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, y + dot * bCellH, bCellW, bCellH);

    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + dot * aCellW, y + aCellH, aCellW, aCellH);
  }

  function drawMatrixTiles(title, x, y, w, h, highlight) {
    roundRect(x - 12, y - 38, w + 24, h + 58, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 14);

    const rows = 4;
    const cols = 4;
    const cellW = w / cols;
    const cellH = h / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const selectedCell = row === highlight.row && col === highlight.col;
        const fill = selectedCell ? highlight.fill : "#f8fafc";
        const stroke = selectedCell ? highlight.stroke : "#d8dde8";
        ctx.fillStyle = fill;
        ctx.fillRect(x + col * cellW, y + row * cellH, cellW, cellH);
        ctx.strokeStyle = stroke;
        ctx.lineWidth = selectedCell ? 2 : 1;
        ctx.strokeRect(x + col * cellW, y + row * cellH, cellW, cellH);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each square represents one 64x64 C tile.", x, y + h + 22);
  }

  function drawThinMatrix(title, x, y, w, h, options) {
    drawTiledPanel(title, x, y, w, h, options);
    const pad = 22;
    const tileX = x + pad;
    const tileY = y + 46;
    const tileW = w - pad * 2;
    const tileH = h - 78;
    ctx.fillStyle = options.fill;
    ctx.fillRect(tileX + tileW * 0.55, tileY, tileW * 0.14, tileH);
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(tileX + tileW * 0.55, tileY, tileW * 0.14, tileH);
  }

  function drawWideMatrix(title, x, y, w, h, options) {
    drawTiledPanel(title, x, y, w, h, options);
    const pad = 22;
    const tileX = x + pad;
    const tileY = y + 46;
    const tileW = w - pad * 2;
    const tileH = h - 78;
    ctx.fillStyle = options.fill;
    ctx.fillRect(tileX, tileY + tileH * 0.22, tileW, tileH * 0.14);
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(tileX, tileY + tileH * 0.22, tileW, tileH * 0.14);
  }

  function drawTiledPanel(title, x, y, w, h, options) {
    roundRect(x - 12, y - 38, w + 24, h + 58, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 14);
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#d8dde8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + (w / 4) * i, y);
      ctx.lineTo(x + (w / 4) * i, y + h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + (h / 4) * i);
      ctx.lineTo(x + w, y + (h / 4) * i);
      ctx.stroke();
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(options.label, x, y + h + 22);
  }

  function drawCallout(x, y, lines) {
    const width = 315;
    const lineH = 19;
    const height = 24 + lines.length * lineH;
    roundRect(x, y, width, height, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-sans-serif, system-ui";
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line === "") continue;
      ctx.fillText(line, x + 14, y + 24 + i * lineH);
    }
  }

  function drawFormula(x, y, text) {
    roundRect(x, y - 24, 535, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(text, x + 12, y + 2);
  }

  function drawArrow(x1, y1, x2, y2, color, progress) {
    const t = Math.max(0, Math.min(1, progress));
    const xEnd = x1 + (x2 - x1) * t;
    const yEnd = y1 + (y2 - y1) * t;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(xEnd, yEnd);
    ctx.stroke();

    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(xEnd, yEnd);
    ctx.lineTo(xEnd - 11 * Math.cos(angle - 0.45), yEnd - 11 * Math.sin(angle - 0.45));
    ctx.lineTo(xEnd - 11 * Math.cos(angle + 0.45), yEnd - 11 * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
  }

  function pulseRect(x, y, w, h, color, progress) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 + Math.sin(progress * Math.PI * 2) * 1.5;
    ctx.globalAlpha = 0.75;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
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
    if (fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  setupCanvas();
  updateTabs();
  requestAnimationFrame(tick);
})();
