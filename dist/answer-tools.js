(() => {
  "use strict";

  const tools = [
    ["text", "Текст"],
    ["table", "Таблица"],
    ["drawing", "Рисунок"],
  ];
  const drafts = new Map();
  const maxColumns = 8;
  const maxRows = 20;
  const maxTables = 6;
  const maxStrokes = 80;
  const maxPoints = 480;

  function escape(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function keyFor(courseId, taskId) {
    return `kt-praktikum-answer-v1:${encodeURIComponent(courseId)}:${encodeURIComponent(taskId)}`;
  }

  function defaultMode(task) {
    if (tools.some(([mode]) => mode === task.answerMode)) return task.answerMode;
    if (/нарисуй|построй|заполни|составь/i.test(task.prompt) && /таблиц|ведомост/i.test(task.prompt)) return "table";
    if (/нарисуй|изобрази/i.test(task.prompt)) return "drawing";
    return "text";
  }

  function blankTable(headers = []) {
    const columns = headers.slice(0, maxColumns);
    if (!columns.length) columns.push("", "", "");
    return { name: "", headers: columns, keys: [], rows: Array.from({ length: 4 }, () => columns.map(() => "")) };
  }

  function getDraft(key, task) {
    if (drafts.has(key)) return drafts.get(key);
    const draft = { mode: defaultMode(task), text: "", tableIndex: 0, tables: [blankTable(task.answerColumns)], strokes: [] };
    const validTable = table => Array.isArray(table?.headers) && table.headers.length > 0 && table.headers.length <= maxColumns &&
      Array.isArray(table.rows) && table.rows.length <= maxRows &&
      table.rows.every(row => Array.isArray(row) && row.length === table.headers.length) && Array.isArray(table.keys);
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && tools.some(([mode]) => mode === saved.mode) && Array.isArray(saved.tables) &&
          saved.tables.length <= maxTables && saved.tables.every(validTable) &&
          Number.isInteger(saved.tableIndex) && saved.tables[saved.tableIndex] && Array.isArray(saved.strokes)) {
        Object.assign(draft, saved);
      }
    } catch {
      // Editing remains available when this browser blocks local storage.
    }
    drafts.set(key, draft);
    return draft;
  }

  function save(key, root) {
    try {
      localStorage.setItem(key, JSON.stringify(drafts.get(key)));
    } catch {
      root.querySelector(".answer-storage-status").textContent = "Черновик доступен до закрытия страницы. Браузер не смог сохранить его.";
    }
  }

  function renderGrid(draft, locked) {
    const data = draft.tables[draft.tableIndex];
    const disabled = locked ? "disabled" : "";
    return `<div class="answer-grid-controls">
      <label class="sr-only" for="answer-table-select">Выбрать таблицу ответа</label>
      <select class="text-input" id="answer-table-select" data-answer-table-select>${draft.tables.map((_, index) =>
        `<option value="${index}" ${index === draft.tableIndex ? "selected" : ""}>Таблица ${index + 1}</option>`).join("")}</select>
      <label class="sr-only" for="answer-table-name">Название таблицы</label>
      <input class="text-input" type="text" id="answer-table-name" data-answer-table-name maxlength="80" placeholder="Название таблицы" value="${escape(data.name)}" ${disabled}>
      ${locked ? "" : `<button type="button" class="button secondary" data-workspace-action="table" ${draft.tables.length >= maxTables ? "disabled" : ""}>Ещё таблица</button>`}
    </div>
    <div class="answer-table-scroll" tabindex="0" role="region" aria-label="Таблица ответа">
      <table class="answer-table">
        <thead><tr><th scope="col" class="answer-row-number">№</th>${data.headers.map((value, index) => `<th scope="col">
          <input type="text" maxlength="80" data-answer-header="${index}" aria-label="Название столбца ${index + 1}" placeholder="Столбец ${index + 1}" value="${escape(value)}" ${disabled}>
          <label class="answer-key"><input type="checkbox" data-answer-key-column="${index}" ${data.keys.includes(index) ? "checked" : ""} ${disabled}><span>Ключ</span></label>
        </th>`).join("")}</tr></thead>
        <tbody>${data.rows.map((row, i) => `<tr><th scope="row" class="answer-row-number">${i + 1}</th>${row.map((value, j) => `<td>
          <input type="text" maxlength="160" data-answer-cell data-row="${i}" data-column="${j}" aria-label="Строка ${i + 1}, столбец ${j + 1}" value="${escape(value)}" ${disabled}>
        </td>`).join("")}</tr>`).join("")}</tbody>
      </table>
    </div>
    ${locked ? "" : `<div class="inline-actions answer-table-actions">
      <button type="button" class="button secondary" data-workspace-action="row" ${data.rows.length >= maxRows ? "disabled" : ""}>Добавить строку</button>
      <button type="button" class="button secondary" data-workspace-action="column" ${data.headers.length >= maxColumns ? "disabled" : ""}>Добавить столбец</button>
    </div>`}`;
  }

  function render(courseId, task, locked) {
    const key = keyFor(courseId, task.id);
    const data = getDraft(key, task);
    return `<section class="answer-workspace" data-answer-workspace="${escape(key)}" data-locked="${Boolean(locked)}" aria-label="Твой ход решения">
      <div class="answer-mode-buttons" role="group" aria-label="Как ответить">
        ${tools.map(([mode, label]) => `<button type="button" class="button secondary" data-answer-mode="${mode}" aria-pressed="${data.mode === mode}">${label}</button>`).join("")}
      </div>
      <div data-answer-pane="text" ${data.mode === "text" ? "" : "hidden"}>
        <label class="sr-only" for="task-answer">Письменное решение</label>
        <textarea class="answer-input" id="task-answer" rows="5" maxlength="8000" placeholder="Напиши шаги решения…" ${locked ? "readonly" : ""}>${escape(data.text)}</textarea>
      </div>
      <div data-answer-pane="table" ${data.mode === "table" ? "" : "hidden"}>
        <p class="answer-tool-help">Заполни ячейки. Если нужен ключ, отметь его столбцы. Для разбиения добавь ещё таблицу.</p>
        <div class="answer-table-editor">${renderGrid(data, locked)}</div>
      </div>
      <div data-answer-pane="drawing" ${data.mode === "drawing" ? "" : "hidden"}>
        <p class="answer-tool-help">Рисуй мышью, стилусом или пальцем. Можно также прикрепить фото решения.</p>
        <canvas class="answer-canvas" width="1000" height="460" aria-label="Поле рисунка"></canvas>
        ${locked ? "" : `<button type="button" class="button secondary answer-undo" data-workspace-action="undo" ${data.strokes.length ? "" : "disabled"}>Отменить штрих</button>`}
      </div>
      <p class="answer-storage-status" role="status"></p>
    </section>`;
  }

  function paint(canvas, strokes) {
    const context = canvas.getContext("2d");
    if (!context) return;
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    context.lineWidth = 3.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#893720";
    context.fillStyle = "#893720";
    for (const stroke of strokes) {
      if (!stroke.length) continue;
      const [x, y] = stroke[0];
      context.beginPath();
      if (stroke.length === 1) {
        context.arc(x * width, y * height, 1.75, 0, 2 * Math.PI);
        context.fill();
        continue;
      }
      context.moveTo(x * width, y * height);
      for (const [px, py] of stroke.slice(1)) context.lineTo(px * width, py * height);
      context.stroke();
    }
  }

  function hookDrawing(root, data, key, canvas) {
    let activePointer = null;
    let stroke;
    const undo = root.querySelector(".answer-undo");
    const point = event => {
      const rect = canvas.getBoundingClientRect();
      const clamp = value => Math.round(Math.min(1, Math.max(0, value)) * 10000) / 10000;
      return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
    };
    canvas.addEventListener("pointerdown", event => {
      if (activePointer !== null || event.button !== 0 || data.strokes.length >= maxStrokes) return;
      activePointer = event.pointerId;
      canvas.setPointerCapture(activePointer);
      stroke = [point(event)];
      data.strokes.push(stroke);
      undo.disabled = false;
      paint(canvas, data.strokes);
    });
    canvas.addEventListener("pointermove", event => {
      if (event.pointerId !== activePointer || stroke.length >= maxPoints) return;
      const next = point(event);
      const previous = stroke[stroke.length - 1];
      if (next[0] === previous[0] && next[1] === previous[1]) return;
      stroke.push(next);
      paint(canvas, data.strokes);
    });
    const finish = event => {
      if (event.pointerId !== activePointer) return;
      activePointer = null;
      save(key, root);
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("lostpointercapture", finish);
  }

  function hydrate(container) {
    for (const root of container.querySelectorAll("[data-answer-workspace]")) {
      const key = root.dataset.answerWorkspace;
      const data = drafts.get(key);
      const canvas = root.querySelector(".answer-canvas");
      const locked = root.dataset.locked === "true";
      const editor = root.querySelector(".answer-table-editor");
      const refreshGrid = target => {
        editor.innerHTML = renderGrid(data, locked);
        editor.querySelector(target)?.focus({ preventScroll: true });
      };
      paint(canvas, data.strokes);
      if (!locked) hookDrawing(root, data, key, canvas);
      root.addEventListener("keydown", event => {
        if (event.key === "Enter" && event.target.matches("input[type=text]")) event.preventDefault();
      });
      root.addEventListener("click", event => {
        const button = event.target.closest("button");
        if (!button) return;
        const mode = button.dataset.answerMode;
        const action = button.dataset.workspaceAction;
        if (mode) {
          data.mode = mode;
          for (const item of root.querySelectorAll("[data-answer-mode]")) item.setAttribute("aria-pressed", item === button);
          for (const panel of root.querySelectorAll("[data-answer-pane]")) panel.hidden = panel.dataset.answerPane !== mode;
        } else if (action === "undo" && !locked) {
          data.strokes.pop();
          button.disabled = !data.strokes.length;
          paint(canvas, data.strokes);
        } else if (!locked && action === "table" && data.tables.length < maxTables) {
          data.tableIndex = data.tables.length;
          data.tables.push(blankTable());
          refreshGrid("#answer-table-name");
        } else if (!locked && (action === "row" || action === "column")) {
          const table = data.tables[data.tableIndex];
          if (action === "row" && table.rows.length < maxRows) table.rows.push(table.headers.map(() => ""));
          if (action === "column" && table.headers.length < maxColumns) {
            table.headers.push("");
            for (const row of table.rows) row.push("");
          }
          refreshGrid(action === "row" ? `[data-row="${table.rows.length - 1}"]` : `[data-answer-header="${table.headers.length - 1}"]`);
        } else {
          return;
        }
        save(key, root);
      });
      root.addEventListener("input", event => {
        if (locked) return;
        const field = event.target;
        const table = data.tables[data.tableIndex];
        if (field.id === "task-answer") {
          data.text = field.value;
        } else if (field.hasAttribute("data-answer-cell")) {
          table.rows[Number(field.dataset.row)][Number(field.dataset.column)] = field.value;
        } else if ("answerHeader" in field.dataset) {
          table.headers[Number(field.dataset.answerHeader)] = field.value;
        } else if ("answerTableName" in field.dataset) {
          table.name = field.value;
        } else if ("answerKeyColumn" in field.dataset) {
          const column = Number(field.dataset.answerKeyColumn);
          table.keys = field.checked ? [...new Set([...table.keys, column])] : table.keys.filter(item => item !== column);
        } else {
          return;
        }
        save(key, root);
      });
      root.addEventListener("change", event => {
        if (!event.target.hasAttribute("data-answer-table-select")) return;
        const index = Number(event.target.value);
        if (!data.tables[index]) return;
        data.tableIndex = index;
        refreshGrid("#answer-table-select");
        save(key, root);
      });
    }
  }

  function readText(courseId, task) {
    return getDraft(keyFor(courseId, task.id), task).text;
  }

  window.StudyAnswers = { render, hydrate, readText };
})();
