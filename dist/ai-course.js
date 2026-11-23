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
      "Опирайся на содержание материалов и список вопросов к КТ, если он приложен. Убери повторения, сохрани точные формулировки там, где они важны, и не добавляй неподтверждённые факты. Подбирай объём по материалу. Ориентир — 3–8 тем, 15–50 карточек и 5–12 задач. Для маленького конспекта можно сделать меньше. Не переноси из материалов персональные данные.",
      "",
      "Верни ровно один объект в формате JSON. Если можешь создать файл для скачивания, назови его course.json. Иначе выведи весь JSON в одном блоке кода без пояснений. Используй двойные кавычки, записывай переносы строк внутри значений как \\n, убери комментарии и запятые после последнего элемента. У каждой темы свой уникальный id, а topicId каждой карточки и задачи должен совпадать с id её темы.",
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
