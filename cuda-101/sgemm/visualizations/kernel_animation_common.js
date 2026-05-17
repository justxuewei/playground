(function () {
  const config = window.SGEMM_KERNEL_ANIMATION;
  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d");
  const tabs = document.querySelector("#tabs");
  const playButton = document.querySelector("#play");

  const W = 1200;
  const H = 680;
  const BLOCK = 32;
  const block = { x: 0, y: 0 };
  const stageMs = 4200;
  const codeHotspots = [];
  let selectedCodeStep = null;

  const kernelStages = {
    1: [
      {
        title: "C tile",
        note: "A block owns one 32x32 tile of C."
      },
      {
        title: "2D block",
        note: "threadIdx.x is the row inside the tile; threadIdx.y is the col."
      },
      {
        title: "Warp shape",
        note: "A warp walks down one fixed output column."
      },
      {
        title: "K-loop access",
        note: "A and C are strided across the warp; B is the same address."
      },
      {
        title: "Accumulate",
        note: "Each thread accumulates one output element in a register."
      },
      {
        title: "Write C",
        note: "The block writes the full 32x32 output tile."
      }
    ],
    2: [
      {
        title: "Code walkthrough",
        note: "Read the coalesced kernel in execution order: block index, 1D thread mapping, K loop, and writeback."
      },
      {
        title: "Block setup",
        note: "Start with blockIdx = (0, 0): one 1D block of 1024 threads owns the first 32x32 C tile."
      },
      {
        title: "Tile work",
        note: "Each thread computes one C element; threadIdx.x is remapped into a local row and column."
      },
      {
        title: "Warp shape",
        note: "A warp walks across one output row."
      },
      {
        title: "Coalescing",
        note: "Adjacent warp lanes touch adjacent memory addresses."
      },
      {
        title: "K-loop access",
        note: "A is broadcast-friendly; B and C are coalesced."
      },
      {
        title: "Accumulate",
        note: "Each thread accumulates one output element in a register."
      },
      {
        title: "Matrix grid",
        note: "The grid repeats that same coalesced block program across the full C matrix."
      }
    ]
  };

  const stages = kernelStages[config.kernel];
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

    if (config.kernel === 2) {
      if (stageIndex === 0) drawCodeWalkthroughStage(progress);
      if (stageIndex === 1) drawBlockStage(progress);
      if (stageIndex === 2) drawTileWorkStage(progress);
      if (stageIndex === 3) drawWarpStage(progress);
      if (stageIndex === 4) drawCoalescingStage(progress);
      if (stageIndex === 5) drawAccessStage(progress);
      if (stageIndex === 6) drawMatrixGridStage(progress);
      return;
    }

    if (stageIndex === 0) drawCTileStage(progress);
    if (stageIndex === 1) drawBlockStage(progress);
    if (stageIndex === 2) drawWarpStage(progress);
    if (stageIndex === 3) drawAccessStage(progress);
    if (stageIndex === 4) drawAccumulateStage(progress);
    if (stageIndex === 5) drawWriteStage(progress);
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
    drawCodeLine(745, 28);
  }

  function drawCodeLine(x, y) {
    const kernel1 = [
      "gridDim = (ceil(M/32), ceil(N/32));",
      "blockDim = (32, 32);",
      "row = blockIdx.x * 32 + threadIdx.x;",
      "sum += A[row * K + i] * B[i * N + col];",
      "tmp accumulates C[row][col] in one thread;",
      "C[row * N + col] = alpha * sum + beta * C[...]"
    ];
    const kernel2 = [
      "sgemm_global_mem_coalesce<32><<<gridDim, 1024>>>(...)",
      "threadIdx.x -> local row and local column;",
      "row = blockIdx.x * 32 + threadIdx.x / 32;",
      "lanes 0..31 -> B[i][0..31], C[0][0..31]",
      "A[0][i] broadcast; B/C are consecutive across lanes;",
      "gridDim repeats 32x32 tiles over C;",
      "same kernel logic runs for every C tile"
    ];
    const lines = config.kernel === 1 ? kernel1 : kernel2;
    roundRect(x, y - 19, 420, 40, 6, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(lines[stageIndex], x + 12, y + 5);
  }

  function drawCTileStage(progress) {
    drawMatrixTiles("Full C matrix, shown as 32x32 tiles", 370, 112, 360, {
      row: block.x,
      col: block.y,
      fill: "#dcfce7",
      stroke: "#118a4b"
    });
    drawCallout(58, 128, [
      "This is the full C matrix view.",
      "",
      "Each large square is one 32x32 tile,",
      "not one matrix element.",
      "",
      "gridDim = (ceil(M / 32), ceil(N / 32))",
      "blockIdx.x selects the row tile.",
      "blockIdx.y selects the column tile."
    ]);
    drawCallout(790, 128, [
      "Start with blockIdx = (0, 0):",
      "",
      "C rows 0..31",
      "C cols 0..31",
      "",
      "Step 2 zooms into this green tile."
    ]);
    pulseRect(370, 112, 90, 90, "#118a4b", progress);
  }

  function drawCodeWalkthroughStage(progress) {
    const codeX = 58;
    const codeY = 112;
    codeHotspots.length = 0;
    const active = selectedCodeStep ?? Math.min(4, Math.floor(progress * 5));
    const codeLines = [
      "dim3 gridDim((M + 31) / 32, (N + 31) / 32);",
      "dim3 blockDim(32 * 32);",
      "row = blockIdx.x * 32 + threadIdx.x / 32;",
      "col = blockIdx.y * 32 + threadIdx.x % 32;",
      "float sum = 0.0f;",
      "for (int i = 0; i < K; ++i) {",
      "  sum += A[row * K + i] * B[i * N + col];",
      "}",
      "C[row * N + col] = alpha * sum + beta * C[row * N + col];"
    ];

    roundRect(codeX - 18, codeY - 34, 665, 360, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 16px ui-sans-serif, system-ui";
    ctx.fillText("Kernel execution order", codeX, codeY - 10);

    for (let i = 0; i < codeLines.length; i += 1) {
      const group = coalescedCodeGroupForLine(i);
      const isActive = group === active;
      codeHotspots.push({
        x: codeX - 8,
        y: codeY + i * 30 + 4,
        w: 630,
        h: 25,
        step: group
      });
      if (isActive) {
        roundRect(codeX - 8, codeY + i * 30 + 4, 630, 25, 5, "#e8f7ef", "#118a4b");
      }
      ctx.fillStyle = isActive ? "#14532d" : "#1d2433";
      ctx.font = "14px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(codeLines[i], codeX, codeY + i * 30 + 23);
    }

    const steps = [
      ["Launch", "gridDim covers C with 32x32 block tiles."],
      ["Thread mapping", "threadIdx.x maps to local row and column."],
      ["Register sum", "Each thread keeps one private accumulator."],
      ["K loop", "All threads scan K for their C element."],
      ["Write C", "Warp lanes write consecutive C columns."]
    ];
    const cardX = 755;
    const cardY = 112;
    for (let i = 0; i < steps.length; i += 1) {
      const y = cardY + i * 78;
      const isActive = i === active;
      roundRect(cardX, y, 358, 58, 7, isActive ? "#fef3c7" : "#ffffff", isActive ? "#b45309" : "#d8dde8");
      ctx.fillStyle = isActive ? "#78350f" : "#1d2433";
      ctx.font = "700 13px ui-sans-serif, system-ui";
      ctx.fillText(`${i + 1}. ${steps[i][0]}`, cardX + 12, y + 22);
      ctx.fillStyle = "#5b6475";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText(steps[i][1], cardX + 12, y + 40);
    }
  }

  function coalescedCodeGroupForLine(line) {
    if (line <= 1) return 0;
    if (line <= 3) return 1;
    if (line === 4) return 2;
    if (line <= 7) return 3;
    return 4;
  }

  function codeHotspotAt(event) {
    if (stageIndex !== 0 || config.kernel !== 2) return null;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * W;
    const y = ((event.clientY - rect.top) / rect.height) * H;
    const hit = codeHotspots.find((spot) =>
      x >= spot.x && x <= spot.x + spot.w && y >= spot.y && y <= spot.y + spot.h
    );
    return hit ? hit.step : null;
  }

  function drawBlockStage(progress) {
    drawThreadBlockTile(420, 120, 330);
    if (config.kernel === 1) {
      drawCallout(60, 126, [
        "This is the selected C tile from step 1,",
        "zoomed in to its 32x32 elements.",
        "",
        "Kernel 1 launches a 2D block:",
        "  blockDim.x = 32",
        "  blockDim.y = 32",
        "",
        "threadIdx.x is the local row.",
        "threadIdx.y is the local col."
      ]);
      drawCallout(780, 126, [
        "For block (0, 0):",
        "",
        "thread (0, 0)  -> C[0][0]",
        "thread (31, 0) -> C[31][0]",
        "thread (0, 1)  -> C[0][1]"
      ]);
      drawThreadDots2D(420, 120, progress);
    } else {
      drawCallout(60, 126, [
        "This is the selected C tile from step 1,",
        "zoomed in to its 32x32 elements.",
        "",
        "Kernel 2 launches a 1D block:",
        "  blockDim.x = 1024",
        "  blockDim.y = 1",
        "",
        "threadIdx.y is always 0.",
        "",
        "All 1024 threads are active together."
      ]);
      drawCallout(780, 126, [
        "For block (0, 0):",
        "",
        "threadIdx.x = 0  -> C[0][0]",
        "threadIdx.x = 31 -> C[0][31]",
        "threadIdx.x = 32 -> C[1][0]",
        "",
        "The red cell is one static example."
      ]);
      drawParallelThreadsOverlay(420, 120, 330, progress);
      drawExampleThread1D(420, 120, 330, 0);
    }
  }

  function drawTileWorkStage(progress) {
    drawFormulaBox(74, 118, progress);
    drawRegister(650, 206, progress);
    drawThreadBlockTile(760, 122, 330);
    drawParallelThreadsOverlay(760, 122, 330, progress);
    drawExampleThread1D(760, 122, 330, 0);
    drawCallout(72, 470, [
      "Tile view:",
      "",
      "The selected block owns C[0..31][0..31].",
      "Each thread owns one output element.",
      "",
      "The red example is threadIdx.x = 0,",
      "which computes C[0][0]."
    ]);
  }

  function drawWarpStage(progress) {
    drawLocalTile(400, 122, 360);
    if (config.kernel === 1) {
      drawVerticalWarp(400, 122, 360, progress);
      drawCallout(60, 130, [
        "CUDA forms warps from linear thread order.",
        "",
        "With blockDim = (32, 32):",
        "warp 0 has threadIdx.y = 0",
        "and threadIdx.x = 0..31."
      ]);
      drawCallout(805, 130, [
        "So warp 0 computes:",
        "",
        "C[0..31][0]",
        "",
        "It is vertical: 32 rows, one column."
      ]);
    } else {
      drawHorizontalWarp(400, 122, 360, progress);
      drawCallout(60, 130, [
        "With blockDim.x = 1024:",
        "",
        "warp 0 has threadIdx.x = 0..31.",
        "Those ids map to one local row",
        "and 32 consecutive columns."
      ]);
      drawCallout(805, 130, [
        "So warp 0 computes:",
        "",
        "C[0][0..31]",
        "",
        "It is horizontal: one row, 32 columns.",
        "",
        "All 32 warp threads are shown together."
      ]);
    }
  }

  function drawAccessStage(progress) {
    if (config.kernel === 2) {
      drawKernel2KLoopAccessStage(progress);
      return;
    }

    drawMemoryPanel(72, 112, progress);
    drawWarpMiniTile(770, 148, progress);
    if (config.kernel === 1) {
      drawCallout(665, 438, [
        "At one K-loop step i, warp 0 reads:",
        "",
        "A[0..31][i]   -> strided by K",
        "B[i][0]       -> same address",
        "C[0..31][0]   -> strided by N"
      ]);
    } else {
      drawCallout(665, 438, [
        "At one K-loop step i, warp 0 reads:",
        "",
        "A[0][i]       -> same address",
        "B[i][0..31]   -> consecutive",
        "C[0][0..31]   -> consecutive"
      ]);
    }
  }

  function drawKernel2KLoopAccessStage(progress) {
    drawLocalTile(70, 126, 300);
    drawHorizontalWarp(70, 126, 300, progress);

    drawCallout(400, 118, [
      "At one K-loop step i, all 32 warp",
      "threads execute the same load/multiply",
      "instruction together.",
      "",
      "Because warp 0 is horizontal, row stays",
      "fixed while column changes across lanes."
    ]);

    drawKernel2AccessLane(
      400,
      310,
      "A",
      "all lanes read A[0][i]",
      "same address",
      "#2563eb",
      "same",
      progress
    );
    drawKernel2AccessLane(
      400,
      385,
      "B",
      "lanes read B[i][0..31]",
      "coalesced",
      "#b45309",
      "contiguous",
      progress
    );
    drawKernel2AccessLane(
      400,
      460,
      "C",
      "lanes write C[0][0..31]",
      "coalesced",
      "#118a4b",
      "contiguous",
      progress
    );

    drawCallout(805, 118, [
      "Memory picture for warp 0:",
      "",
      "A[0][i]       -> same address",
      "B[i][0..31]   -> consecutive",
      "C[0][0..31]   -> consecutive",
      "",
      "So B loads and C stores are coalesced."
    ]);
  }

  function drawKernel2AccessLane(x, y, name, detail, label, color, mode, progress) {
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText(name, x, y);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(detail, x + 30, y);

    roundRect(x + 30, y + 12, 310, 32, 6, "#f8fafc", "#d8dde8");
    const pulse = 0.62 + 0.18 * Math.sin(progress * Math.PI * 2);

    if (mode === "same") {
      ctx.fillStyle = colorWithAlpha(color, pulse);
      for (let i = 0; i < 16; i += 1) {
        const jitter = Math.sin(i * 0.8) * 3;
        ctx.beginPath();
        ctx.arc(x + 78 + jitter, y + 28, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      for (let i = 0; i < 32; i += 1) {
        ctx.fillStyle = colorWithAlpha(color, 0.28 + pulse * 0.24);
        ctx.fillRect(x + 45 + i * 7.2, y + 18, 7.2, 20);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 45, y + 18, 32 * 7.2, 20);
    }

    const fill = label === "coalesced" ? "#dcfce7" : "#ede9fe";
    const stroke = label === "coalesced" ? "#118a4b" : "#6d28d9";
    roundRect(x + 355, y + 15, 92, 26, 6, fill, stroke);
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(label, x + 364, y + 33);
  }

  function drawCoalescingStage(progress) {
    drawWarpLaneStrip(74, 122, progress);
    drawCoalescedSegment(
      430,
      126,
      "A read",
      "all lanes read A[0][i]",
      "#2563eb",
      "same"
    );
    drawCoalescedSegment(
      430,
      284,
      "B read",
      "lanes read B[i][0], B[i][1], ... B[i][31]",
      "#b45309",
      "contiguous"
    );
    drawCoalescedSegment(
      430,
      442,
      "C write",
      "lanes write C[0][0], C[0][1], ... C[0][31]",
      "#118a4b",
      "contiguous"
    );

    drawCallout(820, 126, [
      "Coalescing is a warp-level picture.",
      "",
      "For the same instruction, the warp lanes",
      "request nearby addresses.",
      "",
      "B and C form one contiguous row segment,",
      "so the GPU can combine the requests into",
      "fewer global-memory transactions."
    ]);
    drawCallout(820, 372, [
      "A is different:",
      "",
      "All lanes read the same A[0][i] value.",
      "That is broadcast/cache-friendly, but it",
      "is not a consecutive-address pattern."
    ]);
  }

  function drawWarpLaneStrip(x, y, progress) {
    roundRect(x - 12, y - 38, 270, 466, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText("Warp 0 lanes", x, y - 14);

    const rows = 8;
    const cols = 4;
    const cell = 42;
    const gap = 4;
    const pulse = 0.62 + 0.18 * Math.sin(progress * Math.PI * 2);
    for (let lane = 0; lane < 32; lane += 1) {
      const row = Math.floor(lane / cols);
      const col = lane % cols;
      const px = x + col * (cell + gap);
      const py = y + row * (cell + gap);
      roundRect(px, py, cell, cell, 6, colorWithAlpha("#be123c", 0.12 + pulse * 0.08), "#be123c");
      ctx.fillStyle = "#1d2433";
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(`${lane}`, px + (lane < 10 ? 15 : 11), py + 26);
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each lane is one thread in the warp.", x, y + 392);
  }

  function drawCoalescedSegment(x, y, title, subtitle, color, mode) {
    roundRect(x - 12, y - 36, 350, 116, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 12);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(subtitle, x, y + 6);

    if (mode === "same") {
      roundRect(x + 28, y + 32, 244, 34, 6, "#ede9fe", "#6d28d9");
      ctx.fillStyle = colorWithAlpha(color, 0.72);
      for (let lane = 0; lane < 32; lane += 1) {
        const jitter = Math.sin(lane * 0.9) * 4;
        ctx.beginPath();
        ctx.arc(x + 150 + jitter, y + 49, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#1d2433";
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillText("same address", x + 292, y + 54);
      return;
    }

    const cells = 32;
    const cell = 8;
    const startX = x + 18;
    for (let i = 0; i < cells; i += 1) {
      ctx.fillStyle = colorWithAlpha(color, 0.32);
      ctx.fillRect(startX + i * cell, y + 34, cell, 34);
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.6;
      ctx.strokeRect(startX + i * cell, y + 34, cell, 34);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(startX, y + 34, cells * cell, 34);
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("one contiguous 32-float segment", x + 78, y + 91);
  }

  function drawAccumulateStage(progress) {
    const cx = 228;
    const cy = 170;
    drawFormulaBox(74, 118, progress);
    drawRegister(cx + 565, cy + 88, progress);
    drawLocalTile(780, 350, 260);
    if (config.kernel === 1) {
      drawVerticalWarp(780, 350, 260, progress);
      drawCallout(650, 125, [
        "Example thread in warp 0:",
        "",
        "threadIdx = (0, 0)",
        "row = 32",
        "col = 0",
        "",
        "It owns C[0][0]."
      ]);
    } else {
      drawHorizontalWarp(780, 350, 260, progress);
      drawCallout(650, 125, [
        "Example thread in warp 0:",
        "",
        "threadIdx.x = 0",
        "row = 32",
        "col = 0",
        "",
        "It owns C[0][0]."
      ]);
    }
  }

  function drawWriteStage(progress) {
    drawMatrixTiles("C matrix", 735, 126, 330, {
      row: block.x,
      col: block.y,
      fill: "#dcfce7",
      stroke: "#118a4b"
    });
    drawLocalTile(105, 126, 330);
    if (config.kernel === 1) {
      drawVerticalWarp(105, 126, 330, progress);
      drawCallout(90, 505, [
        "Kernel 1 writes the same 32x32 C tile,",
        "but each warp writes a strided column."
      ]);
    } else {
      drawHorizontalWarp(105, 126, 330, progress);
      drawCallout(90, 505, [
        "Kernel 2 writes the same 32x32 C tile,",
        "but each warp writes consecutive columns."
      ]);
    }
    drawArrow(455, 292, 735, 292, "#118a4b", ease(progress));
    pulseRect(735, 126, 82.5, 82.5, "#118a4b", progress);
  }

  function drawMatrixGridStage(progress) {
    drawMatrixTiles("Full C matrix, shown as 32x32 tiles", 410, 126, 330, {
      row: block.x,
      col: block.y,
      fill: "#dcfce7",
      stroke: "#118a4b"
    });
    pulseRect(410, 126, 82.5, 82.5, "#118a4b", progress);
    drawCallout(66, 128, [
      "Matrix view:",
      "",
      "The previous stages followed",
      "the first block and its first",
      "32x32 C tile.",
      "",
      "Every other grid cell runs the",
      "same coalesced mapping."
    ]);
    drawCallout(800, 128, [
      "Kernel 2 rule:",
      "",
      "one block  -> one 32x32 C tile",
      "one thread -> one C element",
      "one warp   -> one C row segment",
      "",
      "That row-shaped warp gives",
      "coalesced B loads and C stores."
    ]);
  }

  function drawMemoryPanel(x, y, progress) {
    roundRect(x, y, 520, 360, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText("One warp, one K-loop step", x + 18, y + 30);

    if (config.kernel === 1) {
      drawAddressLane(x + 38, y + 78, "A", "A[0][i], A[1][i], ...", "strided", "#2563eb", false, progress);
      drawAddressLane(x + 38, y + 178, "B", "B[i][0] for every thread", "same address", "#b45309", "same", progress);
      drawAddressLane(x + 38, y + 278, "C", "C[0][0], C[1][0], ...", "strided", "#118a4b", false, progress);
    } else {
      drawAddressLane(x + 38, y + 78, "A", "A[0][i] for every thread", "same address", "#2563eb", "same", progress);
      drawAddressLane(x + 38, y + 178, "B", "B[i][0], B[i][1], ...", "coalesced", "#b45309", true, progress);
      drawAddressLane(x + 38, y + 278, "C", "C[0][0], C[0][1], ...", "coalesced", "#118a4b", true, progress);
    }
  }

  function drawAddressLane(x, y, name, detail, label, color, contiguous, progress) {
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(name, x, y);
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(detail, x + 30, y);
    roundRect(x + 30, y + 12, 360, 36, 6, "#f8fafc", "#d8dde8");

    const count = 12;
    const pulse = 0.62 + 0.2 * Math.sin(progress * Math.PI * 2);
    for (let i = 0; i < count; i += 1) {
      let px = x + 48 + i * 24;
      if (contiguous === false) px = x + 48 + i * 30;
      if (contiguous === "same") px = x + 58 + Math.sin(i * 0.8) * 3;
      ctx.fillStyle = colorWithAlpha(color, pulse);
      ctx.beginPath();
      ctx.arc(px, y + 30, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const fill = label === "coalesced" ? "#dcfce7" :
      label === "same address" ? "#ede9fe" : "#ffe4e6";
    const stroke = label === "coalesced" ? "#118a4b" :
      label === "same address" ? "#6d28d9" : "#be123c";
    roundRect(x + 405, y + 16, 82, 28, 6, fill, stroke);
    ctx.fillStyle = "#1d2433";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText(label, x + 414, y + 35);
  }

  function drawWarpMiniTile(x, y, progress) {
    const size = 290;
    drawLocalTile(x, y, size);
    if (config.kernel === 1) {
      drawVerticalWarp(x, y, size, progress);
    } else {
      drawHorizontalWarp(x, y, size, progress);
    }
  }

  function drawFormulaBox(x, y, progress) {
    roundRect(x, y, 520, 320, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText("Per-thread loop", x + 18, y + 30);

    const lines = [
      "float sum = 0.0f;",
      "for (int i = 0; i < K; ++i) {",
      "  sum += A[row * K + i] * B[i * N + col];",
      "}",
      "C[row * N + col] = alpha * sum + beta * C[...]"
    ];
    ctx.font = "15px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let i = 0; i < lines.length; i += 1) {
      const isActive = i === Math.min(4, Math.floor(progress * 5));
      if (isActive) {
        roundRect(x + 22, y + 58 + i * 42, 458, 30, 5, "#ede9fe", "#6d28d9");
      }
      ctx.fillStyle = "#1d2433";
      ctx.fillText(lines[i], x + 34, y + 79 + i * 42);
    }
  }

  function drawRegister(x, y, progress) {
    roundRect(x, y, 210, 76, 8, "#f4f7fb", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText("thread-local register", x + 18, y + 26);
    ctx.fillStyle = "#6d28d9";
    ctx.font = "18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`sum += ${Math.floor(progress * 32)} terms`, x + 18, y + 55);
  }

  function drawThreadDots2D(x, y, progress) {
    const size = 330;
    const cell = size / 32;
    const t = Math.floor(progress * 1023);
    const threadX = t % 32;
    const threadY = Math.floor(t / 32);
    const row = threadX;
    const col = threadY;
    const px = x + col * cell + cell / 2;
    const py = y + row * cell + cell / 2;
    drawGuideLine(x, py, size, "row", "#2563eb");
    drawGuideLine(px, y, size, "col", "#b45309");
    drawDot(px, py, "#be123c", 8);
    labelText(`threadIdx = (${threadX}, ${threadY})`, x, y + size + 37, "#be123c");
  }

  function drawThreadDots1D(x, y, progress) {
    const size = 330;
    const cell = size / 32;
    const t = Math.floor(progress * 1023);
    const row = Math.floor(t / 32);
    const col = t % 32;
    const px = x + col * cell + cell / 2;
    const py = y + row * cell + cell / 2;
    drawGuideLine(x, py, size, "row", "#2563eb");
    drawGuideLine(px, y, size, "col", "#b45309");
    drawDot(px, py, "#be123c", 8);
    labelText(`threadIdx.x = ${t}`, x, y + size + 37, "#be123c");
  }

  function drawParallelThreadsOverlay(x, y, size, progress) {
    const n = 32;
    const cell = size / n;
    const pulse = 0.5 + 0.2 * Math.sin(progress * Math.PI * 2);
    ctx.fillStyle = colorWithAlpha("#118a4b", 0.06 + 0.05 * pulse);
    ctx.fillRect(x, y, size, size);

    ctx.fillStyle = colorWithAlpha("#118a4b", 0.5 + 0.18 * pulse);
    for (let row = 0; row < n; row += 1) {
      for (let col = 0; col < n; col += 1) {
        ctx.beginPath();
        ctx.arc(
          x + col * cell + cell / 2,
          y + row * cell + cell / 2,
          1.35,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
    }

    labelText("all 1024 threads active in parallel", x, y + size + 37, "#118a4b");
  }

  function drawExampleThread1D(x, y, size, threadId) {
    const cell = size / 32;
    const row = Math.floor(threadId / 32);
    const col = threadId % 32;
    const px = x + col * cell + cell / 2;
    const py = y + row * cell + cell / 2;

    drawGuideLine(x, py, size, "row", "#2563eb");
    drawGuideLine(px, y, size, "col", "#b45309");
    ctx.fillStyle = "rgba(190, 18, 60, 0.26)";
    ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
    drawDot(px, py, "#be123c", 8);
    labelText(`example threadIdx.x = ${threadId}`, x, y + size + 55, "#be123c");
  }

  function drawVerticalWarp(x, y, size, progress) {
    const cell = size / 8;
    ctx.fillStyle = "rgba(190, 18, 60, 0.22)";
    ctx.fillRect(x, y, cell, size);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, cell, size);
    const py = y + Math.min(size - cell / 2, cell / 2 + progress * (size - cell));
    drawDot(x + cell / 2, py, "#be123c", 8);
  }

  function drawHorizontalWarp(x, y, size, progress) {
    const cell = size / 8;
    const alpha = 0.2 + 0.08 * Math.sin(progress * Math.PI * 2);
    ctx.fillStyle = `rgba(190, 18, 60, ${alpha})`;
    ctx.fillRect(x, y, size, cell);
    ctx.strokeStyle = "#be123c";
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, size, cell);
  }

  function drawLocalTile(x, y, size) {
    drawDenseTile("Local 32x32 C tile", x, y, size, "#f8fafc", "#9aa7bb");
  }

  function drawThreadBlockTile(x, y, size) {
    roundRect(x - 10, y - 34, size + 20, size + 58, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText("Zoomed selected C tile: 32x32 elements", x, y - 12);

    const cells = 32;
    const cell = size / cells;
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(x, y, size, size);
    ctx.strokeStyle = "#cad2df";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= cells; i += 1) {
      const pos = x + i * cell;
      ctx.beginPath();
      ctx.moveTo(pos, y);
      ctx.lineTo(pos, y + size);
      ctx.stroke();
      const rowPos = y + i * cell;
      ctx.beginPath();
      ctx.moveTo(x, rowPos);
      ctx.lineTo(x + size, rowPos);
      ctx.stroke();
    }

    ctx.strokeStyle = "#118a4b";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("Each small square is one C element and one CUDA thread.", x, y + size + 17);
  }

  function drawGuideLine(x, y, size, direction, color) {
    ctx.fillStyle = colorWithAlpha(color, 0.16);
    if (direction === "row") {
      ctx.fillRect(x, y - 3, size, 6);
    } else {
      ctx.fillRect(x - 3, y, 6, size);
    }
  }

  function drawDenseTile(title, x, y, size, fill, stroke) {
    roundRect(x - 10, y - 34, size + 20, size + 52, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 14px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 12);
    const cells = 8;
    const cell = size / cells;
    for (let row = 0; row < cells; row += 1) {
      for (let col = 0; col < cells; col += 1) {
        ctx.fillStyle = fill;
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 0.8;
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "11px ui-sans-serif, system-ui";
    ctx.fillText("visual grouping; actual tile is 32x32", x, y + size + 17);
  }

  function drawMatrixTiles(title, x, y, size, highlight) {
    roundRect(x - 12, y - 38, size + 24, size + 58, 8, "#ffffff", "#d8dde8");
    ctx.fillStyle = "#1d2433";
    ctx.font = "700 15px ui-sans-serif, system-ui";
    ctx.fillText(title, x, y - 14);

    const rows = 4;
    const cols = 4;
    const cell = size / rows;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const isHit = highlight && highlight.row === row && highlight.col === col;
        ctx.fillStyle = isHit ? highlight.fill : "#f8fafc";
        ctx.strokeStyle = isHit ? highlight.stroke : "#d8dde8";
        ctx.lineWidth = isHit ? 3 : 1;
        ctx.fillRect(x + col * cell, y + row * cell, cell, cell);
        ctx.strokeRect(x + col * cell, y + row * cell, cell, cell);
      }
    }
    ctx.fillStyle = "#5b6475";
    ctx.font = "12px ui-sans-serif, system-ui";
    ctx.fillText("Each large square is one 32x32 C tile.", x, y + size + 20);
  }

  function drawCallout(x, y, lines) {
    const lineHeight = 20;
    const width = Math.max(...lines.map((line) => measure(line))) + 28;
    const height = lines.length * lineHeight + 22;
    roundRect(x, y, width, height, 8, "#f9fbff", "#d8dde8");
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillStyle = lines[i] === "" ? "transparent" : "#1d2433";
      ctx.fillText(lines[i], x + 14, y + 24 + i * lineHeight);
    }
  }

  function drawArrow(x1, y1, x2, y2, color, progress) {
    const x = x1 + (x2 - x1) * progress;
    const y = y1 + (y2 - y1) * progress;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (progress > 0.12) {
      const angle = Math.atan2(y2 - y1, x2 - x1);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 12 * Math.cos(angle - 0.5), y - 12 * Math.sin(angle - 0.5));
      ctx.lineTo(x - 12 * Math.cos(angle + 0.5), y - 12 * Math.sin(angle + 0.5));
      ctx.closePath();
      ctx.fill();
    }
  }

  function pulseRect(x, y, w, h, color, progress) {
    const alpha = 0.18 + 0.18 * Math.sin(progress * Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = colorWithAlpha(color, alpha);
    ctx.fillRect(x, y, w, h);
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
    if (fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function drawDot(x, y, color, radius) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function labelText(text, x, y, color) {
    ctx.fillStyle = color;
    ctx.font = "700 12px ui-sans-serif, system-ui";
    ctx.fillText(text, x, y);
  }

  function measure(text) {
    ctx.save();
    ctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }

  function ease(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function colorWithAlpha(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  setupCanvas();
  updateTabs();
  requestAnimationFrame(tick);
})();
