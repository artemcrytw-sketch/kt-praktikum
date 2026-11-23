(() => {
  "use strict";

  const providers = [
    { name: "ChatGPT", url: "https://chatgpt.com/" },
    { name: "Claude", url: "https://claude.ai/" },
    { name: "Gemini", url: "https://gemini.google.com/app" },
    { name: "Алиса AI", url: "https://alice.yandex.ru/" },
  ];

  const example = {
    title: "Структуры данных · КТ 1",
    subject: "Информатика",
    subtitle: "Стек и очередь",
    coverTheme: "code",
    topics: [
      {
        id: "stack",
        title: "Стек",
        intro: "Начнём с порядка, в котором стек отдаёт элементы.",
        sections: [
          {
            title: "Принцип LIFO",
            text: "Из стека первым извлекают элемент, который добавили последним.",
            example: "Из стопки тарелок сначала берут верхнюю, которую поставили последней.",
            blocks: [
              { type: "math", formula: String.raw`n_{\text{после}} = n_{\text{до}} - 1`, caption: "После удаления одного элемента размер стека уменьшается на один." },
              { type: "code", caption: "Удалить верхний элемент непустого стека", code: "stack.pop();" },
              { type: "steps", title: "Стек после удаления", steps: [
                { title: "Исходное состояние", text: "Сверху лежит C." },
                { title: "После удаления", text: "Сверху теперь B." },
              ] },
              { type: "check", question: "Что находится сверху после удаления C?",
                options: ["A", "B"], answer: 1, explanation: "Удаляется только верхний элемент C. Под ним был B." },
            ],
          },
        ],
      },
    ],
    terms: [
      {
        topicId: "stack",
        term: "Стек",
        definition: "Коллекция, из которой первым извлекают последний добавленный элемент.",
        hint: "Вспомни, как достают тарелки из стопки.",
        checks: [["последн", "lifo"], ["извлека", "забира", "доста"]],
      },
    ],
    tasks: [
      {
        topicId: "stack",
        title: "Отмена действий",
        difficulty: "Базовый",
        scenario: "Редактор записал действия A, B и C в этом порядке.",
        prompt: "В каком порядке редактор отменит два последних действия? Почему?",
        hints: ["Вспомни, какое действие оказалось сверху."],
        solution: "Сначала C, потом B. Каждая отмена снимает верхний элемент стека.",
        answerMode: "table",
        answerColumns: ["Шаг", "Действие"],
        conditionBlocks: [
          { type: "diagram", title: "Порядок записи действий", nodes: [{ id: "a", label: "A" }, { id: "b", label: "B" }, { id: "c", label: "C" }],
            edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }] },
        ],
        solutionBlocks: [
          { type: "table", title: "Порядок отмены", columns: ["Шаг", "Действие"], rows: [["1", "C"], ["2", "B"]] },
        ],
      },
    ],
  };

  function prompt(title) {
    const courseTitle = typeof title === "string" ? title.trim() : "";
    return [
      "Подготовь курс для русскоязычного тренажёра «КТ Практикум» из файлов, которые я прикреплю, или из учебного текста, который я пришлю. Если материалов ещё нет, попроси прислать их.",
      courseTitle
        ? "Желаемое значение поля title: " + JSON.stringify(courseTitle.slice(0, 120)) + "."
        : "Подбери короткое название курса по материалам.",
      "",
      "В курсе должны быть три части.",
      "1. Лекция (topics). Разбей программу КТ на темы. Для каждой дай короткое вступление и разделы с объяснениями простыми словами. Используй примеры там, где они проясняют идею.",
      "2. Карточки (terms). Выбери важные термины. Для каждого дай определение в 1–2 предложениях и подсказку, которая помогает вспомнить смысл. Если можно выделить ключевые идеи для письменной проверки, добавь checks: массив групп с короткими основами слов или фразами. Внутри группы перечисли равнозначные варианты. Иначе пропусти checks.",
      "3. Задачи (tasks). Сделай небольшие упражнения на применение материала. У каждой задачи должны быть понятное условие, чёткий вопрос, постепенные подсказки и пошаговое решение, чтобы с ним можно было свериться. Если в материалах есть форматы заданий КТ, опирайся на них, а для новых примеров придумывай учебные данные.",
      "",
      "Опирайся на материалы и список вопросов к КТ. Убери повторения, сохраняй точные формулировки и не добавляй неподтверждённые факты. Если формула, рисунок или часть условия не читается, пометь «Сверь с исходником» и назови пропуск. Не угадывай значения и не переноси персональные данные.",
      "",
      "Пиши короткий subtitle для обложки, примерно 2–5 слов. При желании укажи coverTheme: database, recurrence, network, code, math, science, history, language, economics или general. Выбери тему всего курса.",
      "",
      "Если пример лучше прочитать наглядно, добавь отдельный блок из примера ниже. В лекции используй blocks, в задаче — conditionBlocks для исходных данных и solutionBlocks для разбора. Таблица — для строк и столбцов, схема — для простых связей, steps — для шагов, check — для одного короткого вопроса, math — для формулы, code — для фрагмента программы. Добавляй только уместные блоки. В таблицах передавай заголовки и значения строками, по одной ячейке на столбец. В check поле answer — номер верного варианта, начиная с нуля.",
      "Формулу в math записывай как LaTeX без внешних разделителей. Внутри обычного текста можно заключить короткую формулу в $…$. В JSON удваивай обратные слеши LaTeX, как в примере. Рядом простыми словами объясни обозначения. Для схем перечисляй узлы и связи. Если нужно реальное изображение из файла, укажи, какую страницу или рисунок прикрепить вручную.",
      "Для задачи с заполнением таблицы укажи answerMode: table, для рисования схемы — drawing, для объяснения или программирования — text. Можно дать answerColumns с названиями столбцов, если их должен подсказать тренажёр. Вписывать правильные значения в условие не нужно.",
      "",
      "Верни один полный JSON-объект. Если можешь, отдай файлом course.json. Иначе помести весь JSON в один блок кода. Обязательные поля: title; темы с sections из title и text; карточки с term и definition; задачи с title, prompt и solution. У каждой темы свой id, а topicId карточек и задач совпадает с id темы.",
      "Используй двойные кавычки, переносы строк внутри значений записывай как \\n. Проверь, что нет комментариев и висячих запятых. Если ответ получается слишком длинным, убери повторы и сократи примеры, чтобы вернуть полный JSON. Приоритет — вопросы к КТ.",
      "",
      "Вот пример структуры. Замени все учебные данные примера содержанием моих материалов.",
      JSON.stringify(example, null, 2),
    ].join("\n");
  }

  function isCourseJson(candidate) {
    try {
      const value = JSON.parse(candidate);
      return typeof value?.title === "string" && Array.isArray(value.topics);
    } catch {
      return false;
    }
  }

  function embeddedCourse(text) {
    let start = 0;
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
      } else if (character === "{") {
        if (depth === 0) start = index;
        depth += 1;
      } else if (depth > 0) {
        if (character === '"') inString = true;
        else if (character === "}") {
          depth -= 1;
          if (depth === 0) {
            const candidate = text.slice(start, index + 1);
            if (isCourseJson(candidate)) return candidate;
          }
        }
      }
    }
    return "";
  }

  function extractJson(answer) {
    const text = answer.trim();
    if (!text) throw new Error("Скопируй ответ нейросети и вставь его сюда.");
    if (text.length > 235000) throw new Error("Ответ слишком большой. Попроси нейросеть сделать курс короче или разбить его по темам.");

    if (isCourseJson(text)) return text;
    const fencedBlocks = /^[ \t]*(\u0060{3,}|~{3,})[ \t]*(?:json)?[ \t]*\r?\n([\s\S]*?)^[ \t]*\1[ \t]*(?=\r?$)/gimu;
    for (const [, , block] of text.matchAll(fencedBlocks)) {
      const candidate = block.trim();
      if (isCourseJson(candidate)) return candidate;
    }

    const candidate = embeddedCourse(text);
    if (candidate) return candidate;
    throw new Error("Не удалось найти целый курс в формате JSON. Скопируй весь блок или попроси нейросеть прислать один корректный JSON с полями title и topics.");
  }

  window.StudyAI = { providers, prompt, extractJson };
})();
