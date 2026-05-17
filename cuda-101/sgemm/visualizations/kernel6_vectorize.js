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

  const stages = [
    {
      title: "Code walkthrough",
      note: "Read the vectorized kernel in execution order: block index, thread tile, float4 loads, transposed As, register compute, float4 writeback."
    },
    {
      title: "Block setup",
      note: "One CUDA block has 256 threads; each thread owns an 8x8 patch of the 128x128 C tile."
    },
    {
      title: "Vector loads",
      note: "Each thread loads four adjacent floats at a time from global memory into the shared-memory tiles."
    },
    {
      title: "Transposed As",
      note: "A is written into shared memory as dot-major data so the compute loop can read As[dotIdx][row]."
    },
    {
      title: "Next K chunk",
      note: "The block advances by BK=8 and repeats load, sync, compute."
    },
    {
      title: "Matrix grid",
      note: "The grid repeats the same 128x128 block tile across the full C matrix."
    },
    {
      title: "Why faster",
      note: "Kernel 6 keeps kernel 5's math shape and reduces memory instruction overhead with float4 movement."
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

    if (stageIndex === 0) drawCodeStage(progress);
    if (stageIndex === 1) drawBlockStage(progress);
    if (stageIndex === 2) drawTileWorkStage(progress);
    if (stageIndex === 3) drawRegisterTileStage(progress);
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
    drawCodeLine(770, 28);
  }

  function drawCodeLine(x, y) {
    const lines = [
      "sgemmVectorize<BM=128, BN=128, BK=8, TM=8, TN=8>",
      "threadCol = threadIdx.x % 16; threadRow = threadIdx.x / 16;",
      "float4 loads move four A/B values per memory instruction;",
      "As is stored transposed: As[dotIdx * BM + row];",
      "threadResults[8x8] += regM[8] outer regN[8];",
      "A += BK; B += BK * N;",
      "gridDim repeats the 128x128 block tile across C;",
      "kernel6 keeps kernel5 math but vectorizes memory;"
    ];
    roundRect(x, y - 19, 405, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(lines[stageIndex], x + 12, y + 5);
  }

  function drawCodeStage(progress) {
    const codeX = 58;
    const codeY = 100;
    codeHotspots.length = 0;
    const active = selectedCodeStep ?? Math.min(7, Math.floor(progress * 8));
    const codeLines = [
      "const uint cTileRow = blockIdx.y;",
      "const uint cTileCol = blockIdx.x;",
      "threadCol = threadIdx.x % (BN / TN);",
      "threadRow = threadIdx.x / (BN / TN);",
      "innerRowA = threadIdx.x / (BK / 4);",
      "innerColA = threadIdx.x % (BK / 4);",
      "innerRowB = threadIdx.x / (BN / 4);",
      "innerColB = threadIdx.x % (BN / 4);",
      "float threadResults[TM * TN] = {0.0f};",
      "float regM[TM]; float regN[TN];",
      "for (uint bkIdx = 0; bkIdx < K; bkIdx += BK) {",
      "  float4 aLoad = reinterpret_cast<const float4 *>(&A[...])[0];",
      "  As[(innerColA * 4 + lane) * BM + innerRowA] = aLoad.lane;",
      "  reinterpret_cast<float4 *>(&Bs[...])[0] = B float4;",
      "  __syncthreads();",
      "  regM[i] = As[dotIdx * BM + threadRow * TM + i];",
      "  regN[i] = Bs[dotIdx * BN + threadCol * TN + i];",
      "  threadResults[m * TN + n] += regM[m] * regN[n];",
      "  __syncthreads();",
      "}",
      "float4 cLoad = reinterpret_cast<float4 *>(&C[...])[0];",
      "reinterpret_cast<float4 *>(&C[...])[0] = updated cLoad;"
    ];

    roundRect(codeX - 18, codeY - 34, 680, 540, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel execution order", codeX, codeY - 10);

    for (let i = 0; i < codeLines.length; i += 1) {
      const group = codeGroupForLine(i);
      const isActive = group === active;
      codeHotspots.push({
        x: codeX - 8,
        y: codeY + i * 22 + 6,
        w: 645,
        h: 20,
        step: group
      });
      if (isActive) {
        roundRect(codeX - 8, codeY + i * 22 + 6, 645, 20, 5, "#e8f7ef", "#118a4b");
      }
      ctx.fillStyle = isActive ? "#14532d" : "#1d2433";
      ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(codeLines[i], codeX, codeY + i * 22 + 21);
    }

    const steps = [
      ["Block index", "blockIdx chooses which 128x128 C tile this block owns."],
      ["Thread tile", "threadIdx.x maps to one 8x8 C patch."],
      ["Vector lanes", "Each thread picks one group of four adjacent values."],
      ["Registers", "Each thread still keeps 64 C accumulators."],
      ["float4 load", "One instruction moves four contiguous floats."],
      ["Transposed As", "A is stored as As[dotIdx][row] for the compute loop."],
      ["Next chunk", "A and B pointers advance by 8 along K."],
      ["float4 write", "C is updated and stored four adjacent values at a time."]
    ];

    const cardX = 792;
    const cardY = 104;
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
    if (line <= 7) return 2;
    if (line <= 9) return 3;
    if (line <= 14) return 4;
    if (line <= 17) return 5;
    if (line <= 19) return 6;
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
    drawCTileWithThreadPatch(346, 112, 390, progress);
    drawRegisterTile(812, 164, progress);
    drawCallout(62, 124, [
      "Start with blockIdx = (0, 0):",
      "",
      "C rows 0..127",
      "C cols 0..127",
      "",
      "The block has only 256 threads.",
      "Each thread computes 64 C values."
    ]);
    drawCallout(790, 450, [
      "Example threadIdx.x = 18:",
      "",
      "threadCol = 18 % 16 = 2",
      "threadRow = 18 / 16 = 1",
      "",
      "It owns rows 8..15 and cols 16..23",
      "inside the 128x128 C tile."
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
      "Each K chunk still loads:",
      "A tile: 128x8 = 1024 floats",
      "B tile: 8x128 = 1024 floats",
      "",
      "Kernel 6 moves them with float4",
      "loads instead of scalar loads."
    ]);
  }

  function drawRegisterTileStage(progress) {
    const dot = Math.min(BK - 1, Math.floor(progress * BK));
    drawSharedTiles(88, 142, 1);
    drawSharedHighlights(88, 142, dot);
    drawRegisterTile(790, 142, progress);
    drawArrow(500, 252, 760, 252, "#6d28d9", 1);
    drawFormula(310, 570, `dotIdx = ${dot}: threadResults[8x8] += regM[8] outer regN[8]`);
    drawCallout(742, 430, [
      "Kernel 6 compute step:",
      "",
      "Load 8 values from transposed As.",
      "Load 8 values from Bs into regN.",
      "",
      "The math is the same 8x8 register",
      "tile used by kernel 5."
    ]);
  }

  function drawNextKStage(progress) {
    drawChunkTimeline(138, 130, progress);
    drawSharedTiles(430, 360, 1);
    drawArrow(352, 248, 492, 403, "#2563eb", ease(progress));
    drawArrow(646, 248, 660, 403, "#b45309", ease(progress));
    drawCallout(690, 125, [
      "BK = 8, so the K loop advances",
      "through the dot-product dimension",
      "8 columns/rows at a time.",
      "",
      "The same 8x8 register tile receives",
      "more partial sums from each chunk."
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
      "Every grid cell launches the same",
      "256-thread block program.",
      "",
      "Each block computes one 128x128",
      "tile of C."
    ]);
    drawCallout(812, 126, [
      "Kernel 6 compared with kernel 5:",
      "",
      "Kernel 5:",
      "  scalar loads and scalar C writes",
      "",
      "Kernel 6:",
      "  float4 loads and float4 C writes"
    ]);
  }

  function drawWhyFasterStage(progress) {
    drawComparisonPanel(70, 118, "Kernel 5", {
      tile: "C tile: 128x128",
      shared: "shared: scalar global loads",
      thread: "thread result: 8x8",
      loads: "A/B load width: 1 float",
      fmas: "C write width: 1 float",
      fill: "#f4f7fb",
      stroke: "#9aa7bb"
    });
    drawComparisonPanel(440, 118, "Kernel 6", {
      tile: "C tile: 128x128",
      shared: "shared: As is transposed",
      thread: "thread result: 8x8",
      loads: "A/B load width: 4 floats",
      fmas: "C write width: 4 floats",
      fill: "#e8f7ef",
      stroke: "#118a4b"
    });

    drawArrow(380, 276, 430, 276, "#118a4b", ease(progress));

    roundRect(815, 122, 310, 338, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("What changed", 835, 154);

    drawMetricRow(835, 188, "Global load width", "4x", "#2563eb");
    drawMetricRow(835, 242, "C store width", "4x", "#6d28d9");
    drawMetricRow(835, 296, "Register math", "same", "#118a4b");

    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillText("Kernel 6 is faster when the same", 835, 368);
    ctx.fillText("8x8 register compute is fed by fewer", 835, 389);
    ctx.fillText("wider memory instructions.", 835, 410);

    drawFormula(250, 560, "Kernel 6: same 8x8 register math, but float4 loads/stores reduce memory instructions");
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
      ctx.fillText(lines[i], x + 30, y + 91 + i * 52);
    }
  }

  function drawMetricRow(x, y, label, value, color) {
    ctx.fillStyle = "#5b6475";
    ctx.font = "13px ui-sans-serif, system-ui";
    ctx.fillText(label, x, y);
    roundRect(x + 168, y - 21, 78, 30, 6, "#ffffff", color);
    ctx.fillStyle = color;
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(value, x + 194, y);
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
    const alpha = 0.3 + 0.7 * ease(progress);
    ctx.globalAlpha = alpha;
    drawWideMatrix("As shared, transposed 8x128", x, y, 170, 170, {
      fill: "#dbeafe",
      stroke: "#2563eb",
      label: "8 dot rows x 128 C rows"
    });
    drawWideMatrix("Bs shared 8x128", x + 250, y, 170, 170, {
      fill: "#fef3c7",
      stroke: "#b45309",
      label: "8 rows x 128 cols"
    });
    ctx.globalAlpha = 1;
  }

  function drawSharedHighlights(x, y, dot) {
    const size = 170;
    const cell = size / 8;
    ctx.fillStyle = "rgba(37, 99, 235, 0.2)";
    ctx.fillRect(x, y + dot * cell, size, cell);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + dot * cell, size, cell);

    const bx = x + 250;
    ctx.fillStyle = "rgba(180, 83, 9, 0.24)";
    ctx.fillRect(bx, y + dot * cell, size, cell);
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, y + dot * cell, size, cell);
  }

  function drawFloat4Badge(x, y, label) {
    roundRect(x, y, 86, 30, 6, "#f4f7fb", "#6d28d9");
    ctx.fillStyle = "#6d28d9";
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(label, x + 12, y + 20);
  }

  function drawCTileWithThreadPatch(x, y, size, progress) {
    roundRect(x - 18, y - 44, size + 36, size + 78, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Selected 128x128 C tile", x, y - 18);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Grid lines show 8x8 thread-owned patches.", x, y + size + 22);

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

    const alpha = 0.28 + 0.1 * Math.sin(progress * Math.PI * 2);
    ctx.fillStyle = `rgba(109, 40, 217, ${alpha})`;
    ctx.fillRect(x + 2 * cell, y + cell, cell, cell);
    ctx.strokeStyle = "#6d28d9";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 2 * cell, y + cell, cell, cell);

    ctx.fillStyle = "rgba(190, 18, 60, 0.18)";
    ctx.fillRect(x, y, cell * 4, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cell * 4, cell);

    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("warp 0 covers several 8x8 patches", x + 12, y + 22);
    ctx.fillStyle = "#6d28d9";
    ctx.fillText("thread 18: one 8x8 C patch", x + 12, y + cell + 20);
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
    drawFormula(x + 30, y + 172, "load chunk -> sync -> register tile compute -> sync -> next chunk");
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
      const line = lines[i];
      if (line === "") continue;
      ctx.fillText(line, x + 14, y + 24 + i * lineH);
    }
  }

  function drawFormula(x, y, text) {
    roundRect(x, y - 24, 595, 40, 6, "#f4f7fb", "#d8dde8");
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
