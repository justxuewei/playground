(function () {
  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d");
  const tabs = document.querySelector("#tabs");
  const playButton = document.querySelector("#play");

  const W = 1200;
  const H = 680;
  const BM = 128;
  const BN = 128;
  const BK = 8;
  const TM = 8;
  const TN = 8;
  const stageMs = 3600;
  const codeHotspots = [];
  let selectedCodeStep = null;
  let stageIndex = 0;
  let playing = false;
  let stageStartedAt = performance.now();

  const stages = [
    {
      title: "Code walkthrough",
      note: "Read kernel 8 in execution order: block tile, vector loads, transposed As, padded Bs, register compute, float4 C writeback."
    },
    {
      title: "Block setup",
      note: "The block shape stays the same as kernels 5 through 7: 256 threads compute one 128x128 C tile."
    },
    {
      title: "Tile work",
      note: "A and B still arrive through float4 loads; the new part is where B lands in shared memory."
    },
    {
      title: "Extra columns",
      note: "Bs keeps its logical 8x128 shape, but each shared-memory row has 5 padding columns."
    },
    {
      title: "Next K chunk",
      note: "The K loop advances by BK=8 and repeats the same padded shared-memory load."
    },
    {
      title: "Matrix grid",
      note: "gridDim.x chooses C tile columns and gridDim.y chooses C tile rows."
    },
    {
      title: "Why faster",
      note: "Kernel 8 uses row padding to shift Bs bank mapping without changing the 8x8 register math."
    }
  ];

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
    if (stageIndex === 0) drawCodeStage(progress);
    if (stageIndex === 1) drawBlockStage(progress);
    if (stageIndex === 2) drawTileWorkStage(progress);
    if (stageIndex === 3) drawBankLayoutStage(progress);
    if (stageIndex === 4) drawNextKStage(progress);
    if (stageIndex === 5) drawMatrixStage(progress);
    if (stageIndex === 6) drawWhyFasterStage(progress);
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
    drawCodeLine(762, 28);
  }

  function drawCodeLine(x, y) {
    const lines = [
      "sgemmResolveBankExtraCol<BM=128, BN=128, BK=8, TM=8, TN=8>",
      "blockIdx=(0,0) owns C rows 0..127 and cols 0..127;",
      "A and B use float4 global loads;",
      "constexpr uint extraCols = 5;",
      "Bs[innerRowB * (BN + extraCols) + innerColB * 4 + lane];",
      "regN[i] = Bs[dotIdx * (BN + extraCols) + threadCol * TN + i];",
      "A += BK; B += BK * N;",
      "gridDim repeats 128x128 C tiles;",
      "kernel8 pads Bs rows to shift bank mapping;"
    ];
    roundRect(x, y - 19, 414, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    fitText(lines[stageIndex], x + 12, y + 5, 390);
  }

  function drawCodeStage(progress) {
    const codeX = 52;
    const codeY = 100;
    const active = selectedCodeStep ?? Math.min(8, Math.floor(progress * 9));
    codeHotspots.length = 0;
    const codeLines = [
      "const uint cTileRow = blockIdx.y;",
      "const uint cTileCol = blockIdx.x;",
      "threadCol = threadIdx.x % (BN / TN);",
      "threadRow = threadIdx.x / (BN / TN);",
      "innerRowB = threadIdx.x / (BN / 4);",
      "innerColB = threadIdx.x % (BN / 4);",
      "constexpr uint extraCols = 5;",
      "__shared__ float Bs[BK * (BN + extraCols)];",
      "float4 bLoad = reinterpret_cast<const float4 *>(&B[...])[0];",
      "Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 0] = bLoad.x;",
      "Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 1] = bLoad.y;",
      "Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 2] = bLoad.z;",
      "Bs[innerRowB * (BN + extraCols) + innerColB * 4 + 3] = bLoad.w;",
      "__syncthreads();",
      "regM[i] = As[dotIdx * BM + threadRow * TM + i];",
      "regN[i] = Bs[dotIdx * (BN + extraCols) + threadCol * TN + i];",
      "threadResults[m * TN + n] += regM[m] * regN[n];",
      "float4 cLoad = reinterpret_cast<float4 *>(&C[...])[0];",
      "reinterpret_cast<float4 *>(&C[...])[0] = updated cLoad;"
    ];
    roundRect(codeX - 18, codeY - 34, 700, 520, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 8 execution order", codeX, codeY - 10);

    for (let i = 0; i < codeLines.length; i += 1) {
      const group = codeGroupForLine(i);
      const isActive = group === active;
      const y = codeY + i * 24 + 6;
      codeHotspots.push({x: codeX - 8, y, w: 660, h: 22, step: group});
      if (isActive) {
        roundRect(codeX - 8, y, 660, 22, 5, "#e8f7ef", "#118a4b");
      }
      ctx.fillStyle = isActive ? "#14532d" : "#1d2433";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      fitText(codeLines[i], codeX, y + 16, 632);
    }

    const steps = [
      ["Block index", "blockIdx picks the 128x128 C tile."],
      ["Thread tile", "threadIdx maps to one 8x8 result patch."],
      ["Padding", "Bs has 5 extra columns per dot row."],
      ["B vector load", "One float4 load gets four adjacent B values."],
      ["Store Bs", "The four values use the padded row stride."],
      ["Sync", "All shared-memory writes are visible to the block."],
      ["Read regN", "regN reads with stride BN + extraCols."],
      ["Compute", "The 8x8 outer product stays unchanged."],
      ["Write C", "C still uses float4 load/update/store."]
    ];
    const cardX = 790;
    for (let i = 0; i < steps.length; i += 1) {
      const y = 104 + i * 62;
      const isActive = i === active;
      roundRect(cardX, y, 344, 48, 7, isActive ? "#fef3c7" : "#ffffff", isActive ? "#b45309" : "#d8dde8");
      ctx.fillStyle = isActive ? "#78350f" : "#1d2433";
      ctx.font = "700 13px ui-sans-serif, system-ui";
      ctx.fillText(`${i + 1}. ${steps[i][0]}`, cardX + 12, y + 19);
      ctx.fillStyle = "#5b6475";
      ctx.font = "12px ui-sans-serif, system-ui";
      fitText(steps[i][1], cardX + 12, y + 36, 318);
    }
  }

  function codeGroupForLine(line) {
    if (line <= 1) return 0;
    if (line <= 5) return 1;
    if (line <= 7) return 2;
    if (line <= 8) return 3;
    if (line <= 12) return 4;
    if (line <= 13) return 5;
    if (line <= 15) return 6;
    if (line <= 16) return 7;
    return 8;
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
    drawCTileWithThreadPatch(348, 112, 390, progress);
    drawRegisterTile(814, 162, progress);
    drawCallout(62, 124, [
      "Start with blockIdx = (0, 0):",
      "",
      "C rows 0..127",
      "C cols 0..127",
      "",
      "Same block geometry as kernel 7.",
      "Only Bs row stride changes."
    ]);
    drawCallout(790, 448, [
      "Example threadIdx.x = 18:",
      "",
      "threadCol = 18 % 16 = 2",
      "threadRow = 18 / 16 = 1",
      "",
      "It still owns rows 8..15",
      "and cols 16..23 in C."
    ]);
  }

  function drawTileWorkStage(progress) {
    drawGlobalTiles(0);
    drawSharedTiles(438, 360, progress);
    drawArrow(316, 258, 492, 405, "#2563eb", ease(progress));
    drawArrow(884, 258, 680, 405, "#b45309", ease(progress));
    drawFloat4Badge(282, 236, "float4 A");
    drawFloat4Badge(828, 236, "float4 B");
    drawCallout(394, 100, [
      "Tile view:",
      "",
      "A tile: 128x8 = 1024 floats",
      "B tile: 8x128 = 1024 floats",
      "",
      "Kernel 8 keeps vectorized global",
      "loads and pads Bs rows."
    ]);
  }

  function drawBankLayoutStage(progress) {
    drawBankComparison(70, 118, "Kernel 7 Bs", false, progress);
    drawBankComparison(460, 118, "Kernel 8 Bs", true, progress);
    drawArrow(405, 296, 445, 296, "#118a4b", ease(progress));
    drawCallout(850, 132, [
      "The B values are the same.",
      "",
      "Kernel 8 keeps the logical",
      "8x128 B tile.",
      "",
      "The physical stride is 133:",
      "BN + extraCols = 128 + 5"
    ]);
    drawFormula(250, 582, "Bs padded row: dotIdx * (BN + 5) + threadCol * TN + i");
  }

  function drawNextKStage(progress) {
    drawChunkTimeline(138, 130, progress);
    drawSharedTiles(430, 360, 1);
    drawArrow(352, 248, 492, 403, "#2563eb", ease(progress));
    drawArrow(646, 248, 660, 403, "#b45309", ease(progress));
    drawCallout(690, 125, [
      "BK = 8, so each K chunk",
      "loads A[128x8] and B[8x128].",
      "",
      "Every chunk stores Bs with",
      "5 extra columns per dot row."
    ]);
  }

  function drawMatrixStage(progress) {
    drawMatrixTiles("Full C matrix, shown as 128x128 tiles", 420, 122, 360, 360, {
      row: 0,
      col: 0,
      fill: "#dcfce7",
      stroke: "#118a4b"
    });
    pulseRect(420, 122, 90, 90, "#118a4b", progress);
    drawCallout(62, 128, [
      "Matrix view:",
      "",
      "gridDim.x moves across C columns.",
      "gridDim.y moves across C rows.",
      "",
      "The first block is the top-left",
      "128x128 tile."
    ]);
    drawCallout(812, 126, [
      "Kernel 8 compared with kernel 7:",
      "",
      "Same 128x128 block tile",
      "Same 8x8 thread result tile",
      "",
      "Different way to reduce Bs conflicts"
    ]);
  }

  function drawWhyFasterStage(progress) {
    drawComparisonPanel(70, 118, "Kernel 7", {
      tile: "C tile: 128x128",
      shared: "Bs layout: remapped",
      thread: "thread result: 8x8",
      loads: "global load/store: float4",
      fmas: "address math: custom remap",
      fill: "#f4f7fb",
      stroke: "#9aa7bb"
    });
    drawComparisonPanel(440, 118, "Kernel 8", {
      tile: "C tile: 128x128",
      shared: "Bs layout: 8x133 padded",
      thread: "thread result: 8x8",
      loads: "global load/store: float4",
      fmas: "address math: natural + stride",
      fill: "#e8f7ef",
      stroke: "#118a4b"
    });
    drawArrow(380, 276, 430, 276, "#118a4b", ease(progress));
    roundRect(815, 122, 310, 338, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("What changed", 835, 154);
    drawMetricRow(835, 188, "Global memory", "same", "#2563eb");
    drawMetricRow(835, 242, "Register math", "same", "#6d28d9");
    drawMetricRow(835, 296, "Bs row stride", "133", "#118a4b");
    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 8 shifts each dot row's bank", 835, 368);
    ctx.fillText("pattern by padding Bs, so repeated", 835, 389);
    ctx.fillText("regN reads collide less predictably.", 835, 410);
    drawFormula(230, 560, "Kernel 8: same 8x8 math, but Bs row stride changes from 128 to 133 floats");
  }

  function drawGlobalTiles(chunk) {
    const kStart = chunk * BK;
    drawThinMatrix("A global", 70, 132, 250, 250, {
      fill: "#dbeafe",
      stroke: "#2563eb",
      label: `rows 0..127, cols ${kStart}..${kStart + BK - 1}`
    });
    drawWideMatrix("B global", 880, 132, 250, 250, {
      fill: "#fef3c7",
      stroke: "#b45309",
      label: `rows ${kStart}..${kStart + BK - 1}, cols 0..127`
    });
  }

  function drawSharedTiles(x, y, progress) {
    ctx.globalAlpha = 0.3 + 0.7 * ease(progress);
    drawWideMatrix("As shared, transposed 8x128", x, y, 170, 170, {
      fill: "#dbeafe",
      stroke: "#2563eb",
      label: "8 dot rows x 128 C rows"
    });
    drawBankedMatrix("Bs shared, padded 8x133", x + 250, y, 170, 170);
    ctx.globalAlpha = 1;
  }

  function drawBankComparison(x, y, title, padded, progress) {
    roundRect(x - 18, y - 42, 330, 382, 8, "#ffffff", padded ? "#118a4b" : "#9aa7bb");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 16);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(padded ? "logical 128 cols plus 5 pad cols" : "custom remapped Bs addresses", x, y + 320);

    const cell = padded ? 13 : 18;
    const cols = padded ? 21 : 16;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isPad = padded && col >= 16;
        const bank = padded ? (row * 5 + col) % 8 : (row * 5 + col * 3) % 8;
        const hot = bank === Math.floor(progress * 8) % 8;
        ctx.fillStyle = isPad ? "#e5e7eb" : hot ? "rgba(180, 83, 9, 0.55)" : bankColor(bank);
        ctx.fillRect(x + col * cell, y + row * 28, cell - 2, 22);
      }
    }
    ctx.strokeStyle = padded ? "#118a4b" : "#b45309";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cell * cols - 2, 8 * 28 - 6);
    if (padded) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "700 11px ui-sans-serif, system-ui";
      ctx.fillText("+5 pad", x + 16 * cell + 6, y + 252);
    }
  }

  function drawBankedMatrix(title, x, y, w, h) {
    roundRect(x - 12, y - 38, w + 24, h + 58, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 14);
    const rows = 8;
    const cols = 21;
    const cellW = w / cols;
    const cellH = h / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isPad = col >= 16;
        ctx.fillStyle = isPad ? "#e5e7eb" : bankColor((row * 5 + col) % 8);
        ctx.fillRect(x + col * cellW, y + row * cellH, cellW, cellH);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.6;
        ctx.strokeRect(x + col * cellW, y + row * cellH, cellW, cellH);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("1024 values plus padding columns", x, y + h + 22);
  }

  function drawCTileWithThreadPatch(x, y, size, progress) {
    roundRect(x - 18, y - 44, size + 36, size + 78, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Selected 128x128 C tile", x, y - 18);
    const groups = 16;
    const cell = size / groups;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#d8dde8";
    ctx.lineWidth = 1;
    for (let i = 0; i <= groups; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + i * cell, y);
      ctx.lineTo(x + i * cell, y + size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y + i * cell);
      ctx.lineTo(x + size, y + i * cell);
      ctx.stroke();
    }
    ctx.fillStyle = `rgba(109, 40, 217, ${0.24 + 0.1 * Math.sin(progress * Math.PI * 2)})`;
    ctx.fillRect(x + 2 * cell, y + cell, cell, cell);
    ctx.strokeStyle = "#6d28d9";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2 * cell, y + cell, cell, cell);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Grid lines show 8x8 thread-owned patches.", x, y + size + 22);
  }

  function drawRegisterTile(x, y, progress) {
    roundRect(x - 18, y - 40, 260, 260, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("One thread's register tile", x, y - 14);
    const size = 190;
    const cell = size / 8;
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const pulse = 0.16 + 0.1 * Math.sin(progress * Math.PI * 2 + row * 0.3 + col * 0.2);
        ctx.fillStyle = `rgba(109, 40, 217, ${pulse})`;
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        ctx.strokeStyle = "#6d28d9";
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("threadResults[8 * 8] = 64 accumulators", x, y + size + 24);
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
    drawFormula(x + 30, y + 172, "load float4 -> store padded Bs -> sync -> register compute -> next chunk");
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
        ctx.fillStyle = selectedCell ? highlight.fill : "#f8fafc";
        ctx.strokeStyle = selectedCell ? highlight.stroke : "#d8dde8";
        ctx.lineWidth = selectedCell ? 2 : 1;
        ctx.fillRect(x + col * cellW, y + row * cellH, cellW, cellH);
        ctx.strokeRect(x + col * cellW, y + row * cellH, cellW, cellH);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each square represents one 128x128 C tile.", x, y + h + 22);
  }

  function drawComparisonPanel(x, y, title, data) {
    roundRect(x, y, 310, 360, 8, data.fill, data.stroke);
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 18px ui-sans-serif, system-ui";
    ctx.fillText(title, x + 18, y + 34);
    const lines = [data.tile, data.shared, data.thread, data.loads, data.fmas];
    for (let i = 0; i < lines.length; i += 1) {
      roundRect(x + 18, y + 68 + i * 52, 274, 36, 6, "#ffffff", "#d8dde8");
      ctx.fillStyle = i === lines.length - 1 ? "#118a4b" : "#1d2433";
      ctx.font = i === lines.length - 1
        ? "700 13px ui-sans-serif, system-ui"
        : "13px ui-sans-serif, system-ui";
      fitText(lines[i], x + 30, y + 91 + i * 52, 250);
    }
  }

  function drawMetricRow(x, y, label, value, color) {
    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillText(label, x, y);
    roundRect(x + 168, y - 21, 78, 30, 6, "#ffffff", color);
    ctx.fillStyle = color;
    ctx.font = "700 15px ui-sans-serif, system-ui";
    fitText(value, x + 180, y, 56);
  }

  function drawThinMatrix(title, x, y, w, h, options) {
    drawTiledPanel(title, x, y, w, h, options);
    const pad = 22;
    const tileX = x + pad;
    const tileY = y + 46;
    const tileW = w - pad * 2;
    const tileH = h - 78;
    ctx.fillStyle = options.fill;
    ctx.fillRect(tileX + tileW * 0.56, tileY, tileW * 0.12, tileH);
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(tileX + tileW * 0.56, tileY, tileW * 0.12, tileH);
  }

  function drawWideMatrix(title, x, y, w, h, options) {
    drawTiledPanel(title, x, y, w, h, options);
    const pad = 22;
    const tileX = x + pad;
    const tileY = y + 46;
    const tileW = w - pad * 2;
    const tileH = h - 78;
    ctx.fillStyle = options.fill;
    ctx.fillRect(tileX, tileY + tileH * 0.22, tileW, tileH * 0.12);
    ctx.strokeStyle = options.stroke;
    ctx.lineWidth = 2;
    ctx.strokeRect(tileX, tileY + tileH * 0.22, tileW, tileH * 0.12);
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
    const width = 325;
    const lineH = 19;
    const height = 24 + lines.length * lineH;
    roundRect(x, y, width, height, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-sans-serif, system-ui";
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i] === "") continue;
      fitText(lines[i], x + 14, y + 24 + i * lineH, width - 28);
    }
  }

  function drawFormula(x, y, text) {
    roundRect(x, y - 24, 760, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    fitText(text, x + 12, y + 2, 736);
  }

  function drawFloat4Badge(x, y, label) {
    roundRect(x, y, 86, 30, 6, "#f4f7fb", "#6d28d9");
    ctx.fillStyle = "#6d28d9";
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(label, x + 12, y + 20);
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

  function bankColor(bank) {
    const colors = [
      "#dbeafe",
      "#bfdbfe",
      "#fef3c7",
      "#fde68a",
      "#dcfce7",
      "#bbf7d0",
      "#ede9fe",
      "#ddd6fe"
    ];
    return colors[bank % colors.length];
  }

  function fitText(text, x, y, maxWidth) {
    const originalFont = ctx.font;
    const match = originalFont.match(/^(.*?)(\d+)px\s+(.*)$/);
    if (!match) {
      ctx.fillText(text, x, y);
      return;
    }
    const prefix = match[1];
    let size = Number.parseInt(match[2], 10);
    const family = match[3];
    while (ctx.measureText(text).width > maxWidth && size > 9) {
      size -= 1;
      ctx.font = `${prefix}${size}px ${family}`;
    }
    ctx.fillText(text, x, y);
    ctx.font = originalFont;
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  setupCanvas();
  updateTabs();
  requestAnimationFrame(tick);
})();
