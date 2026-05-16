(function () {
  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d");
  const tabs = document.querySelector("#tabs");
  const playButton = document.querySelector("#play");

  const W = 1200;
  const H = 680;
  const BLOCK = 32;
  const selectedBlock = { x: 1, y: 0 };
  const exampleThread = { x: 2, y: 3 };
  const stageMs = 5600;

  const stages = [
    {
      title: "GEMM",
      note: "One C element is a dot product of one A row and one B column."
    },
    {
      title: "Block owns tile",
      note: "One CUDA block computes one 32x32 tile of C, not one element."
    },
    {
      title: "Threads own elements",
      note: "Inside the tile, each thread computes exactly one C element."
    },
    {
      title: "One thread loop",
      note: "A single thread walks across K to build its dot product."
    },
    {
      title: "Block fills tile",
      note: "All 1024 threads do the same pattern for different C elements."
    },
    {
      title: "Warp view",
      note: "Warp 0 is vertical in kernel 1."
    },
    {
      title: "K-loop access",
      note: "At one loop step, kernel 1 reads A and writes C with strided addresses."
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

  window.addEventListener("resize", () => {
    setupCanvas();
    draw();
  });

  function setStage(index) {
    stageIndex = index;
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

    if (stageIndex === 0) drawGemmStage(progress);
    if (stageIndex === 1) drawBlockTileStage(progress);
    if (stageIndex === 2) drawThreadElementStage(progress);
    if (stageIndex === 3) drawOneThreadLoopStage(progress);
    if (stageIndex === 4) drawBlockFillsTileStage(progress);
    if (stageIndex === 5) drawWarpStage(progress);
    if (stageIndex === 6) drawKLoopAccessStage(progress);
  }

  function drawBackground() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#e3e8f2";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x += 40) {
      line(x, 0, x, H);
    }
    for (let y = 0; y <= H; y += 40) {
      line(0, y, W, y);
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
    drawCode(stageIndex);
  }

  function drawCode(index) {
    const lines = [
      "C[row][col] = sum_i A[row][i] * B[i][col]",
      "gridDim = (ceil(M/32), ceil(N/32)); blockDim = (32, 32);",
      "row = blockIdx.x * blockDim.x + threadIdx.x;",
      "for (int i = 0; i < K; ++i) sum += A[row*K+i] * B[i*N+col];",
      "1024 threads in one block -> 1024 C elements in one tile",
      "warp 0: threadIdx.x = 0..31, threadIdx.y = 0",
      "warp 0 at loop i -> A[32..63][i], B[i][0], C[32..63][0]"
    ];
    roundRect(705, 9, 468, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(lines[index], 718, 34);
  }

  function drawGemmStage(progress) {
    drawMiniMatrix("A", 95, 155, 260, 260, "#dbeafe", "#2563eb", {
      row: 4,
      col: Math.floor(progress * 8)
    });
    drawMiniMatrix("B", 470, 155, 260, 260, "#fef3c7", "#b45309", {
      col: 3,
      row: Math.floor(progress * 8)
    });
    drawMiniMatrix("C", 845, 155, 260, 260, "#dcfce7", "#118a4b", {
      row: 4,
      col: 3,
      point: true
    });
    bigText("x", 395, 294);
    bigText("=", 775, 294);
    drawCallout(118, 475, [
      "A single C element is not copied from A or B.",
      "",
      "It is computed by multiplying one A row",
      "with one B column across the K dimension."
    ]);
    drawFormula(705, 478, "C[4][3] = A[4][0] * B[0][3] + ... + A[4][K-1] * B[K-1][3]");
  }

  function drawBlockTileStage(progress) {
    drawTileMatrix("Full C matrix view", 385, 112, 360, selectedBlock);
    drawCallout(62, 128, [
      "This is the full C matrix.",
      "",
      "Each large square is one 32x32 tile.",
      "Each tile is assigned to one CUDA block."
    ]);
    drawCallout(795, 128, [
      "For blockIdx = (1, 0):",
      "",
      "blockIdx.x = 1 -> row tile 1",
      "blockIdx.y = 0 -> column tile 0",
      "",
      "This block computes C rows 32..63",
      "and C columns 0..31."
    ]);
    pulseRect(385, 112 + 90, 90, 90, "#118a4b", progress);
    drawFormula(295, 520, "block -> one 32x32 C tile -> 1024 C elements");
  }

  function drawThreadElementStage(progress) {
    drawCElementGrid(405, 116, 360);
    drawParallelThreadsOverlay(405, 116, 360, progress);
    drawThreadPointer(405, 116, 360, exampleThread.x, exampleThread.y);
    drawCallout(58, 122, [
      "Zoomed view of the selected C tile.",
      "",
      "Now each small square is one C element.",
      "The block has 32 x 32 = 1024 threads.",
      "",
      "They are shown active together."
    ]);
    drawCallout(795, 122, [
      "Kernel 1 uses a 2D thread block:",
      "",
      "threadIdx.x -> local row inside the tile",
      "threadIdx.y -> local column inside the tile",
      "",
      "The red cell is one example thread:",
      "thread (2, 3) owns C[34][3]."
    ]);
    drawFormula(328, 545, "All 1024 threads run in parallel; the red one is only an example.");
  }

  function drawOneThreadLoopStage(progress) {
    const visualIndex = Math.floor(progress * 31);
    const kLabel = Math.min(1023, Math.floor(progress * 1023));
    drawFullMatrixA(55, 138, 310, visualIndex);
    drawFullMatrixB(445, 138, 310, visualIndex);
    drawFullMatrixC(840, 138, 250, progress);
    drawArrow(370, 293, 440, 293, "#1d2433", 1);
    drawArrow(760, 293, 835, 293, "#1d2433", 1);
    drawCallout(54, 505, [
      "Only one thread is shown here:",
      "",
      "blockIdx = (1, 0)",
      "threadIdx = (2, 3)",
      "row = 34, col = 3"
    ]);
    drawCallout(640, 505, [
      "The thread loops over K.",
      "",
      "At each i, it reads A[34][i]",
      "and B[i][3], then adds one product",
      "to its private sum register.",
      "",
      "Other threads do their own K loops in parallel."
    ]);
    drawFormula(190, 83, `i samples 0..K-1, now near ${kLabel}: sum += A[34][i] * B[i][3]`);
  }

  function drawBlockFillsTileStage(progress) {
    drawCElementGrid(420, 116, 360, null, 1024);
    drawParallelThreadsOverlay(420, 116, 360, progress);
    drawCallout(66, 125, [
      "The previous step showed one thread.",
      "",
      "The real block runs 1024 threads.",
      "Each thread computes a different C element.",
      "",
      "This happens in parallel, not row by row."
    ]);
    drawCallout(810, 125, [
      "Important rule:",
      "",
      "one block  -> one 32x32 C tile",
      "one thread -> one C element",
      "",
      "So one block computes 1024 C elements."
    ]);
    drawFormula(365, 545, "1024 threads in block (1, 0) fill C[32..63][0..31]");
  }

  function drawWarpStage(progress) {
    drawCElementGrid(400, 116, 360);
    const cell = 360 / 32;
    ctx.fillStyle = "rgba(190, 18, 60, 0.18)";
    ctx.fillRect(400, 116, cell, 360);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3;
    ctx.strokeRect(400, 116, cell, 360);

    drawCallout(58, 126, [
      "CUDA groups threads into warps.",
      "",
      "In kernel 1, warp 0 has:",
      "  threadIdx.x = 0..31",
      "  threadIdx.y = 0",
      "",
      "This kernel maps threadIdx.x to row,",
      "so x increases downward in this C tile.",
      "",
      "All 32 warp threads are active together.",
      "",
      "So warp 0 computes C[32..63][0]."
    ]);
    drawCallout(805, 126, [
      "This step is only about the warp shape.",
      "",
      "The next step shows what this vertical",
      "warp shape does to memory access inside",
      "the K loop."
    ]);
  }

  function drawKLoopAccessStage(progress) {
    drawCElementGrid(70, 126, 300);
    const cell = 300 / 32;
    ctx.fillStyle = "rgba(190, 18, 60, 0.18)";
    ctx.fillRect(70, 126, cell, 300);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3;
    ctx.strokeRect(70, 126, cell, 300);

    drawCallout(420, 118, [
      "At one K-loop step i, all 32 warp",
      "threads execute the same load/multiply",
      "instruction together.",
      "",
      "Because warp 0 is vertical, row changes",
      "across lanes while column stays 0."
    ]);
    drawMemoryLanes(420, 300, progress);
    drawCallout(805, 118, [
      "Memory picture for warp 0:",
      "",
      "A[32..63][i] -> strided by K",
      "B[i][0]      -> same address",
      "C[32..63][0] -> strided by N",
      "",
      "This is why kernel 2 remaps the warp",
      "to move horizontally across columns."
    ]);
  }

  function drawMemoryLanes(x, y, progress) {
    drawLane(x, y, "A", "A[32][i], A[33][i], ...", "#2563eb", false, progress);
    drawLane(x, y + 58, "B", "B[i][0] for all warp threads", "#b45309", "same", progress);
    drawLane(x, y + 116, "C", "C[32][0], C[33][0], ...", "#118a4b", false, progress);
  }

  function drawLane(x, y, name, label, color, mode, progress) {
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText(name, x, y);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(label, x + 32, y);
    roundRect(x + 32, y + 10, 390, 30, 6, "#f8fafc", "#d8dde8");
    const count = 12;
    const pulse = 0.62 + 0.18 * Math.sin(progress * Math.PI * 2);
    for (let i = 0; i < count; i += 1) {
      let px = x + 50 + i * 31;
      if (mode === "same") px = x + 62 + Math.sin(i) * 2;
      ctx.fillStyle = withAlpha(color, pulse);
      ctx.beginPath();
      ctx.arc(px, y + 25, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = mode === "same" ? "#6d28d9" : "#be123c";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(mode === "same" ? "same address" : "strided", x + 330, y + 25);
  }

  function drawMiniMatrix(title, x, y, size, fill, stroke, highlight) {
    panelTitle(title, x, y, size);
    const n = 8;
    const cell = size / n;
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        let active = false;
        if (highlight && highlight.point) {
          active = highlight.row === row && highlight.col === col;
        } else if (highlight) {
          active = highlight.row === row || highlight.col === col;
        }
        ctx.fillStyle = active ? fill : "#f8fafc";
        ctx.strokeStyle = active ? stroke : "#d8dde8";
        ctx.lineWidth = active ? 2 : 1;
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
  }

  function drawTileMatrix(title, x, y, size, highlight) {
    panelTitle(title, x, y, size);
    const n = 4;
    const cell = size / n;
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        const active = row === highlight.x && col === highlight.y;
        ctx.fillStyle = active ? "#dcfce7" : "#f8fafc";
        ctx.strokeStyle = active ? "#118a4b" : "#d8dde8";
        ctx.lineWidth = active ? 3 : 1;
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
        ctx.fillStyle = active ? "#0f6b3d" : "#5b6475";
        ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
        ctx.fillText(`block(${row},${col})`, x + col * cell + 10, y + row * cell + 24);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each large square is one 32x32 C tile.", x, y + size + 20);
  }

  function drawCElementGrid(x, y, size, highlight, filled = 0) {
    panelTitle("Zoomed C tile: 32x32 elements", x, y, size);
    const n = 32;
    const cell = size / n;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, size, size);
    for (let index = 0; index < filled; index += 1) {
      const row = Math.floor(index / n);
      const col = index % n;
      ctx.fillStyle = "#dcfce7";
      ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
    }
    ctx.strokeStyle = "#cad2df";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= n; i += 1) {
      const pos = i * cell;
      line(x + pos, y, x + pos, y + size);
      line(x, y + pos, x + size, y + pos);
    }
    ctx.strokeStyle = "#118a4b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
    if (highlight) {
      ctx.fillStyle = "rgba(190, 18, 60, 0.24)";
      ctx.fillRect(x + highlight.col * cell, y + highlight.row * cell, cell, cell);
      ctx.strokeStyle = "#be123c";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + highlight.col * cell, y + highlight.row * cell, cell, cell);
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each small square is one C element and one CUDA thread.", x, y + size + 20);
    ctx.fillText("row direction: down; column direction: right", x, y + size + 38);
  }

  function drawThreadPointer(x, y, size, threadX, threadY) {
    const cell = size / 32;
    const row = threadX;
    const col = threadY;
    const px = x + col * cell + cell / 2;
    const py = y + row * cell + cell / 2;
    ctx.fillStyle = "rgba(37, 99, 235, 0.18)";
    ctx.fillRect(x, py - 3, size, 6);
    ctx.fillStyle = "rgba(180, 83, 9, 0.18)";
    ctx.fillRect(px - 3, y, 6, size);
    ctx.fillStyle = "rgba(190, 18, 60, 0.26)";
    ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
    dot(px, py, "#be123c", 7);
  }

  function drawParallelThreadsOverlay(x, y, size, progress) {
    const n = 32;
    const cell = size / n;
    const pulse = 0.45 + 0.25 * Math.sin(progress * Math.PI * 2);
    ctx.fillStyle = withAlpha("#118a4b", 0.06 + 0.05 * pulse);
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = withAlpha("#118a4b", 0.52 + 0.18 * pulse);
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        ctx.beginPath();
        ctx.arc(
          x + col * cell + cell / 2,
          y + row * cell + cell / 2,
          1.45,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

  }

  function drawFullMatrixA(x, y, size, activeK) {
    panelTitle("Full A matrix", x, y, size);
    drawCompressedMatrix(x, y, size, 8, 8, ({ row, col, cell }) => {
      if (row === 2) {
        ctx.fillStyle = "#dbeafe";
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
      if (row === 2 && col === activeK % 8) {
        ctx.fillStyle = "rgba(190, 18, 60, 0.35)";
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
    });
    ctx.fillStyle = "#2563eb";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("row 34", x + 12, y + 2 * (size / 8) + 24);
    ctx.fillStyle = "#be123c";
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`A[34][i]`, x + 12 + (activeK % 8) * (size / 8), y + 2 * (size / 8) - 8);
    drawAxisLabel(x, y, size, "columns are K: 0..K-1");
  }

  function drawFullMatrixB(x, y, size, activeK) {
    panelTitle("Full B matrix", x, y, size);
    drawCompressedMatrix(x, y, size, 8, 8, ({ row, col, cell }) => {
      if (col === 3) {
        ctx.fillStyle = "#fef3c7";
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
      if (row === activeK % 8 && col === 3) {
        ctx.fillStyle = "rgba(190, 18, 60, 0.35)";
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
    });
    ctx.fillStyle = "#b45309";
    ctx.font = "700 13px ui-sans-serif, system-ui";
    ctx.fillText("col 3", x + 3 * (size / 8) + 5, y - 8);
    ctx.fillStyle = "#be123c";
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`B[i][3]`, x + 3 * (size / 8) + 4, y + (activeK % 8) * (size / 8) + 24);
    drawAxisLabel(x, y, size, "rows are K: 0..K-1");
  }

  function drawFullMatrixC(x, y, size, progress) {
    panelTitle("Full C matrix", x, y, size);
    drawCompressedMatrix(x, y, size, 8, 8, ({ row, col, cell }) => {
      if (row === 2 && col === 3) {
        ctx.fillStyle = "rgba(17, 138, 75, 0.25)";
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
      }
    });
    const cell = size / 8;
    pulseRect(x + 3 * cell, y + 2 * cell, cell, cell, "#118a4b", progress);
    ctx.fillStyle = "#118a4b";
    ctx.font = "700 13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("C[34][3]", x + 3 * cell - 8, y + 2 * cell - 8);
    drawAxisLabel(x, y, size, "output element owned by one thread");
  }

  function drawCompressedMatrix(x, y, size, rows, cols, paint) {
    const cell = size / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        paint({ row, col, cell });
        ctx.strokeStyle = "#d8dde8";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("compressed full-matrix view", x, y + size + 18);
  }

  function drawAxisLabel(x, y, size, label) {
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(label, x, y + size + 36);
  }

  function panelTitle(title, x, y, w, h = w) {
    roundRect(x - 12, y - 38, w + 24, h + 62, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 14);
  }

  function drawCallout(x, y, lines) {
    const lineHeight = 20;
    const width = Math.max(...lines.map((line) => measure(line))) + 30;
    const height = lines.length * lineHeight + 22;
    roundRect(x, y, width, height, 8, "#f9fbff", "#d8dde8");
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillStyle = lines[i] === "" ? "transparent" : "#1d2433";
      ctx.fillText(lines[i], x + 14, y + 24 + i * lineHeight);
    }
  }

  function drawFormula(x, y, text) {
    const width = Math.min(760, Math.max(420, measure(text) + 34));
    roundRect(x, y, width, 46, 8, "#eef2f7", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(text, x + 16, y + 29);
  }

  function drawArrow(x1, y1, x2, y2, color, progress) {
    const x = x1 + (x2 - x1) * progress;
    const y = y1 + (y2 - y1) * progress;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    line(x1, y1, x, y);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 12 * Math.cos(angle - 0.5), y - 12 * Math.sin(angle - 0.5));
    ctx.lineTo(x - 12 * Math.cos(angle + 0.5), y - 12 * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();
  }

  function bigText(text, x, y) {
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 36px ui-sans-serif, system-ui";
    ctx.fillText(text, x, y);
  }

  function dot(x, y, color, radius) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function pulseRect(x, y, w, h, color, progress) {
    ctx.fillStyle = withAlpha(color, 0.16 + 0.16 * Math.sin(progress * Math.PI * 2));
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
  }

  function roundRect(x, y, w, h, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function line(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function measure(text) {
    ctx.save();
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }

  function withAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  setupCanvas();
  updateTabs();
  requestAnimationFrame(tick);
})();
