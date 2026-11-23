(() => {
  "use strict";

  const width = 360;
  const height = 300;
  const gold = "#efbf43";
  const cream = "#ffe7bc";
  const outline = "#ffc986";
  const ink = "#7c3323";
  const copper = "#ae5b34";

  const rules = [
    ["database", /баз[а-я]*\s+данн|субд|(?<!\p{L})бд(?!\p{L})|нормализаци[яеи]\s+таблиц|реляционн[а-я]*\s+(?:модел|баз)|\b(?:sql|nosql|postgresql|database)\b/u],
    ["recurrence", /рекуррент|рекурс|последовательност|сумм[а-я]*\s+ряд|числ[а-я]*\s+фибоначчи|\b(?:recursive|recurrence|fibonacci)\b/u],
    ["network", /компьютерн[а-я]*\s+сет|сетев[а-я]*\s+протокол|сетев[а-я]*\s+архитектур|локальн[а-я]*\s+сет[ьи]|маршрутизац|телеком|\b(?:osi|tcp|dns|network|networking)\b/u],
    ["math", /математик|геометр|алгебр|тригонометр|мат[.\s]*анализ|дифференц|интеграл|вероятност|статистик|\b(?:calculus|mathematics|math)\b/u],
    ["science", /физик|биологи|анатоми|хими|астрономи|клетк|молекул|термодинамик|экологи|\b(?:physics|biology|chemistry)\b/u],
    ["history", /истори|археологи|философ|цивилизаци|культурологи|искусствовед|\b(?:history|archaeology|philosophy)\b/u],
    ["language", /лингвист|литератур|(?:русск|английск|немецк|испанск|китайск|французск)[а-я]*\s+язык|грамматик|фонетик|лексик|синтаксис\s+предложен|\b(?:linguistics|literature|grammar)\b/u],
    ["economics", /экономик|финанс|менеджмент|бухгалтер|маркетинг|инвестиц|валют|\b(?:economics|finance|marketing)\b/u],
    ["code", /программирован|алгоритм|разработк[а-я]*\s+(?:программ|сайт|приложен)|структур[а-я]*\s+данных|информатик|\bc\+\+|\bc#|\b(?:python|javascript|typescript|java|programming|coding)\b/u],
  ];
  const themes = Object.freeze([...rules.map(([name]) => name), "general"]);

  function themeFor(course = {}) {
    if (themes.includes(course.coverTheme)) return course.coverTheme;
    const topics = Array.isArray(course.topics) ? course.topics.map(topic => topic?.title) : [];
    for (const field of [course.title, course.subtitle, course.subject, ...topics]) {
      if (typeof field !== "string") continue;
      const text = field.toLowerCase().replace(/ё/g, "е");
      const match = rules.find(([, pattern]) => pattern.test(text));
      if (match) return match[0];
    }
    return "general";
  }

  function fingerprint(course) {
    // The title determines the variation so a reimport yields the same illustration.
    const title = String(course.title || course.subject || "");
    let hash = 2166136261;
    for (const letter of title.toLowerCase()) {
      hash = Math.imul(hash ^ letter.codePointAt(0), 16777619);
    }
    return hash >>> 0;
  }

  function createPainter(ctx) {
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    function path(points) {
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      for (const point of points.slice(1)) ctx.lineTo(...point);
    }

    function polygon(points, fill, edge = outline) {
      path(points);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = edge;
      ctx.stroke();
    }

    function line(points, color = cream, size = 1.75, dash = []) {
      path(points);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function dot([x, y], radius, color = cream, edge) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (edge) {
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }

    function ellipse([x, y], rx, ry, angle, color, size = 1.25, dash = []) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function gradient(x, y, toX, toY, from, to) {
      const fill = ctx.createLinearGradient(x, y, toX, toY);
      fill.addColorStop(0, from);
      fill.addColorStop(1, to);
      return fill;
    }

    function project(x, y, z = 0) {
      return [195 + (x - y) * .85, 177 + (x + y) * .43 - z];
    }

    function face(x, y, w, d, z) {
      return [
        project(x, y, z),
        project(x + w, y, z),
        project(x + w, y + d, z),
        project(x, y + d, z),
      ];
    }

    function block(x, y, w, d, z, thickness, top) {
      const base = face(x, y, w, d, z);
      const cap = face(x, y, w, d, z + thickness);
      polygon([cap[3], cap[2], base[2], base[3]], ink);
      polygon([cap[2], cap[1], base[1], base[2]], copper);
      polygon(cap, top, cream);
    }

    return { polygon, line, dot, ellipse, gradient, project, face, block };
  }

  function drawBackdrop(ctx, art, seed) {
    const glow = ctx.createRadialGradient(199, 144, 16, 199, 144, 143);
    glow.addColorStop(0, "rgba(255, 195, 86, .32)");
    glow.addColorStop(1, "rgba(255, 195, 86, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const offset = seed % 9;
    for (let x = 33 + offset; x < 340; x += 16) {
      for (let y = 27; y < 277; y += 16) {
        art.dot([x, y], .65, "rgba(255, 232, 188, .26)");
      }
    }
    art.ellipse([195, 160], 132, 59, -.22, "rgba(255, 235, 190, .53)", 1, [2, 5]);
  }

  function drawSparks(art, seed) {
    const group = [
      [291 + seed % 8, 57, 12, gold],
      [316, 44, 4, cream],
      [69, 102 + seed % 13, 6, cream],
      [282, 225, 7, gold],
    ];
    for (const [x, y, size, color] of group) {
      const inner = size * .23;
      art.polygon([
        [x, y - size], [x + inner, y - inner], [x + size, y],
        [x + inner, y + inner], [x, y + size], [x - inner, y + inner],
        [x - size, y], [x - inner, y - inner],
      ], color, color);
    }
    art.dot([61, 190], 2.4, outline);
  }

  function drawDatabase(art, seed) {
    const { block, gradient, face, polygon, project, dot } = art;
    const goldTop = gradient(91, 150, 296, 150, "#c97434", gold);
    const lowerTop = gradient(91, 170, 296, 170, "#a9532e", "#d78b45");
    const layers = [0, 25, 50];
    for (const z of layers) {
      block(-64, -64, 128, 128, z, 17, z === 50 ? goldTop : lowerTop);
      for (let i = 0; i < 3; i += 1) {
        dot(project(-48 + i * 14, 64, z + 8), 1.7, i === 0 && z === 50 ? cream : outline);
      }
    }
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const accent = row * 3 + col === seed % 9;
        polygon(face(-32 + col * 22, -32 + row * 22, 18, 18, 67), accent ? cream : "#c77a3a", cream);
      }
    }
  }

  function drawRecurrence(art, seed) {
    const { block, gradient, project, line, dot } = art;
    const heights = [17, 28, 44, 68, 105];
    const positions = heights.map((z, i) => ({ x: -67 + 31 * i, y: 58 - 16 * i, z }));
    block(-82, -17, 168, 105, -7, 7, "#b06138");
    for (const [i, { x, y, z }] of positions.entries()) {
      const top = gradient(92, 166, 288, 82, "#d28138", i === 4 ? cream : gold);
      block(x, y, 22, 22, 0, z, top);
    }
    const points = positions.map(({ x, y, z }) => project(x + 11, y + 11, z + 10));
    line(points, cream, 2.2);
    points.forEach((point, index) => dot(point, index === 4 ? 5.2 : 3.5, index === seed % points.length ? cream : gold, cream));
  }

  function drawNetwork(art, seed) {
    const { block, gradient, project, line, dot, ellipse } = art;
    const devices = [[-64, -50], [51, -44], [-60, 53], [58, 52]];
    const nodes = devices.map(([x, y]) => project(x, y));
    for (const [i, [x, y]] of devices.entries()) {
      const elbow = project(x * .42, y);
      line([nodes[i], elbow, project(0, 0)], outline, 2, [4, 4]);
    }
    for (const [i, [x, y]] of devices.entries()) {
      const active = i === seed % devices.length;
      block(x - 15, y - 15, 30, 30, 0, 10, active ? gold : "#cb7840");
      dot(project(x, y, 10), active ? 3.6 : 2.6, cream);
    }
    const goldTop = gradient(125, 125, 271, 169, "#d1833a", gold);
    block(-31, -31, 62, 62, 0, 15, "#b86736");
    block(-28, -28, 56, 56, 19, 12, goldTop);
    const center = project(0, 0, 32);
    ellipse(center, 16, 8, 0, cream, 1.8);
    dot(center, 4.1, cream);
    for (const sign of [-1, 1]) {
      line([[center[0] + sign * 19, center[1] + 3], [center[0] + sign * 28, center[1] + 8]], cream, 1.3);
    }
  }

  function drawCode(art, seed) {
    const { block, polygon, gradient, line, dot } = art;
    block(-68, -47, 130, 100, -11, 12, "#ca773c");
    const panel = [[115, 77], [286, 59], [286, 159], [115, 181]];
    polygon([[286, 59], [298, 66], [298, 166], [286, 159]], copper);
    polygon(panel, gradient(115, 77, 286, 161, "#713122", "#9d4929"), cream);
    polygon([[115, 77], [286, 59], [286, 81], [115, 101]], gold, cream);
    for (let i = 0; i < 3; i += 1) dot([129 + i * 11, 87 - i], 2.2, i === seed % 3 ? ink : "#b36236");
    line([[137, 120], [150, 127], [137, 138]], cream, 2.3);
    line([[162, 137], [182, 135]], cream, 2.3);
    line([[210, 115], [263, 108]], outline, 1.7);
    line([[210, 128], [249, 123]], outline, 1.7);
  }

  function drawMath(art, seed) {
    const { block, project, line, dot } = art;
    block(-75, -65, 150, 130, -8, 8, "#bc6a3b");
    for (let x = -60; x <= 60; x += 20) {
      line([project(x, -55), project(x, 55)], "rgba(255, 229, 188, .48)", 1);
    }
    for (let y = -50; y <= 50; y += 20) {
      line([project(-64, y), project(64, y)], "rgba(255, 229, 188, .48)", 1);
    }
    line([project(-65, 0), project(79, 0)], cream, 1.6);
    line([project(0, 62), project(0, -72)], cream, 1.6);
    const scale = 40 + seed % 15;
    const points = Array.from({ length: 19 }, (_, i) => {
      const x = -59 + i * 6.6;
      return project(x, 4, 7 + (x / 62) ** 2 * scale);
    });
    line(points, cream, 3);
    for (const i of [1, 5, 9, 13, 17]) {
      line([project(-59 + i * 6.6, 4), points[i]], outline, .9, [3, 3]);
      dot(points[i], 4, gold, cream);
    }
  }

  function drawScience(art, seed) {
    const { block, ellipse, gradient, dot } = art;
    block(-51, -51, 102, 102, -7, 12, gradient(130, 170, 255, 211, "#c06a39", gold));
    const center = [196, 124];
    const rotation = (seed % 13 - 6) * .025;
    for (let i = 0; i < 3; i += 1) {
      const angle = -.27 + i * Math.PI / 3 + rotation;
      ellipse(center, 82, 27, angle, i === 1 ? gold : cream, 1.5);
      const pathPosition = (i / 3) * Math.PI * 2 + .25;
      const x = 82 * Math.cos(pathPosition);
      const y = 27 * Math.sin(pathPosition);
      dot([center[0] + x * Math.cos(angle) - y * Math.sin(angle), center[1] + x * Math.sin(angle) + y * Math.cos(angle)], 4.2, gold, cream);
    }
    dot(center, 13, "#dc903a", cream);
    dot([196, 121], 5.4, cream);
  }

  function drawHistory(art, seed) {
    const { block, polygon, line, gradient, project } = art;
    block(-70, -47, 136, 108, -8, 10, "#ba693c");
    const pillarCount = 3 + seed % 2;
    for (let i = 0; i < pillarCount; i += 1) {
      const x = -61 + i * (104 / (pillarCount - 1));
      block(x, 20, 15, 17, 2, 7, gold);
      block(x + 3, 22, 9, 13, 9, 69, gradient(126, 158, 264, 117, "#d18443", gold));
      block(x, 20, 15, 17, 78, 7, cream);
    }
    block(-70, 13, 136, 31, 84, 11, "#d58a45");
    const left = project(-70, 44, 95);
    const right = project(66, 44, 95);
    const apex = project(0, 33, 132);
    polygon([left, apex, right], gradient(108, 132, 284, 95, "#c06e3a", gold), cream);
    line([left, right], cream, 1.5);
  }

  function drawLanguage(art, seed) {
    const { polygon, gradient, line, dot } = art;
    const back = gradient(95, 78, 244, 154, "#ab5331", "#d48b49");
    polygon([[92, 86], [244, 69], [244, 145], [127, 158], [113, 177], [113, 159], [92, 163]], back, cream);
    line([[110, 108], [209, 98]], cream, 1.8);
    line([[110, 122], [187, 114]], cream, 1.8);
    const front = gradient(146, 132, 298, 212, "#db953f", gold);
    polygon([[148, 135], [297, 116], [297, 201], [271, 204], [271, 223], [247, 208], [148, 222]], front, cream);
    for (let i = 0; i < 3; i += 1) {
      dot([191 + i * 31, 173 - i * 4], i === seed % 3 ? 5.8 : 4.2, i === seed % 3 ? cream : ink);
    }
  }

  function drawEconomics(ctx, art, seed) {
    const { block, ellipse, project, gradient, line } = art;
    block(-70, -58, 143, 111, -7, 7, "#bb6a38");
    const groups = [[-39, 20, 4], [3, -1, 7], [47, -23, 10]];
    for (const [x, y, layers] of groups) {
      for (let i = 0; i < layers; i += 1) {
        const [cx, cy] = project(x, y, 6 * (i + 1));
        ctx.beginPath();
        ctx.ellipse(cx, cy, 25, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = gradient(cx - 25, cy, cx + 25, cy, "#ba6c35", i === layers - 1 ? gold : "#d69545");
        ctx.fill();
        ellipse([cx, cy], 25, 11, 0, outline, 1);
      }
      ellipse(project(x, y, 6 * layers), 18, 7, 0, cream, 1);
    }
    const y = 82 + seed % 11;
    line([[122, y + 36], [176, y + 22], [210, y + 24], [260, y - 8]], cream, 2);
    line([[248, y - 7], [260, y - 8], [256, y + 4]], cream, 2);
  }

  function drawGeneral(art, seed) {
    const { polygon, gradient, line } = art;
    const angle = seed % 9 - 4;
    const pages = gradient(94, 103, 302, 196, "#e29c47", gold);
    polygon([[88, 125], [139, 103], [194, 109], [241, 84], [297, 90], [297, 184], [240, 178], [194, 204], [139, 197], [88, 219]], ink);
    polygon([[88, 116], [139, 94], [194, 100], [194, 193], [139, 187], [88, 209]], pages, cream);
    polygon([[194, 100], [241, 74], [297, 81], [297, 174], [240, 167], [194, 193]], "#f0ac51", cream);
    line([[194, 101], [194, 193]], "#9a512c", 2);
    for (let i = 0; i < 4; i += 1) {
      const y = 121 + 14 * i;
      line([[111, y + 9], [140, y - 4], [168 + (i % 2) * angle, y - 1]], "#a96034", 1.5);
      line([[219, y - 5], [242, y - 16], [273 - (i % 2) * angle, y - 13]], "#a96034", 1.5);
    }
    const x = 251 + seed % 15;
    polygon([[x, 76], [x + 12, 78], [x + 12, 121], [x + 6, 114], [x, 118]], "#bc5531", cream);
  }

  const drawTheme = {
    database: drawDatabase,
    recurrence: drawRecurrence,
    network: drawNetwork,
    math: drawMath,
    science: drawScience,
    history: drawHistory,
    language: drawLanguage,
    economics: drawEconomics,
    code: drawCode,
    general: drawGeneral,
  };

  function draw(canvas, course = {}) {
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas.width || !canvas.height) return;

    const theme = themeFor(course);
    const seed = fingerprint(course);
    const scale = Math.min(canvas.width / width, canvas.height / height);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    try {
      ctx.translate((canvas.width - width * scale) / 2, (canvas.height - height * scale) / 2);
      ctx.scale(scale, scale);
      const art = createPainter(ctx);
      drawBackdrop(ctx, art, seed);
      if (theme === "economics") drawEconomics(ctx, art, seed);
      else drawTheme[theme](art, seed);
      drawSparks(art, seed);
    } finally {
      ctx.restore();
    }
  }

  window.StudyCovers = { draw, themeFor, themes };
})();
