(() => {
  "use strict";

  const demo = window.DEMO_COURSE;
  const storeKey = "kt-praktikum-v1";
  const page = document.querySelector("#main-content");
  const sidebar = document.querySelector("#sidebar");
  const topbar = document.querySelector("#topbar");
  const dialog = document.querySelector("#study-dialog");
  const toast = document.querySelector("#toast");
  const routes = {
    home: ["Обзор", "home"],
    theory: ["Лекция", "book"],
    quiz: ["Практика вслепую", "bolt"],
    practice: ["Задачи", "layers"],
    sources: ["Материалы", "files"],
  };
  const icons = {
    brand: '<path d="M3 5.5c4-.7 6.6.1 9 2.4 2.4-2.3 5-3.1 9-2.4v12.8c-4-.7-6.6.1-9 2.4-2.4-2.3-5-3.1-9-2.4zM12 8v12"/><path d="M7 10.5h2m6 0h2"/>',
    home: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    book: '<path d="M4 19V5.8A1.8 1.8 0 0 1 5.8 4H20v16H6a2 2 0 0 1 0-4h14M8 8h8m-8 4h5"/>',
    bolt: '<path d="m13.5 2.8-8 11h6l-1 7.4 8-11h-6z"/>',
    layers: '<path d="m12 3 8.5 4.7L12 12.4 3.5 7.7 12 3Zm-8.5 9.2 8.5 4.7 8.5-4.7M3.5 16.8l8.5 4.7 8.5-4.7"/>',
    files: '<path d="M13.5 3.8H6.7a2 2 0 0 0-2 2v12.4a2 2 0 0 0 2 2h10.6a2 2 0 0 0 2-2v-8.6zM13 4v6h6M8 14h8m-8 3h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chart: '<path d="M5 19V5m0 14h14M9 15v-3m4 3V9m4 6V7"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    circle: '<circle cx="12" cy="12" r="7"/>',
    shield: '<path d="M12 22c5-2.4 7.5-5.8 7.5-10.5V6L12 3 4.5 6v5.5C4.5 16.2 7 19.6 12 22Z"/><path d="m9 12 2 2 4-4"/>',
    spark: '<path d="M12 3c0 5 4 9 9 9-5 0-9 4-9 9 0-5-4-9-9-9 5 0 9-4 9-9Z"/>',
    repeat: '<path d="M17 7H7a3 3 0 0 0-3 3m16 4a3 3 0 0 1-3 3H7m7-13 3 3-3 3m-4 4-3 3 3 3"/>',
    bulb: '<path d="M9 18h6m-5 3h4m-2-18a6 6 0 0 0-3.9 10.6c.6.5.9 1.1.9 1.9h6c0-.8.3-1.4.9-1.9A6 6 0 0 0 12 3Z"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    upload: '<path d="M12 16V4m-4 4 4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    stack: '<rect x="4" y="4" width="16" height="7" rx="2"/><rect x="4" y="13" width="16" height="7" rx="2"/><path d="M8 7.5h.01M8 16.5h.01m4-9h4m-4 9h4"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    pen: '<path d="m14 5 5 5M5 19l4.8-1 10-10a2.1 2.1 0 0 0 0-3l-.9-.9a2.1 2.1 0 0 0-3 0l-10 10z"/>',
    lock: '<rect x="5.5" y="10" width="13" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10m-4 4.5v2"/>',
    chevron: '<path d="m7 9 5 5 5-5"/>',
  };

  let state = loadState();
  let activeCourse = [demo, ...state.courses].find(course => course.id === state.active) || demo;
  const practicePanels = [["condition", "Условие"], ["answer", "Ответ"], ["solution", "Разбор"]];
  let view = "home";
  let topicId;
  let taskId;
  let lessonContentsOpen = false;
  let mobileMenu = false;
  let quiz = newQuiz();
  let suspendedQuiz;
  let practiceDrafts = {};
  let toastTimer;
  let importState;
  let dialogOpener;

  function icon(name, extra = "") {
    return `<svg class="${extra}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || ""}</svg>`;
  }

  function escape(value = "") {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storeKey));
      if (saved && Array.isArray(saved.courses)) {
        return { courses: saved.courses, active: saved.active, records: saved.records || {} };
      }
    } catch (error) {
      console.warn("Не удалось прочитать сохранённый прогресс.", error);
    }
    return { courses: [], active: demo.id, records: {} };
  }

  function saveState() {
    try {
      localStorage.setItem(storeKey, JSON.stringify(state));
      return true;
    } catch {
      notify("Хранилище браузера переполнено или недоступно. Изменения могут пропасть после закрытия.");
      return false;
    }
  }

  function getRecords() {
    return state.records[activeCourse.id] ||= { topics: {}, terms: {}, tasks: {} };
  }

  function summary() {
    const records = getRecords();
    const read = activeCourse.topics.filter(topic => records.topics[topic.id]).length;
    const known = activeCourse.terms.filter(term => records.terms[term.id] === "known").length;
    const review = activeCourse.terms.filter(term => records.terms[term.id] === "review").length;
    const solved = activeCourse.tasks.filter(task => records.tasks[task.id]).length;
    const count = activeCourse.topics.length + activeCourse.terms.length + activeCourse.tasks.length;
    return { read, known, review, solved, percent: count ? Math.round((read + known + solved) * 100 / count) : 0 };
  }

  function numberLabel(number, forms) {
    const last = number % 10;
    const teen = number % 100 >= 11 && number % 100 <= 14;
    return `${number} ${!teen && last === 1 ? forms[0] : !teen && last >= 2 && last <= 4 ? forms[1] : forms[2]}`;
  }

  function parseRoute(hash) {
    const [route, details] = hash.replace(/^#/, "").split("?", 2);
    if (!Object.hasOwn(routes, route)) return null;
    return { route, details: new URLSearchParams(details) };
  }

  function routeHref(route, parameters) {
    return `#${route}${parameters ? `?${new URLSearchParams(parameters)}` : ""}`;
  }

  function restoreCoursePosition() {
    const records = getRecords();
    topicId = activeCourse.topics.find(topic => topic.id === records.currentTopic)?.id || activeCourse.topics[0]?.id;
    taskId = activeCourse.tasks.find(task => task.id === records.currentTask)?.id ||
      activeCourse.tasks.find(task => !records.tasks[task.id])?.id || activeCourse.tasks[0]?.id;
    lessonContentsOpen = false;
  }

  function rememberPosition(key, id) {
    if (!id) return;
    const records = getRecords();
    if (records[key] === id) return;
    records[key] = id;
    saveState();
  }

  function showRoute(destination, focus = true) {
    const previousView = view;
    const previousTopic = topicId;
    mobileMenu = false;
    view = destination.route;
    let lessonPart;
    if (view === "theory") {
      const requestedTopic = destination.details.get("topic");
      const current = activeCourse.topics.find(topic => topic.id === requestedTopic) ||
        activeCourse.topics.find(topic => topic.id === topicId);
      if (current) {
        topicId = current.id;
        const part = Number(destination.details.get("part"));
        if (Number.isInteger(part) && part >= 1 && part <= current.sections.length) lessonPart = part;
        rememberPosition("currentTopic", topicId);
      }
      if (previousView !== view || previousTopic !== topicId) lessonContentsOpen = false;
    }
    if (view === "practice") {
      const requestedTask = destination.details.get("task");
      taskId = activeCourse.tasks.find(task => task.id === requestedTask)?.id || taskId;
      rememberPosition("currentTask", taskId);
    }

    const inPlaceJump = view === "theory" && previousView === view && previousTopic === topicId &&
      lessonPart && page.querySelector(".lesson-layout");
    if (!inPlaceJump) render();
    if (lessonPart) {
      focusLessonPart(lessonPart);
    } else if (focus) {
      page.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
  }

  function navigate(next, options = {}) {
    const hash = next.startsWith("#") ? next : `#${next}`;
    const destination = parseRoute(hash);
    if (!destination) return;
    if (location.hash !== hash) history.pushState(null, "", hash);
    showRoute(destination, options.focus);
  }

  function newQuiz({ format = "cards", mode = "mixed", filter = "all", queue = [] } = {}) {
    return { format, mode, filter, queue, index: 0, hint: false, revealed: false, answer: "", scores: [], finished: false };
  }

  function switchCourse(id) {
    const course = [demo, ...state.courses].find(item => item.id === id);
    if (!course) return;
    if (activeCourse.id !== id) {
      quiz = newQuiz({ format: quiz.format });
      suspendedQuiz = undefined;
    }
    activeCourse = course;
    state.active = id;
    restoreCoursePosition();
    practiceDrafts = {};
    saveState();
    navigate("home");
  }

  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 5250);
  }

  function renderChrome() {
    const { percent } = summary();
    sidebar.classList.toggle("is-open", mobileMenu);
    sidebar.innerHTML = `
      <a class="brand" href="#home">
        <span class="brand-mark">${icon("brand")}</span>
        <span class="brand-copy"><strong>КТ Практикум</strong><small>Учебная тетрадь</small></span>
      </a>
      <div class="sidebar-section">
        <div class="sidebar-label">Мои контрольные</div>
        <div class="course-list">${[demo, ...state.courses].map(course => `
          <button type="button" class="nav-item course-nav ${course.id === activeCourse.id ? "is-active" : ""}" data-course="${escape(course.id)}" aria-pressed="${course.id === activeCourse.id}">
            <span class="course-mark">${icon(course.id === demo.id ? "stack" : "book")}</span>
            <span class="nav-copy"><strong>${escape(course.title)}</strong><small>${course.id === demo.id ? "Готовый курс" : "Мой курс"}</small></span>
          </button>`).join("")}
          <button type="button" class="nav-item course-add" data-action="import">${icon("plus")}<span>Новая КТ</span></button>
        </div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-label">Подготовка</div>
        <nav class="sidebar-nav" aria-label="Разделы">${Object.entries(routes).map(([route, [label, symbol]]) => `
          <a class="nav-item ${view === route ? "is-active" : ""}" href="#${route}" ${view === route ? 'aria-current="page"' : ""}>${icon(symbol)}<span class="nav-copy">${label}</span></a>`).join("")}</nav>
      </div>
      <div class="sidebar-footer">
        <div class="local-note">${icon("shield")}<div><strong>Личное пространство</strong><small>Материалы и прогресс хранятся в этом браузере</small></div></div>
      </div>`;
    topbar.innerHTML = `
      <div class="breadcrumbs">
        <button class="icon-button mobile-only" type="button" data-action="toggle-menu" aria-label="Открыть меню" aria-controls="sidebar" aria-expanded="${mobileMenu}">${icon("menu")}</button>
        <a class="mobile-brand" href="#home" aria-label="КТ Практикум">${icon("brand")}</a>
        <a href="#home">${escape(activeCourse.title)}</a><span class="breadcrumb-divider">/</span><strong>${routes[view][0]}</strong>
      </div>
      <div class="topbar-actions"><span class="topbar-progress">${icon("chart")}${percent}% пройдено</span>
      <button type="button" class="button secondary topbar-add" data-action="import">${icon("plus")}<span>Добавить материалы</span></button></div>`;
    document.title = `${routes[view][0]} · КТ Практикум`;
  }

  function routeCard(route, symbol, label, description, count, buttonText) {
    return `<article class="route-card route-${route}">
      <div class="route-card-top"><span class="route-icon">${icon(symbol)}</span><span class="route-count">${count}</span></div>
      <h3 class="route-heading">${label}</h3>
      <p class="route-description">${description}</p>
      <a class="route-footer" href="#${route}">${buttonText}</a>
    </article>`;
  }

  function fileRows(sources, max = sources.length) {
    return sources.slice(0, max).map((source, index) => `
      <button type="button" class="file-row" data-source="${index}">${icon("files")}<span>${escape(source.name)}</span></button>`).join("");
  }

  function renderHome() {
    const { read, known, review, solved, percent } = summary();
    const { topics, terms, tasks, sources = [] } = activeCourse;
    const builtIn = activeCourse.id === demo.id;
    const coverTitle = activeCourse.subtitle || "Начни с лекции";
    const longTitle = coverTitle.length > 39 || coverTitle.split(/\s+/).some(word => word.length > 16);
    return `
      <section class="page-intro"><p class="eyebrow"><span class="eyebrow-dot"></span> МОЯ ПОДГОТОВКА</p>
        <h1>${escape(activeCourse.title)}</h1>
        <p class="intro-copy">${builtIn ? "Подготовка к контрольной по введению в компьютерные науки." : "Твои материалы, викторина и задания в одном месте."}</p>
      </section>
      <div class="dashboard-grid">
        <div class="study-main layout-stack">
          <section class="hero">
            <div class="hero-content">
              <span class="hero-tag">${icon(builtIn ? "spark" : "book")}${builtIn ? "ГОТОВЫЙ КУРС" : "МОЙ КУРС"}</span>
              <h2 class="hero-title ${!builtIn && longTitle ? "is-long" : ""}">${builtIn ? "Базы данных<br>и не только" : escape(coverTitle)}</h2>
              <p class="hero-description">${builtIn ? "От таблиц и нормальных форм до прикладных программ и ИИ. Читай, вспоминай и решай задачи в своём темпе." : "Прочитай конспект, вспомни определения и проверь себя на заданиях."}</p>
              <div class="hero-actions"><a class="button hero-primary" href="#theory">${icon("book")}${read ? "Открыть лекцию" : "Начать с лекции"}</a>
                <a class="button hero-secondary" href="#quiz">${icon("bolt")}Проверить себя</a></div>
            </div>
            <div class="hero-art" aria-hidden="true"><canvas id="hero-canvas" width="720" height="600"></canvas></div>
          </section>
          <section class="study-routes" aria-labelledby="study-path"><div class="section-heading"><h2 id="study-path">Как будем готовиться</h2></div>
            <div class="route-grid">
              ${routeCard("theory", "book", "Лекция", "Простые объяснения, примеры и главные идеи по каждой теме.", numberLabel(topics.length, ["тема", "темы", "тем"]), "Открыть лекцию")}
              ${routeCard("quiz", "bolt", "Практика вслепую", "Повторяй термины по карточкам или пиши определения своими словами.", numberLabel(terms.length, ["термин", "термина", "терминов"]), "К терминам")}
              ${routeCard("practice", "layers", "Задачи", "Попробуй решить сам, затем сверь ход решения с разбором.", numberLabel(tasks.length, ["задача", "задачи", "задач"]), "Открыть задачи")}
            </div>
          </section>
        </div>
        <aside class="right-rail" aria-label="Прогресс и материалы">
          <section class="rail-card card">
            <div class="rail-heading"><span class="rail-icon">${icon("chart")}</span><h2>Твой прогресс</h2></div>
            <div class="progress-score"><strong>${percent}<span>%</span></strong><span>курса пройдено</span></div>
            <div class="progress-track" role="progressbar" aria-label="Прогресс курса" aria-valuenow="${percent}"><div class="progress-fill" style="width:${percent}%"></div></div>
            <div class="progress-list">
              <div class="progress-row">${icon("book")}<span>Темы прочитаны</span><strong>${read} / ${topics.length}</strong></div>
              <div class="progress-row">${icon("bolt")}<span>Термины выучены</span><strong>${known} / ${terms.length}</strong></div>
              <div class="progress-row">${icon("layers")}<span>Задачи решены</span><strong>${solved} / ${tasks.length}</strong></div>
            </div>
            ${review ? `<button type="button" class="button secondary review-button" data-action="review">${icon("repeat")}Повторить · ${review}</button>` : ""}
          </section>
          <section class="rail-card card">
            <div class="rail-heading"><span class="rail-icon">${icon("files")}</span><h2>Материалы</h2></div>
            ${sources.length
              ? `<div class="file-list">${fileRows(sources, 3)}</div><a class="route-footer rail-link" href="#sources">Все материалы</a>`
              : '<p class="rail-copy">Загрузи конспект для своей КТ или собери курс с помощью нейросети.</p>'}
            <button type="button" class="button secondary add-files" data-action="import">${icon("plus")}Добавить материалы</button>
          </section>
        </aside>
      </div>`;
  }

  function screenHeading(title, description) {
    return `<section class="screen-heading page-intro"><p class="eyebrow"><span class="eyebrow-dot"></span> ${escape(activeCourse.title)}</p>
      <h1>${title}</h1><p class="intro-copy">${description}</p></section>`;
  }

  function topicName(id) {
    return activeCourse.topics.find(topic => topic.id === id)?.title || "";
  }

  function studyBlocks(blocks) {
    return window.StudyContent.renderBlocks(blocks);
  }

  function studyPhotos(key, label) {
    return window.StudyAttachments.renderSlot(activeCourse.id, key, label);
  }

  function learningHeader(title, status) {
    return `<header class="learning-header">
      <div>
        <p class="eyebrow"><span class="eyebrow-dot"></span> ${escape(activeCourse.title)}</p>
        <h1>${title}</h1>
      </div>
      ${status}
    </header>`;
  }

  function renderLessonContents(topics, topic, records) {
    return `<aside class="lesson-rail" aria-label="Оглавление лекции">
      <div class="lesson-contents card">
        <h2 class="lesson-contents-heading">${icon("list")}Оглавление</h2>
        <button type="button" class="lesson-contents-toggle" data-action="lesson-contents"
          aria-controls="lesson-contents-body" aria-expanded="${lessonContentsOpen}">
          ${icon("list")}<span>Оглавление</span>${icon("chevron", "contents-chevron")}
        </button>
        <div class="lesson-contents-body ${lessonContentsOpen ? "is-expanded" : ""}" id="lesson-contents-body">
          <nav aria-labelledby="topics-heading">
            <h3 id="topics-heading">Темы курса</h3>
            <ol class="lesson-topic-list">${topics.map(item => `<li>
              <a class="lesson-topic-link" href="${escape(routeHref("theory", { topic: item.id }))}" ${item.id === topic.id ? 'aria-current="page"' : ""}>
                ${icon(records[item.id] ? "check" : "circle")}<span>${escape(item.title)}</span>
                ${records[item.id] ? '<span class="sr-only">Прочитано</span>' : ""}
              </a>
            </li>`).join("")}</ol>
          </nav>
          ${topic.sections.length ? `<nav class="lesson-section-nav" aria-labelledby="lesson-parts-heading">
            <h3 id="lesson-parts-heading">В этой теме</h3>
            <ol class="lesson-section-list">${topic.sections.map((section, index) => `<li>
              <a data-lesson-part="${index + 1}" href="${escape(routeHref("theory", { topic: topic.id, part: index + 1 }))}">${escape(section.title)}</a>
            </li>`).join("")}</ol>
          </nav>` : ""}
        </div>
      </div>
    </aside>`;
  }

  function setLessonContents(open) {
    lessonContentsOpen = open;
    page.querySelector("#lesson-contents-body")?.classList.toggle("is-expanded", open);
    page.querySelector('[data-action="lesson-contents"]')?.setAttribute("aria-expanded", String(open));
  }

  function focusLessonPart(index) {
    const title = page.querySelector(`#lesson-part-${index}`);
    if (!title) return;
    setLessonContents(false);
    for (const link of page.querySelectorAll("[data-lesson-part]")) {
      if (Number(link.dataset.lessonPart) === index) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    title.focus({ preventScroll: true });
    title.scrollIntoView({ block: "start" });
  }

  function renderTheory() {
    const topics = activeCourse.topics;
    const topic = topics.find(item => item.id === topicId) || topics[0];
    if (!topic) return learningHeader("Лекция", "") + emptyState("В этом курсе пока нет лекции", "Добавь файл с конспектом или вставь текст.");
    const records = getRecords().topics;
    const read = records[topic.id];
    const completed = topics.filter(item => records[item.id]).length;
    const position = topics.indexOf(topic);
    const previous = topics[position - 1];
    const next = topics[position + 1];
    const header = learningHeader("Лекция", `<div class="learning-progress">
      <span>Прочитано <strong>${completed} из ${topics.length}</strong></span>
      <progress aria-label="Прочитанные темы" value="${completed}" max="${topics.length}"></progress>
    </div>`);
    return `<div class="learning-page lesson-page">
      ${header}
      <div class="lesson-layout">
        ${renderLessonContents(topics, topic, records)}
        <article class="lesson-paper card" aria-labelledby="lesson-topic-title">
          <header class="lesson-paper-header">
            <div class="lesson-paper-meta">
              <span class="lesson-kicker">${icon("book")} Тема ${position + 1} из ${topics.length}</span>
              ${read ? `<span class="pill is-good">${icon("check")}Прочитано</span>` : ""}
            </div>
            <h2 id="lesson-topic-title" data-study-math>${escape(topic.title)}</h2>
            ${topic.intro ? `<p data-study-math>${escape(topic.intro)}</p>` : ""}
          </header>
          <div class="lesson-paper-body">
            ${topic.sections.map((section, index) => `<section class="reading-section">
              <h3 class="lesson-part-title" id="lesson-part-${index + 1}" tabindex="-1" data-study-math>${escape(section.title)}</h3>
              <p class="preserve-lines" data-study-math>${escape(section.text)}</p>
              ${section.example ? `<div class="lesson-example"><strong>Пример</strong><p class="preserve-lines" data-study-math>${escape(section.example)}</p></div>` : ""}
              ${studyBlocks(section.blocks)}
              ${studyPhotos(`topic:${topic.id}:section:${index}`, "Фото к разделу")}
            </section>`).join("")}
          </div>
          <footer class="lesson-footer">
            <button type="button" class="button ${read ? "secondary" : "primary"}" data-action="mark-topic">${icon("check")}${read ? "Снять отметку" : "Отметить прочитанным"}</button>
            <nav aria-label="Соседние темы">
              ${previous ? `<a class="button ghost" href="${escape(routeHref("theory", { topic: previous.id }))}">Предыдущая</a>` : ""}
              ${next ? `<a class="button secondary" href="${escape(routeHref("theory", { topic: next.id }))}">Следующая тема</a>` : '<a class="button secondary" href="#quiz">К викторине</a>'}
            </nav>
          </footer>
        </article>
      </div>
    </div>`;
  }

  function emptyState(title, message, action = true) {
    return `<section class="empty-state card"><span class="route-icon">${icon("files")}</span>
      <h2>${title}</h2><p>${message}</p>
      ${action ? '<button type="button" class="button primary" data-action="import">Добавить материалы</button>' : ""}</section>`;
  }

  function filteredTerms() {
    const records = getRecords().terms;
    return activeCourse.terms.filter(term =>
      (quiz.filter === "all" || quiz.filter === term.topicId) &&
      (quiz.mode !== "review" || records[term.id] === "review")
    );
  }

  function startRound() {
    const records = getRecords().terms;
    const priority = { review: 0, known: 2 };
    const queue = filteredTerms().map(term => ({
      term,
      priority: priority[records[term.id]] ?? 1,
      random: Math.random(),
    })).sort((a, b) => a.priority - b.priority || a.random - b.random).slice(0, 8).map(item => item.term);
    if (!queue.length) return;
    quiz = newQuiz({ ...quiz, queue });
    rerenderAt(quizQuestionControl());
  }

  function quizQuestionControl() {
    return quiz.format === "cards" ? '[data-action="flip-card"]' : "#quiz-answer";
  }

  function changeQuizFormat(format) {
    if (quiz.format === format) return;
    const previous = quiz;
    quiz = suspendedQuiz || newQuiz({ format, mode: previous.mode, filter: previous.filter });
    suspendedQuiz = previous;
    rerenderAt(`[data-quiz-format="${format}"]`);
  }

  function changeQuizScope(mode, filter) {
    quiz = newQuiz({ format: quiz.format, mode, filter });
  }

  function renderQuizFormats() {
    const formats = [["cards", "layers", "Карточки"], ["written", "bolt", "Письменная викторина"]];
    return `<div class="quiz-format-switch" role="group" aria-label="Формат тренировки">
      ${formats.map(([format, symbol, label]) => `<button type="button" class="quiz-format-button ${quiz.format === format ? "is-active" : ""}" data-quiz-format="${format}" aria-pressed="${quiz.format === format}">${icon(symbol)}${label}</button>`).join("")}
    </div>`;
  }

  function grade(answer, checks) {
    if (!checks?.length) return null;
    const normalize = value => String(value).toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const words = normalize(answer).split(/\s+/);
    const includes = value => {
      const parts = normalize(value).split(/\s+/);
      return parts.every(Boolean) && words.some((word, index) => parts.every((part, offset) => words[index + offset]?.startsWith(part)));
    };
    return { found: checks.filter(group => group.some(includes)).length, total: checks.length };
  }

  function gradeCopy(result) {
    return result
      ? `<p>Совпали ключевые идеи: ${result.found} из ${result.total}. Сверь смысл с примером ответа.</p>`
      : "<p>Сравни свой ответ с примером и оцени, передал ли ты основную мысль.</p>";
  }

  function renderQuiz() {
    const heading = screenHeading("Практика вслепую", "Вспоминай определения по карточкам или записывай ответы своими словами.");
    if (!activeCourse.terms.length) {
      return heading + emptyState("В этом курсе пока нет терминов", "Добавь конспект с определениями, например «Термин — определение».");
    }
    const available = filteredTerms().length;
    const review = summary().review;
    const cards = quiz.format === "cards";
    const rail = `<aside class="rail-card card screen-rail"><div class="rail-heading"><span class="rail-icon">${icon("repeat")}</span><h2>Параметры раунда</h2></div>
      <div class="topic-list">
        <button type="button" class="topic-button ${quiz.mode === "mixed" ? "is-active" : ""}" data-mode="mixed" aria-pressed="${quiz.mode === "mixed"}">${icon("bolt")}<span>Обычный раунд</span></button>
        <button type="button" class="topic-button ${quiz.mode === "review" ? "is-active" : ""}" data-mode="review" aria-pressed="${quiz.mode === "review"}">${icon("repeat")}<span>На повторение · ${review}</span></button>
      </div>
      <label class="form-label quiz-filter" for="quiz-topic">Тема</label>
      <select class="text-input" id="quiz-topic"><option value="all">Все темы</option>${activeCourse.topics.filter(topic => activeCourse.terms.some(term => term.topicId === topic.id)).map(topic =>
        `<option value="${escape(topic.id)}" ${quiz.filter === topic.id ? "selected" : ""}>${escape(topic.title)}</option>`).join("")}</select></aside>`;
    let panel;
    if (quiz.finished) {
      const known = quiz.scores.filter(score => score === "known").length;
      panel = `<div class="question-meta"><span class="pill is-good">${icon("check")}Раунд завершён</span></div>
        <h2>${known} из ${quiz.queue.length} вспомнил</h2>
        <p class="topic-intro">${review ? numberLabel(review, ["термин ждёт", "термина ждут", "терминов ждут"]) + " повторения. Они сохраняются между раундами." : "Сейчас очередь на повторение пуста. Можешь начать ещё один раунд или перейти к задачам."}</p>
        <div class="inline-actions">
          ${available ? '<button class="button primary" type="button" data-action="start-round">Ещё раунд</button>' : '<button class="button primary" type="button" data-mode="mixed">К обычному раунду</button>'}
          ${review ? '<button class="button secondary" type="button" data-action="review">Повторить термины</button>' : '<a class="button secondary" href="#practice">К задачам</a>'}
        </div>`;
    } else if (!quiz.queue.length) {
      panel = `<div class="question-meta"><span class="pill">${icon("bolt")}${quiz.mode === "mixed" ? "Короткий раунд" : "Повторение"}</span></div>
        <h2>${available ? (cards ? "Потренируйся на карточках" : "Готов проверить себя?") : "Очередь пока пуста"}</h2>
        <p class="topic-intro">${available
          ? "В раунде " + numberLabel(Math.min(8, available), ["термин", "термина", "терминов"]) + (cards
            ? ". Вспомни определение, затем переверни карточку, чтобы свериться."
            : ". После каждого ответа будет пример определения.")
          : "Выбери другую тему или отметь сложные термины в обычном раунде."}</p>
        ${available ? '<button type="button" class="button primary" data-action="start-round">Начать раунд</button>' : ""}`;
    } else {
      const current = quiz.queue[quiz.index];
      panel = `<div class="question-meta"><span class="pill">${icon("bolt")}Термин ${quiz.index + 1} из ${quiz.queue.length}</span>
        <span class="pill muted">${escape(topicName(current.topicId))}</span></div>
        <div class="progress-track round-progress" role="progressbar" aria-label="Ответы в раунде" aria-valuenow="${Math.round(quiz.index * 100 / quiz.queue.length)}"><div class="progress-fill" style="width:${quiz.index * 100 / quiz.queue.length}%"></div></div>
        ${cards ? renderFlashcard(current) : renderWrittenQuestion(current)}`;
    }
    return heading + `<div class="screen-grid"><section class="quiz-card content-card card">${renderQuizFormats()}${panel}</section>${rail}</div>`;
  }

  function quizHintButton() {
    return `<button type="button" class="button secondary" data-action="quiz-hint" aria-expanded="${quiz.hint}">${icon("bulb")}Подсказка</button>`;
  }

  function quizHint(current) {
    if (!quiz.hint || quiz.revealed) return "";
    return `<div class="hint-box">${icon("bulb")}<p data-study-math>${escape(current.hint || "Вспомни пример из лекции и попробуй вывести определение через него.")}</p></div>`;
  }

  function quizScoreButtons(allowKnown) {
    return `${allowKnown ? `<button type="button" class="button primary" data-score="known">${icon("check")}Вспомнил</button>` : ""}
      <button type="button" class="button ${allowKnown ? "secondary" : "primary"}" data-score="review">${icon("repeat")}Повторить позже</button>`;
  }

  function renderFlashcard(current) {
    return `<button type="button" class="flashcard ${quiz.revealed ? "is-flipped" : ""}" data-action="flip-card">
      <span class="flashcard-label">${quiz.revealed ? "Определение" : "Термин"}</span>
      <strong class="flashcard-title" data-study-math>${escape(current.term)}</strong>
      ${quiz.revealed ? `<span class="flashcard-definition preserve-lines" data-study-math>${escape(current.definition)}</span>` : ""}
      <span class="flashcard-cue">${icon("repeat")}${quiz.revealed ? "К термину" : "Перевернуть карточку"}</span>
    </button>
    <div class="inline-actions flashcard-actions">${quiz.revealed ? quizScoreButtons(true) : quizHintButton()}</div>
    ${quizHint(current)}`;
  }

  function renderWrittenQuestion(current) {
    const hasAnswer = Boolean(quiz.answer.trim());
    return `<p class="prompt-label">Что означает этот термин?</p><h2 data-study-math>${escape(current.term)}</h2>
      <form id="quiz-form">
        <label class="form-label" for="quiz-answer">Твоё определение</label>
        <textarea class="answer-input" id="quiz-answer" rows="4" maxlength="4000" placeholder="Напиши так, как объяснил бы одногруппнику…" ${quiz.revealed ? "readonly" : ""}>${escape(quiz.answer)}</textarea>
        ${!quiz.revealed ? `<div class="inline-actions">
          <button class="button primary" type="submit">Проверить ответ</button>
          ${quizHintButton()}
          <button type="button" class="button ghost" data-action="quiz-reveal">Не помню</button>
        </div>` : ""}
      </form>
      ${quizHint(current)}
      ${quiz.revealed ? `<div class="feedback" aria-live="polite">
        <strong>Пример определения</strong><p class="preserve-lines" data-study-math>${escape(current.definition)}</p>
        ${hasAnswer ? gradeCopy(grade(quiz.answer, current.checks)) : "<p>Прочитай определение. Можешь отметить термин, чтобы встретить его снова.</p>"}
      </div><div class="inline-actions">${quizScoreButtons(hasAnswer)}</div>` : ""}`;
  }

  function taskDraft(id) {
    return practiceDrafts[id] ||= { hints: 0, revealed: false, panel: "condition" };
  }

  function taskLink(task, label, style) {
    return task ? `<a class="button ${style}" href="${escape(routeHref("practice", { task: task.id }))}">${label}</a>` : "";
  }

  function renderPracticeToolbar(tasks, task, records, previous, next) {
    return `<div class="practice-toolbar">
      <div class="practice-picker">
        <label class="form-label" for="practice-task-select">Выбрать задачу</label>
        <select class="text-input" id="practice-task-select">${tasks.map((item, index) => `<option value="${escape(item.id)}" ${item.id === task.id ? "selected" : ""}>${index + 1}. ${escape(item.title)}${records[item.id] ? " ✓" : ""}</option>`).join("")}</select>
      </div>
      <nav class="practice-prev-next" aria-label="Соседние задачи">
        ${taskLink(previous, "Предыдущая", "ghost")}
        ${taskLink(next, "Следующая", "secondary")}
      </nav>
    </div>`;
  }

  function renderPracticeTabs(activePanel) {
    return `<div class="practice-tabs" role="tablist" aria-label="Части задачи">${practicePanels.map(([id, label]) => `
      <button type="button" class="practice-tab" role="tab" id="practice-tab-${id}" data-practice-tab="${id}"
        aria-controls="practice-${id}" aria-selected="${id === activePanel}" tabindex="${id === activePanel ? 0 : -1}">${label}</button>`
    ).join("")}</div>`;
  }

  function practicePanelHeading(id, title, symbol) {
    return `<header class="practice-panel-header">
      <span class="practice-panel-icon">${icon(symbol)}</span>
      <h3 id="practice-${id}-title" tabindex="-1">${title}</h3>
    </header>`;
  }

  function renderPracticeCondition(task) {
    return `<section class="practice-panel practice-condition card" id="practice-condition" data-practice-panel role="tabpanel" aria-labelledby="practice-condition-title">
      ${practicePanelHeading("condition", "Условие", "files")}
      ${task.scenario ? `<p class="preserve-lines" data-study-math>${escape(task.scenario)}</p>` : ""}
      ${studyBlocks(task.conditionBlocks)}
      <div class="practice-request">
        <strong>Что сделать</strong>
        <p class="preserve-lines" data-study-math>${escape(task.prompt)}</p>
      </div>
      ${studyPhotos(`task:${task.id}:condition`, "Фото к условию")}
      <button type="button" class="button primary practice-compact-action" data-action="practice-to-answer">К ответу</button>
    </section>`;
  }

  function renderPracticeAnswer(task, draft) {
    return `<section class="practice-panel practice-answer card" id="practice-answer" data-practice-panel role="tabpanel" aria-labelledby="practice-answer-title">
      ${practicePanelHeading("answer", "Твой ответ", "pen")}
      <form id="task-form">
        ${window.StudyAnswers.render(activeCourse.id, task, draft.revealed)}
        ${!draft.revealed ? `<div class="inline-actions practice-submit">
          <button class="button primary" type="submit">Сверить с разбором</button>
          ${draft.hints < task.hints.length ? `<button class="button secondary" type="button" data-action="task-hint">${icon("bulb")}${draft.hints ? "Ещё подсказка" : "Подсказка"}</button>` : ""}
        </div>` : `<button type="button" class="button secondary practice-compact-action" data-action="practice-to-solution">К разбору</button>`}
      </form>
      ${draft.hints && !draft.revealed ? `<div class="hint-box practice-hints" id="practice-hints" tabindex="-1" aria-live="polite">${icon("bulb")}<ol>${task.hints.slice(0, draft.hints).map(hint => `<li data-study-math>${escape(hint)}</li>`).join("")}</ol></div>` : ""}
      ${studyPhotos(`task:${task.id}:answer`, "Фото своего решения")}
    </section>`;
  }

  function renderPracticeSolution(task, draft, solved, next) {
    const written = draft.revealed ? window.StudyAnswers.readText(activeCourse.id, task).trim() : "";
    return `<section class="practice-panel practice-solution card ${draft.revealed ? "is-revealed" : "is-locked"}" id="practice-solution" data-practice-panel role="tabpanel" aria-labelledby="practice-solution-title">
      ${practicePanelHeading("solution", "Разбор решения", draft.revealed ? "book" : "lock")}
      ${draft.revealed ? `
        <p class="preserve-lines" data-study-math>${escape(task.solution)}</p>
        ${studyBlocks(task.solutionBlocks)}
        ${written ? `<div class="written-answer-feedback"><strong>Текстовая часть ответа</strong>${gradeCopy(grade(written, task.checks))}</div>` : ""}
        ${studyPhotos(`task:${task.id}:solution`, "Фото к разбору")}
        <div class="inline-actions practice-solution-actions">
          <button type="button" class="button ${solved ? "secondary" : "primary"}" data-action="mark-task">${icon("check")}${solved ? "Снять отметку" : "Отметить решённой"}</button>
          ${next ? taskLink(next, "Следующая задача", "secondary") : '<a class="button secondary" href="#home">К обзору</a>'}
        </div>` : `<p>Нажми «Сверить с разбором» в разделе с ответом.</p>
        <button type="button" class="button secondary practice-compact-action" data-action="practice-to-answer">К ответу</button>`}
    </section>`;
  }

  function focusPracticeHeading(panel) {
    const title = page.querySelector(`#practice-${panel}-title`);
    title?.focus({ preventScroll: true });
    title?.scrollIntoView({ block: "nearest" });
  }

  function openPracticePanel(panel, focusPanel = false) {
    const body = page.querySelector(".practice-body");
    if (!body) return;
    taskDraft(taskId).panel = panel;
    body.dataset.activePanel = panel;
    for (const tab of page.querySelectorAll("[data-practice-tab]")) {
      const selected = tab.dataset.practiceTab === panel;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    if (focusPanel) focusPracticeHeading(panel);
  }

  function renderPractice() {
    const tasks = activeCourse.tasks;
    const task = tasks.find(item => item.id === taskId) || tasks[0];
    if (!task) return learningHeader("Задачи", "") + emptyState("В этом курсе пока нет задач", "Добавь материал с примерами или практическими заданиями.");
    const records = getRecords().tasks;
    const solved = tasks.filter(item => records[item.id]).length;
    const draft = taskDraft(task.id);
    const position = tasks.indexOf(task);
    const previous = tasks[position - 1];
    const next = tasks[position + 1];
    const topic = topicName(task.topicId);
    return `<div class="learning-page practice-page">
      ${learningHeader("Задачи", `<div class="learning-progress">
        <span>Решено <strong>${solved} из ${tasks.length}</strong></span>
        <progress aria-label="Решённые задачи" value="${solved}" max="${tasks.length}"></progress>
      </div>`)}
      ${renderPracticeToolbar(tasks, task, records, previous, next)}
      <article aria-labelledby="practice-task-title">
        <header class="practice-title-banner">
          <div class="practice-banner-copy">
            <p class="practice-kicker">${icon("layers")} Задача ${position + 1} из ${tasks.length}</p>
            <h2 id="practice-task-title" data-study-math>${escape(task.title)}</h2>
          </div>
          <div class="practice-tags">
            ${topic ? `<span class="pill">${escape(topic)}</span>` : ""}
            <span class="pill muted">${escape(task.difficulty || "Практика")}</span>
            ${records[task.id] ? `<span class="pill is-good">${icon("check")}Решено</span>` : ""}
          </div>
        </header>
        ${renderPracticeTabs(draft.panel)}
        <div class="practice-body" data-active-panel="${draft.panel}">
          ${renderPracticeCondition(task)}
          <div class="practice-work">
            ${renderPracticeAnswer(task, draft)}
            ${renderPracticeSolution(task, draft, records[task.id], next)}
          </div>
        </div>
      </article>
    </div>`;
  }

  function renderSources() {
    const heading = screenHeading("Материалы", "Здесь можно свериться с текстами, из которых собран курс.");
    const sources = activeCourse.sources || [];
    if (!sources.length) {
      return heading + (activeCourse.id === demo.id
        ? `<div class="content-card card"><h2>Курс по ВКН уже готов</h2><p class="topic-intro">Лекция, термины и задания составлены по списку вопросов к ВКН КТ 3 и конспекту подготовки. Открой лекцию или добавь файлы для отдельной контрольной.</p><div class="inline-actions"><a class="button primary" href="#theory">Открыть лекцию</a><button type="button" class="button secondary" data-action="import">${icon("plus")}Добавить материалы</button></div></div>`
        : emptyState("Нет добавленных файлов", "Создай курс из файлов или вставь текст конспекта."));
    }
    return heading + `<div class="screen-grid"><section class="content-card card"><h2>${numberLabel(sources.length, ["источник", "источника", "источников"])}</h2><div class="file-list">${fileRows(sources)}</div></section>
      <aside class="rail-card card"><div class="rail-heading"><span class="rail-icon">${icon("plus")}</span><h2>Другая контрольная</h2></div><p class="rail-copy">Собери отдельный курс со своими темами и прогрессом.</p><button class="button secondary add-files" type="button" data-action="import">Создать курс</button></aside></div>`;
  }

  function render() {
    renderChrome();
    const pages = { home: renderHome, theory: renderTheory, quiz: renderQuiz, practice: renderPractice, sources: renderSources };
    page.innerHTML = pages[view]();
    window.StudyContent.hydrate(page);
    window.StudyAttachments.hydrate(page);
    window.StudyAnswers.hydrate(page);
    if (view === "home") window.StudyCovers.draw(page.querySelector("#hero-canvas"), activeCourse);
  }

  function openDialog(content, opener) {
    dialogOpener = opener;
    dialog.innerHTML = content;
    dialog.showModal();
  }

  function dialogHeader(title, description = "") {
    return `<div class="dialog-head"><div><h2 id="dialog-title">${escape(title)}</h2>${description ? `<p>${description}</p>` : ""}</div>
      <button class="icon-button" type="button" data-action="close-dialog" aria-label="Закрыть">${icon("close")}</button></div>`;
  }

  function openImport(opener) {
    importState = { files: [], pending: false };
    openDialog(dialogHeader("Новая контрольная", "Добавь конспекты и вопросы. Тренажёр выделит темы и попробует извлечь определения и примеры.") + `
      <form class="import-form" id="import-form">
        <label class="form-label" for="course-title">Название курса</label>
        <input class="text-input" id="course-title" maxlength="80" placeholder="Например, Алгоритмы · КТ 2" autofocus>
        <label class="drop-zone" for="study-files" id="drop-zone">
          ${icon("upload")}<strong>Выбрать файлы или перетащить сюда</strong><span>TXT, MD, DOC, DOCX, PDF с текстом, JSON</span>
          <input id="study-files" type="file" accept=".txt,.md,.doc,.docx,.pdf,.json" multiple>
        </label>
        <div id="selected-files" class="selected-files"></div>
        <label class="form-label" for="source-paste">Или вставь текст</label>
        <textarea class="answer-input" id="source-paste" rows="3" maxlength="150000" placeholder="Например, Хеширование — преобразование данных в значение фиксированной длины."></textarea>
        <div class="source-status" id="source-status" role="status"></div>
        <section class="ai-entry" aria-labelledby="ai-entry-title">
          <div><strong id="ai-entry-title">${icon("spark")} Собрать с нейросетью</strong>
            <p>Попроси нейросеть объяснить сложные темы и составить новые задания по твоим материалам.</p></div>
          <button type="button" class="button secondary" data-action="ai-prepare">Выбрать нейросеть</button>
        </section>
        <div class="dialog-actions"><button class="button ghost" type="button" data-action="close-dialog">Отмена</button>
          <button class="button primary" type="submit">Собрать курс</button></div>
      </form>
      <form class="import-form" id="ai-import-form" hidden>
        <h3 id="ai-form-heading" tabindex="-1">Курс с нейросетью</h3>
        <ol class="ai-steps">
          <li>Скопируй запрос и открой нейросеть. При необходимости войди в своём аккаунте на её сайте.</li>
          <li>Прикрепи там свои учебные файлы или вставь конспект. Отправь запрос вместе с материалами.</li>
          <li>Скопируй полученный ответ сюда. Если чат подготовит файл <code>course.json</code>, добавь его через загрузку файлов на предыдущем экране.</li>
        </ol>
        <div class="provider-links" aria-label="Открыть нейросеть"></div>
        <div class="inline-actions">
          <button type="button" class="button secondary" data-action="copy-ai-prompt">Скопировать запрос</button>
        </div>
        <details class="ai-prompt"><summary>Посмотреть запрос</summary>
          <textarea class="answer-input source-preview" id="ai-prompt-text" aria-label="Готовый запрос для нейросети" rows="6" readonly></textarea>
        </details>
        <div class="source-status" id="ai-copy-status" role="status"></div>
        <div class="ai-return">
          <label class="form-label" for="ai-answered">Ответ нейросети</label>
          <textarea class="answer-input" id="ai-answered" rows="5" maxlength="400000" placeholder="Вставь весь ответ с JSON"></textarea>
          <div class="source-status" id="ai-import-status" role="status"></div>
        </div>
        <div class="dialog-actions"><button class="button ghost" type="button" data-action="ai-back">К загрузке файлов</button>
          <button class="button primary" type="submit">Добавить курс</button></div>
      </form>`, opener);
  }

  function showAIImport(show) {
    if (importState.pending) return;
    const main = document.querySelector("#import-form");
    const ai = document.querySelector("#ai-import-form");
    main.hidden = show;
    ai.hidden = !show;
    if (show) {
      const title = main.querySelector("#course-title").value.trim();
      ai.querySelector("#ai-prompt-text").value = window.StudyAI.prompt(title);
      ai.querySelector(".provider-links").innerHTML = window.StudyAI.providers.map(provider => `
        <a class="button secondary" href="${escape(provider.url)}" target="_blank" rel="noopener noreferrer">${escape(provider.name)} <span class="sr-only">(новая вкладка)</span></a>
      `).join("");
      focusControl("#ai-form-heading");
    } else {
      focusControl('[data-action="ai-prepare"]');
    }
  }

  async function copyAIPrompt() {
    const field = document.querySelector("#ai-prompt-text");
    const status = document.querySelector("#ai-copy-status");
    try {
      await navigator.clipboard.writeText(field.value);
      status.textContent = "Запрос скопирован.";
    } catch {
      field.closest("details").open = true;
      field.focus();
      field.select();
      status.textContent = "Запрос выделен. Скопируй его сочетанием Ctrl+C или через меню устройства.";
    }
  }

  async function importAIResponse(form) {
    const upload = importState;
    if (upload.pending) return;
    const status = form.querySelector("#ai-import-status");
    const button = form.querySelector('button[type="submit"]');
    upload.pending = true;
    button.disabled = true;
    status.textContent = "Проверяю курс…";
    try {
      const json = window.StudyAI.extractJson(form.querySelector("#ai-answered").value);
      const { sources, errors } = await window.StudyImport.readFiles([new File([json], "course.json", { type: "application/json" })]);
      if (importState !== upload || !dialog.open) return;
      if (!sources.length) throw new Error(errors[0]?.message || "В ответе нет готового курса.");
      const title = document.querySelector("#course-title").value.trim();
      addCourse(window.StudyImport.buildCourse(title, sources));
    } catch (error) {
      if (importState === upload) status.textContent = error.message || "Не удалось прочитать курс.";
    } finally {
      upload.pending = false;
      button.disabled = false;
    }
  }

  function showSource(index, opener) {
    const source = activeCourse.sources?.[index];
    if (!source) return;
    openDialog(dialogHeader(source.name) + `<div class="source-preview preserve-lines">${escape(source.text || "Этот источник содержит готовую структуру курса.")}</div>`, opener);
  }

  function addFiles(files) {
    if (!importState || importState.pending) return;
    for (const file of files) {
      const duplicate = importState.files.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
      if (!duplicate) importState.files.push(file);
    }
    showSelectedFiles();
  }

  function showSelectedFiles() {
    document.querySelector("#selected-files").innerHTML = importState.files.map((file, index) =>
      `<div class="selected-file">${icon("files")}<span>${escape(file.name)}</span><button type="button" class="icon-button" data-remove-file="${index}" aria-label="Убрать ${escape(file.name)} из загрузки">${icon("close")}</button></div>`
    ).join("");
  }

  async function importCourse(form) {
    const upload = importState;
    if (upload.pending) return;
    const title = form.querySelector("#course-title").value.trim();
    const pasted = form.querySelector("#source-paste").value.trim();
    const status = form.querySelector("#source-status");
    if (!upload.files.length && !pasted) {
      status.textContent = "Выбери файл или вставь текст.";
      return;
    }
    upload.pending = true;
    form.querySelector('button[type="submit"]').disabled = true;
    status.textContent = "Читаю материалы…";
    try {
      const { sources, errors } = await window.StudyImport.readFiles(upload.files);
      if (importState !== upload || !dialog.open) return;
      if (pasted) sources.push({ name: "Вставленный конспект", text: pasted });
      if (!sources.length) throw new Error(errors.map(error => `${error.name} — ${error.message}`).join("\n") || "В материалах не найден текст.");
      const next = window.StudyImport.buildCourse(title, sources);
      if (errors.length && !upload.confirmed) {
        status.textContent = "Не удалось прочитать некоторые файлы. Нажми «Собрать из прочитанных» или поправь список.\n" + errors.map(error => `${error.name} — ${error.message}`).join("\n");
        upload.confirmed = true;
        form.querySelector('button[type="submit"]').textContent = "Собрать из прочитанных";
        return;
      }
      addCourse(next);
    } catch (error) {
      if (importState === upload) status.textContent = error.message || "Не удалось собрать курс из этих материалов.";
    } finally {
      if (importState === upload) {
        upload.pending = false;
        form.querySelector('button[type="submit"]').disabled = false;
      }
    }
  }

  function addCourse(course) {
    const existing = new Set([demo, ...state.courses].map(item => item.id));
    while (existing.has(course.id)) course.id = `course-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const previous = state;
    state = { ...state, courses: [...state.courses, course], active: course.id };
    if (!saveState()) {
      state = previous;
      throw new Error("Не удалось сохранить курс. Попробуй добавить меньший объём текста.");
    }
    dialog.close();
    switchCourse(course.id);
    notify("Курс готов. Можно начинать подготовку.");
  }

  function focusControl(selector) {
    document.querySelector(selector)?.focus({ preventScroll: true });
  }

  function rerenderAt(control) {
    render();
    focusControl(control);
  }

  function revealQuiz() {
    quiz.revealed = true;
    rerenderAt(quiz.answer.trim() ? '[data-score="known"]' : '[data-score="review"]');
  }

  function flipFlashcard() {
    quiz.revealed = !quiz.revealed;
    rerenderAt(quizQuestionControl());
  }

  function scoreQuiz(score) {
    if (!quiz.revealed) return;
    const term = quiz.queue[quiz.index];
    if (!term) return;
    getRecords().terms[term.id] = score;
    saveState();
    quiz.scores.push(score);
    quiz.index += 1;
    quiz.finished = quiz.index >= quiz.queue.length;
    quiz.answer = "";
    quiz.hint = false;
    quiz.revealed = false;
    rerenderAt(quiz.finished ? '.quiz-card [data-action="start-round"], .quiz-card [data-mode="mixed"]' : quizQuestionControl());
  }

  const actions = {
    import: button => openImport(button),
    "ai-prepare": () => showAIImport(true),
    "ai-back": () => showAIImport(false),
    "copy-ai-prompt": () => { void copyAIPrompt(); },
    "close-dialog": () => dialog.close(),
    "toggle-menu": () => {
      mobileMenu = !mobileMenu;
      renderChrome();
      focusControl(mobileMenu ? ".sidebar a[aria-current]" : '[data-action="toggle-menu"]');
    },
    "lesson-contents": () => setLessonContents(!lessonContentsOpen),
    "mark-topic": () => {
      const topics = getRecords().topics;
      topics[topicId] = !topics[topicId];
      saveState();
      rerenderAt('[data-action="mark-topic"]');
    },
    "start-round": startRound,
    review: () => {
      changeQuizScope("review", "all");
      navigate("quiz");
    },
    "quiz-hint": () => {
      quiz.hint = !quiz.hint;
      rerenderAt('[data-action="quiz-hint"]');
    },
    "quiz-reveal": revealQuiz,
    "flip-card": flipFlashcard,
    "task-hint": () => {
      taskDraft(taskId).hints += 1;
      render();
      const hints = page.querySelector("#practice-hints");
      hints?.focus({ preventScroll: true });
      hints?.scrollIntoView({ block: "nearest" });
    },
    "practice-to-answer": () => openPracticePanel("answer", true),
    "practice-to-solution": () => openPracticePanel("solution", true),
    "mark-task": () => {
      const tasks = getRecords().tasks;
      tasks[taskId] = !tasks[taskId];
      saveState();
      rerenderAt('[data-action="mark-task"]');
    },
  };

  document.addEventListener("click", event => {
    const trigger = event.target.closest("a, button");
    if (!trigger) return;
    const { course, action, mode, score, source, removeFile, quizFormat, practiceTab } = trigger.dataset;
    const href = trigger.getAttribute("href");
    if (href?.startsWith("#") && parseRoute(href)) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(href);
    } else if (course) {
      switchCourse(course);
    } else if (practiceTab) {
      openPracticePanel(practiceTab);
    } else if (action) {
      actions[action]?.(trigger);
    } else if (quizFormat) {
      changeQuizFormat(quizFormat);
    } else if (mode) {
      if (quiz.mode === mode) return;
      changeQuizScope(mode, quiz.filter);
      rerenderAt(`[data-mode="${mode}"]`);
    } else if (score) {
      scoreQuiz(score);
    } else if (source !== undefined) {
      showSource(Number(source), trigger);
    } else if (removeFile !== undefined && !importState.pending) {
      importState.files.splice(Number(removeFile), 1);
      resetImportConfirmation();
      showSelectedFiles();
      focusControl("#study-files");
    }
  });

  function resetImportConfirmation() {
    importState.confirmed = false;
    document.querySelector('#import-form button[type="submit"]').textContent = "Собрать курс";
    document.querySelector("#source-status").textContent = "";
  }

  document.addEventListener("input", event => {
    if (event.target.id === "quiz-answer") {
      quiz.answer = event.target.value;
      event.target.setCustomValidity("");
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "quiz-topic") {
      changeQuizScope(quiz.mode, event.target.value);
      rerenderAt("#quiz-topic");
    }
    if (event.target.id === "practice-task-select") {
      navigate(routeHref("practice", { task: event.target.value }), { focus: false });
      focusControl("#practice-task-select");
    }
    if (event.target.id === "study-files") {
      resetImportConfirmation();
      addFiles(event.target.files);
      event.target.value = "";
    }
  });

  document.addEventListener("submit", event => {
    const form = event.target;
    event.preventDefault();
    if (form.id === "import-form") void importCourse(form);
    if (form.id === "ai-import-form") void importAIResponse(form);
    if (form.id === "quiz-form" && !quiz.revealed) {
      if (quiz.answer.trim()) revealQuiz();
      else {
        const answer = form.querySelector("#quiz-answer");
        answer.setCustomValidity("Напиши определение или нажми «Не помню».");
        answer.reportValidity();
      }
    }
    if (form.id === "task-form") {
      const draft = taskDraft(taskId);
      draft.revealed = true;
      draft.panel = "solution";
      render();
      focusPracticeHeading("solution");
    }
  });

  page.addEventListener("keydown", event => {
    const tab = event.target.closest("[data-practice-tab]");
    if (!tab) return;
    const tabs = [...tab.parentElement.querySelectorAll("[data-practice-tab]")];
    const position = tabs.indexOf(tab);
    let next;
    if (event.key === "ArrowRight") next = tabs[(position + 1) % tabs.length];
    if (event.key === "ArrowLeft") next = tabs[(position + tabs.length - 1) % tabs.length];
    if (event.key === "Home") next = tabs[0];
    if (event.key === "End") next = tabs.at(-1);
    if (!next) return;
    event.preventDefault();
    openPracticePanel(next.dataset.practiceTab);
    next.focus();
  });

  for (const eventName of ["dragover", "dragleave", "drop"]) {
    dialog.addEventListener(eventName, event => {
      const dropZone = event.target.closest("#drop-zone");
      if (!dropZone) return;
      event.preventDefault();
      dropZone.classList.toggle("is-dragover", eventName === "dragover");
      if (eventName === "drop") {
        resetImportConfirmation();
        addFiles(event.dataTransfer.files);
      }
    });
  }

  dialog.addEventListener("click", event => {
    if (event.target === dialog) {
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    }
  });

  dialog.addEventListener("close", () => {
    if (!dialog.open) {
      importState = undefined;
      dialogOpener?.focus();
    }
  });

  window.addEventListener("hashchange", () => {
    if (location.hash === "#main-content") return;
    showRoute(parseRoute(location.hash) || parseRoute("home"));
  });

  restoreCoursePosition();
  showRoute(parseRoute(location.hash) || parseRoute("home"), false);
})();
