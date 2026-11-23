(() => {
  'use strict';

  const maxFormulaLength = 1000;
  const interactiveRoots = new WeakSet();
  let diagramNumber = 0;

  function text(value, limit = 4000) {
    return typeof value === 'string' ? value.trim().slice(0, limit) : '';
  }

  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
  }

  function tableCell(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : text(value, 500);
  }

  function normalizeTable(input) {
    if (input?.type !== 'table' || !Array.isArray(input.columns) || !Array.isArray(input.rows)) return null;
    const columns = input.columns.slice(0, 12).map((value) => text(value, 120));
    if (!columns.length || columns.some((column) => !column)) return null;

    const rows = input.rows.slice(0, 60).filter(Array.isArray)
      .map((row) => columns.map((_, index) => tableCell(row[index])));
    return rows.length ? { type: 'table', title: text(input.title, 150), columns, rows } : null;
  }

  function normalizeSteps(input) {
    if (!Array.isArray(input.steps)) return null;
    const steps = input.steps.slice(0, 16).flatMap((step) => {
      const body = text(step?.text);
      if (!body) return [];
      const table = normalizeTable(step.table);
      return [{ title: text(step.title, 150), text: body, ...(table ? { table } : {}) }];
    });
    if (!steps.length) return null;
    const initial = Number.isInteger(input.initial) ? Math.min(steps.length, Math.max(1, input.initial)) : 1;
    return { type: 'steps', title: text(input.title, 150), steps, initial };
  }

  function normalizeCheck(input) {
    if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 6) return null;
    const question = text(input.question, 500);
    const options = input.options.map((option) => text(option, 300));
    const explanation = text(input.explanation, 1200);
    const answer = input.answer;
    if (!question || !explanation || options.some((option) => !option) ||
      !Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;
    return { type: 'check', question, options, answer, explanation };
  }

  function normalizeFormula(value) {
    const formula = text(value, maxFormulaLength);
    const pairs = [['\\(', '\\)'], ['\\[', '\\]'], ['$$', '$$'], ['$', '$']];
    const pair = pairs.find(([left, right]) =>
      formula.length > left.length + right.length && formula.startsWith(left) && formula.endsWith(right));
    return pair ? formula.slice(pair[0].length, -pair[1].length).trim() : formula;
  }

  function normalizeDiagram(input) {
    if (!Array.isArray(input.nodes) || !Array.isArray(input.edges)) return null;
    const ids = new Set();
    const nodes = input.nodes.slice(0, 12).flatMap((node) => {
      const id = text(node?.id, 80);
      const label = text(node?.label, 64);
      if (!id || !label || ids.has(id)) return [];
      ids.add(id);
      return [{ id, label }];
    });
    if (!nodes.length) return null;
    const edges = input.edges.slice(0, 24).flatMap((edge) => {
      const from = text(edge?.from, 80);
      const to = text(edge?.to, 80);
      return ids.has(from) && ids.has(to) ? [{ from, to, label: text(edge.label, 48) }] : [];
    });
    return { type: 'diagram', title: text(input.title, 150), nodes, edges };
  }

  function normalizeBlock(input) {
    if (!input || typeof input !== 'object') return null;
    switch (input.type) {
      case 'table': return normalizeTable(input);
      case 'steps': return normalizeSteps(input);
      case 'check': return normalizeCheck(input);
      case 'diagram': return normalizeDiagram(input);
      case 'math': {
        const formula = normalizeFormula(input.formula);
        return formula ? { type: 'math', formula, caption: text(input.caption, 800) } : null;
      }
      case 'code': {
        const code = text(input.code, 6000);
        return code ? { type: 'code', code, caption: text(input.caption, 500) } : null;
      }
      default: return null;
    }
  }

  function normalizeBlocks(input) {
    return Array.isArray(input) ? input.slice(0, 20).map(normalizeBlock).filter(Boolean) : [];
  }

  function renderTable(block) {
    return `<div class="study-block study-table">
      <div class="study-table-scroll" tabindex="0" role="region" aria-label="${escape(block.title || 'Таблица')}">
        <table>
          ${block.title ? `<caption data-study-math>${escape(block.title)}</caption>` : ''}
          <thead><tr>${block.columns.map((column) => `<th scope="col" data-study-math>${escape(column)}</th>`).join('')}</tr></thead>
          <tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td data-study-math>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
  }

  function renderSteps(block) {
    const total = block.steps.length;
    return `<section class="study-block study-steps" data-study-steps data-initial="${block.initial}">
      <h4 data-study-math>${escape(block.title || 'Пошаговый разбор')}</h4>
      <ol class="study-step-list">${block.steps.map((step, index) => `
        <li class="study-step" data-study-step${index >= block.initial ? ' hidden' : ''}>
          ${step.title ? `<strong data-study-math>${escape(step.title)}</strong>` : ''}
          <div class="preserve-lines" data-study-math>${escape(step.text)}</div>
          ${step.table ? renderTable(step.table) : ''}
        </li>`).join('')}</ol>
      ${total > 1 ? `<div class="study-controls">
        <button class="button secondary" type="button" data-study-next${block.initial === total ? ' hidden' : ''}>Следующий шаг</button>
        <button class="button ghost" type="button" data-study-restart hidden>Начать сначала</button>
        <span class="study-step-status" aria-live="polite">Шаги: ${block.initial} из ${total}</span>
      </div>` : ''}
    </section>`;
  }

  function renderCheck(block) {
    return `<fieldset class="study-block study-check" data-study-check data-answer="${block.answer}">
      <legend>Мини-проверка</legend>
      <p class="study-check-question" data-study-math>${escape(block.question)}</p>
      <div class="study-check-options">${block.options.map((option, index) => `
        <button class="button secondary study-choice" type="button" aria-pressed="false" data-study-choice="${index}"><span data-study-math>${escape(option)}</span></button>`).join('')}</div>
      <div class="study-check-feedback" aria-live="polite" hidden>
        <strong data-study-result></strong>
        <p data-study-math>${escape(block.explanation)}</p>
      </div>
    </fieldset>`;
  }

  function splitLabel(label) {
    const lines = [];
    let row = '';
    for (const word of label.split(/\s+/)) {
      if (row && row.length + word.length + 1 > 16) {
        lines.push(row);
        row = '';
      }
      if (word.length > 16) {
        if (row) lines.push(row);
        const pieces = word.match(/.{1,16}/gu);
        row = pieces.pop();
        lines.push(...pieces);
      } else {
        row += (row ? ' ' : '') + word;
      }
    }
    if (row) lines.push(row);
    return lines.length > 3 ? [...lines.slice(0, 2), lines[2].slice(0, 15) + '…'] : lines;
  }

  function nodeBoundary(node, dx, dy) {
    const scale = Math.min(67 / Math.abs(dx), 30 / Math.abs(dy));
    return { x: node.x + dx * scale, y: node.y + dy * scale };
  }

  function renderDiagramEdge(edge, positions, arrow) {
    const from = positions.get(edge.from);
    const to = positions.get(edge.to);
    if (from === to) {
      const loop = `M${from.x - 26} ${from.y - 30} c-26 -34 75 -34 52 0`;
      return `<path class="study-diagram-edge" d="${loop}" marker-end="url(#${arrow})"/>
        ${edge.label ? diagramLabel(edge.label, from.x, from.y - 55) : ''}`;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const start = nodeBoundary(from, dx, dy);
    const end = nodeBoundary(to, -dx, -dy);
    return `<line class="study-diagram-edge" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" marker-end="url(#${arrow})"/>
      ${edge.label ? diagramLabel(edge.label, (start.x + end.x) / 2, (start.y + end.y) / 2 - 7) : ''}`;
  }

  function diagramLabel(label, x, y) {
    const visible = label.length > 23 ? label.slice(0, 22) + '…' : label;
    return `<text class="study-diagram-label" x="${x}" y="${y}" text-anchor="middle" paint-order="stroke">${escape(visible)}</text>`;
  }

  function renderDiagram(block) {
    const arrow = `study-diagram-arrow-${++diagramNumber}`;
    const columns = Math.min(4, block.nodes.length > 8 ? 4 : block.nodes.length > 4 ? 3 : block.nodes.length);
    const rows = Math.ceil(block.nodes.length / columns);
    const positions = new Map(block.nodes.map((node, index) => [node.id, { ...node,
      x: 82 + (index % columns) * 194,
      y: 66 + Math.floor(index / columns) * 113,
    }]));
    const width = 164 + (columns - 1) * 194;
    const height = 114 + (rows - 1) * 113;
    return `<figure class="study-block study-diagram">
      <figcaption data-study-math>${escape(block.title || 'Схема')}</figcaption>
      <div class="study-diagram-scroll" tabindex="0" role="region" aria-label="${escape(block.title || 'Схема')}">
        <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">
          <defs><marker id="${arrow}" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0 0 6 3 0 6Z" fill="#9e422c"/></marker></defs>
          ${block.edges.map((edge) => renderDiagramEdge(edge, positions, arrow)).join('')}
          ${Array.from(positions.values()).map(({ label, x, y }) => {
            const lines = splitLabel(label);
            return `<g class="study-diagram-node">
              <rect x="${x - 66}" y="${y - 30}" width="132" height="60" rx="12"/>
              <text text-anchor="middle">${lines.map((line, index) => `
                <tspan x="${x}" y="${y + 4 + (index - (lines.length - 1) / 2) * 15}">${escape(line)}</tspan>`).join('')}</text>
            </g>`;
          }).join('')}
        </svg>
      </div>
      <details class="study-diagram-legend">
        <summary>Схема текстом</summary>
        <p>Элементы: ${block.nodes.map((node) => escape(node.label)).join(', ')}.</p>
        ${block.edges.length ? `<ul>${block.edges.map((edge) => `
          <li>${escape(positions.get(edge.from).label)} → ${escape(positions.get(edge.to).label)}${edge.label ? ` (${escape(edge.label)})` : ''}</li>`).join('')}</ul>` : ''}
      </details>
    </figure>`;
  }

  function renderBlock(block) {
    switch (block.type) {
      case 'table': return renderTable(block);
      case 'steps': return renderSteps(block);
      case 'check': return renderCheck(block);
      case 'diagram': return renderDiagram(block);
      case 'math': return `<figure class="study-block study-math-block">
        <div class="study-math" data-study-formula>${escape(block.formula)}</div>
        ${block.caption ? `<figcaption data-study-math>${escape(block.caption)}</figcaption>` : ''}
      </figure>`;
      case 'code': return `<figure class="study-block study-code-block">
        ${block.caption ? `<figcaption data-study-math>${escape(block.caption)}</figcaption>` : ''}
        <pre tabindex="0"><code>${escape(block.code)}</code></pre>
      </figure>`;
      default: return '';
    }
  }

  function renderBlocks(input) {
    const blocks = normalizeBlocks(input);
    return blocks.length ? `<div class="study-blocks">${blocks.map(renderBlock).join('')}</div>` : '';
  }

  function renderMath(element, formula, displayMode) {
    if (!window.katex || !formula || formula.length > maxFormulaLength) {
      element.classList.add('study-math-fallback');
      return;
    }
    try {
      window.katex.render(formula, element, {
        displayMode, output: 'htmlAndMathml', trust: false, maxExpand: 150, maxSize: 24,
      });
    } catch {
      element.textContent = formula;
      element.classList.add('study-math-fallback');
    }
  }

  function renderTextMath(element) {
    if (!window.katex || element.children.length || element.dataset.studyMathReady) return;
    const source = element.textContent;
    const expressions = /\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|(?<!\\)\$(?![\s$])([^\n$]+?)(?<![\s\\])\$(?![\d$])/gu;
    const fragment = element.ownerDocument.createDocumentFragment();
    let cursor = 0;
    for (const match of source.matchAll(expressions)) {
      const [, inline, display, displayDollar, inlineDollar] = match;
      const formula = inline ?? display ?? displayDollar ?? inlineDollar;
      if (formula.length > maxFormulaLength ||
        (inlineDollar && !/[a-z\\=^_+{}α-ω∑≤≥]/iu.test(formula))) continue;
      fragment.append(source.slice(cursor, match.index));
      const equation = element.ownerDocument.createElement('span');
      const isDisplay = display !== undefined || displayDollar !== undefined;
      equation.className = isDisplay ? 'study-math' : 'study-math-inline';
      equation.textContent = formula;
      renderMath(equation, formula, isDisplay);
      fragment.append(equation);
      cursor = match.index + match[0].length;
    }
    if (cursor) {
      fragment.append(source.slice(cursor));
      element.replaceChildren(fragment);
    }
    element.dataset.studyMathReady = '1';
  }

  function handleSteps(button) {
    const block = button.closest('[data-study-steps]');
    const steps = Array.from(block.querySelectorAll('[data-study-step]'));
    const initial = Number(block.dataset.initial);
    const reset = button.hasAttribute('data-study-restart');
    const shown = reset ? initial : Math.min(steps.length, steps.filter((step) => !step.hidden).length + 1);
    steps.forEach((step, index) => { step.hidden = index >= shown; });
    const next = block.querySelector('[data-study-next]');
    const restart = block.querySelector('[data-study-restart]');
    next.hidden = shown === steps.length;
    restart.hidden = shown <= initial;
    block.querySelector('.study-step-status').textContent = `Шаги: ${shown} из ${steps.length}`;
    if (button.hidden) (next.hidden ? restart : next).focus();
  }

  function handleCheck(button) {
    const block = button.closest('[data-study-check]');
    const correct = button.dataset.studyChoice === block.dataset.answer;
    for (const choice of block.querySelectorAll('[data-study-choice]')) {
      choice.setAttribute('aria-pressed', String(choice === button));
      choice.classList.toggle('is-correct', choice === button && correct);
      choice.classList.toggle('is-incorrect', choice === button && !correct);
    }
    const feedback = block.querySelector('.study-check-feedback');
    feedback.hidden = false;
    feedback.querySelector('[data-study-result]').textContent = correct ? 'Верно.' : 'Пока нет.';
  }

  function hydrate(root) {
    if (!root) return;
    for (const element of root.querySelectorAll('[data-study-formula]:not([data-study-math-ready])')) {
      renderMath(element, element.textContent, true);
      element.dataset.studyMathReady = '1';
    }
    for (const element of root.querySelectorAll('[data-study-math]')) renderTextMath(element);
    if (interactiveRoots.has(root)) return;
    interactiveRoots.add(root);
    root.addEventListener('click', (event) => {
      const target = event.target.closest?.('[data-study-next], [data-study-restart], [data-study-choice]');
      if (!target || !root.contains(target)) return;
      if (target.hasAttribute('data-study-choice')) handleCheck(target);
      else handleSteps(target);
    });
  }

  window.StudyContent = { normalizeBlocks, renderBlocks, hydrate };
})();
