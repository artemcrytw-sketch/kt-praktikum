(function () {
  'use strict';

  const fileLimit = 25 * 1024 * 1024;
  const textLimit = 220000;
  const wordXmlLimit = 12 * 1024 * 1024;
  const pdfAssets = typeof document === 'undefined' ? null : new URL('./vendor/pdfjs/', document.currentScript?.src || document.baseURI);
  const invalidWord = 'Не удалось прочитать документ Word. Попробуй сохранить его как DOCX или TXT.';
  const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const strictWordNamespace = 'http://purl.oclc.org/ooxml/wordprocessingml/main';
  const endOfChain = 0xfffffffe;
  const descriptionVerbs = 'описывает|зада[её]т|связывает|хранит|объединяет|предназначена? для|определяется как|сопоставляет|показывает|уведомляет|отвечает за|использует|помогает';
  const subjectDefinition = new RegExp(`^(.{2,65}?)\\s+(${descriptionVerbs})\\s+(.{12,})$`, 'iu');
  const descriptionStart = new RegExp(`^(?:${descriptionVerbs})\\s`, 'iu');

  function cleanText(text) {
    return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000E-\u001F]/g, '')
      .replace(/[\u000B\u000C]/g, '\n').replace(/\u00a0/g, ' ')
      .replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function decodeText(bytes) {
    if (bytes[0] === 255 && bytes[1] === 254) return new TextDecoder('utf-16le').decode(bytes);
    if (bytes[0] === 254 && bytes[1] === 255) return new TextDecoder('utf-16be').decode(bytes);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return new TextDecoder('windows-1251').decode(bytes);
    }
  }

  function viewOf(bytes) {
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  function wordCheck(condition) {
    if (!condition) throw new Error(invalidWord);
  }

  // Compound File Binary format. DOC stores text in the WordDocument and 0Table/1Table streams.
  function compoundStreams(bytes) {
    const header = viewOf(bytes);
    wordCheck(bytes.length >= 512 && header.getUint32(0, true) === 0xe011cfd0 && header.getUint32(4, true) === 0xe11ab1a1);
    const sectorShift = header.getUint16(30, true);
    wordCheck((sectorShift === 9 || sectorShift === 12) && header.getUint16(32, true) === 6);
    const sectorSize = 2 ** sectorShift;
    const sectorCount = Math.floor(bytes.length / sectorSize) - 1;

    function normalSector(id) {
      wordCheck(id < sectorCount);
      const start = (id + 1) * sectorSize;
      return bytes.subarray(start, start + sectorSize);
    }

    const fatSize = header.getUint32(44, true);
    const fatSectors = [];
    const difatCount = header.getUint32(72, true);
    wordCheck(fatSize > 0 && fatSize <= sectorCount && difatCount <= sectorCount);
    for (let i = 0; i < Math.min(fatSize, 109); i += 1) {
      fatSectors.push(header.getUint32(76 + i * 4, true));
    }

    let difat = header.getUint32(68, true);
    const fatEntriesPerSector = sectorSize / 4;
    for (let i = 0; i < difatCount && fatSectors.length < fatSize; i += 1) {
      const part = viewOf(normalSector(difat));
      for (let j = 0; j < fatEntriesPerSector - 1 && fatSectors.length < fatSize; j += 1) {
        fatSectors.push(part.getUint32(j * 4, true));
      }
      difat = part.getUint32(sectorSize - 4, true);
    }
    wordCheck(fatSectors.length === fatSize && new Set(fatSectors).size === fatSize);
    const fat = new Uint32Array(fatSize * fatEntriesPerSector);
    fatSectors.forEach((id, index) => {
      const part = viewOf(normalSector(id));
      for (let i = 0; i < fatEntriesPerSector; i += 1) {
        fat[index * fatEntriesPerSector + i] = part.getUint32(i * 4, true);
      }
    });

    function readChain(start, allocation, getSector, partSize, size) {
      if (size === 0) return new Uint8Array();
      const parts = [];
      const visited = new Set();
      let id = start;
      while (id !== endOfChain && (size === undefined || parts.length * partSize < size)) {
        wordCheck(id < allocation.length && !visited.has(id));
        visited.add(id);
        const part = getSector(id);
        wordCheck(part.length === partSize);
        parts.push(part);
        id = allocation[id];
      }
      const length = size ?? parts.length * partSize;
      wordCheck(length <= parts.length * partSize && length <= bytes.length);
      const result = new Uint8Array(length);
      parts.forEach((part, index) => {
        const offset = index * partSize;
        result.set(part.subarray(0, length - offset), offset);
      });
      return result;
    }

    const directory = readChain(header.getUint32(48, true), fat, normalSector, sectorSize);
    const directoryView = viewOf(directory);
    const unicode = new TextDecoder('utf-16le');
    const streams = new Map();
    let miniStreamRoot;
    for (let offset = 0; offset + 128 <= directory.length; offset += 128) {
      const type = directory[offset + 66];
      const nameSize = directoryView.getUint16(offset + 64, true);
      if ((type !== 2 && type !== 5) || nameSize < 2 || nameSize > 64) continue;
      const name = unicode.decode(directory.subarray(offset, offset + nameSize - 2));
      const entry = {
        id: directoryView.getUint32(offset + 116, true),
        size: directoryView.getUint32(offset + 120, true),
      };
      if (type === 5 && offset === 0) miniStreamRoot = entry;
      if (type === 2 && !streams.has(name)) streams.set(name, entry);
    }

    let miniFat;
    let miniStream;
    return (name) => {
      const entry = streams.get(name);
      wordCheck(entry && entry.size <= bytes.length);
      if (entry.size >= 4096) return readChain(entry.id, fat, normalSector, sectorSize, entry.size);
      if (!miniFat) {
        wordCheck(miniStreamRoot && miniStreamRoot.size <= bytes.length);
        const rawFat = readChain(header.getUint32(60, true), fat, normalSector, sectorSize, header.getUint32(64, true) * sectorSize);
        miniFat = new Uint32Array(rawFat.length / 4);
        const miniFatView = viewOf(rawFat);
        for (let i = 0; i < miniFat.length; i += 1) miniFat[i] = miniFatView.getUint32(i * 4, true);
        miniStream = readChain(miniStreamRoot.id, fat, normalSector, sectorSize, miniStreamRoot.size);
      }
      return readChain(entry.id, miniFat, (id) => miniStream.subarray(id * 64, (id + 1) * 64), 64, entry.size);
    };
  }

  function readLegacyWord(bytes) {
    if (bytes[0] === 80 && bytes[1] === 75) return readDocx(bytes);
    const stream = compoundStreams(bytes);
    const word = stream('WordDocument');
    const fib = viewOf(word);
    wordCheck(word.length >= 420 && fib.getUint16(0, true) === 0xa5ec && fib.getUint16(2, true) >= 0x00c1);
    const flags = fib.getUint16(10, true);
    if (flags & 0x8100) throw new Error('Документ Word защищён. Сохрани копию без пароля и попробуй снова.');
    const longCountOffset = 34 + fib.getUint16(32, true) * 2;
    const longCount = fib.getUint16(longCountOffset, true);
    wordCheck(longCount >= 4);
    const bodyLength = fib.getUint32(longCountOffset + 14, true);
    if (bodyLength > textLimit) throw new Error('В документе слишком много текста. Раздели его на файлы по темам.');
    const fcLcb = longCountOffset + 4 + longCount * 4;
    const clxField = fcLcb + 33 * 8;
    wordCheck(clxField + 8 <= word.length);
    const table = viewOf(stream(flags & 0x0200 ? '1Table' : '0Table'));
    let position = fib.getUint32(clxField, true);
    const clxEnd = position + fib.getUint32(clxField + 4, true);
    wordCheck(position < clxEnd && clxEnd <= table.byteLength);
    while (position + 3 <= clxEnd && table.getUint8(position) === 1) {
      position += 3 + table.getUint16(position + 1, true);
    }
    wordCheck(position + 5 <= clxEnd && table.getUint8(position) === 2);
    const pieceTableSize = table.getUint32(position + 1, true);
    position += 5;
    wordCheck(pieceTableSize >= 4 && (pieceTableSize - 4) % 12 === 0 && position + pieceTableSize <= clxEnd);
    const pieces = (pieceTableSize - 4) / 12;
    const descriptors = position + (pieces + 1) * 4;
    const latin = new TextDecoder('windows-1252');
    const unicode = new TextDecoder('utf-16le');
    const result = [];
    for (let i = 0; i < pieces; i += 1) {
      const start = table.getUint32(position + i * 4, true);
      if (start >= bodyLength) break;
      const count = Math.min(bodyLength, table.getUint32(position + (i + 1) * 4, true)) - start;
      const descriptor = table.getUint32(descriptors + i * 8 + 2, true);
      const compressed = Boolean(descriptor & 0x40000000);
      const offset = (descriptor & 0x3fffffff) / (compressed ? 2 : 1);
      const end = offset + count * (compressed ? 1 : 2);
      wordCheck(Number.isInteger(offset) && count >= 0 && end <= word.length);
      result.push((compressed ? latin : unicode).decode(word.subarray(offset, end)));
    }
    return result.join('').replace(/\x13[^\x14\x15]*[\x14\x15]/g, '').replace(/\x07/g, ' | ');
  }

  async function unzipDocumentXml(bytes) {
    const zip = viewOf(bytes);
    let end = bytes.length - 22;
    const lowerEnd = Math.max(0, end - 65535);
    while (end >= lowerEnd && (zip.getUint32(end, true) !== 0x06054b50 || end + 22 + zip.getUint16(end + 20, true) !== bytes.length)) {
      end -= 1;
    }
    wordCheck(end >= lowerEnd);
    let directory = zip.getUint32(end + 16, true);
    const entries = zip.getUint16(end + 10, true);
    const decoder = new TextDecoder();
    for (let i = 0; i < entries; i += 1) {
      wordCheck(directory + 46 <= end && zip.getUint32(directory, true) === 0x02014b50);
      const nameSize = zip.getUint16(directory + 28, true);
      const name = decoder.decode(bytes.subarray(directory + 46, directory + 46 + nameSize));
      if (name === 'word/document.xml') {
        const flags = zip.getUint16(directory + 8, true);
        const compression = zip.getUint16(directory + 10, true);
        const compressedSize = zip.getUint32(directory + 20, true);
        const expectedSize = zip.getUint32(directory + 24, true);
        const header = zip.getUint32(directory + 42, true);
        wordCheck(!(flags & 1) && expectedSize <= wordXmlLimit && header + 30 <= bytes.length && zip.getUint32(header, true) === 0x04034b50);
        const start = header + 30 + zip.getUint16(header + 26, true) + zip.getUint16(header + 28, true);
        wordCheck(start + compressedSize <= bytes.length);
        const data = bytes.subarray(start, start + compressedSize);
        if (compression === 0) {
          wordCheck(compressedSize === expectedSize);
          return decoder.decode(data);
        }
        wordCheck(compression === 8);
        const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
        let xml = '';
        let decodedSize = 0;
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            decodedSize += value.byteLength;
            wordCheck(decodedSize <= expectedSize);
            xml += decoder.decode(value, { stream: true });
          }
          wordCheck(decodedSize === expectedSize);
          return xml + decoder.decode();
        } finally {
          await reader.cancel().catch(() => {});
        }
      }
      directory += 46 + nameSize + zip.getUint16(directory + 30, true) + zip.getUint16(directory + 32, true);
    }
    throw new Error(invalidWord);
  }

  async function readDocx(bytes) {
    const xml = new DOMParser().parseFromString(await unzipDocumentXml(bytes), 'application/xml');
    const namespace = xml.documentElement.namespaceURI;
    wordCheck(namespace === wordNamespace || namespace === strictWordNamespace);
    const body = xml.getElementsByTagNameNS(namespace, 'body')[0];
    wordCheck(body);

    function paragraphText(paragraph) {
      const fragments = [];
      for (const element of paragraph.getElementsByTagNameNS(namespace, '*')) {
        if (element.localName === 't') fragments.push(element.textContent);
        if (element.localName === 'tab') fragments.push('\t');
        if (element.localName === 'br' || element.localName === 'cr') fragments.push('\n');
      }
      return fragments.join('').trim();
    }

    function linesFor(node) {
      if (node.namespaceURI === namespace && node.localName === 'p') {
        const text = paragraphText(node);
        if (!text) return [''];
        const style = node.getElementsByTagNameNS(namespace, 'pStyle')[0]?.getAttributeNS(namespace, 'val') ?? '';
        const outline = node.getElementsByTagNameNS(namespace, 'outlineLvl')[0];
        return /^(heading|заголовок|title)\s*\d*$/iu.test(style) || outline ? [`## ${text}`] : [text];
      }
      if (node.namespaceURI === namespace && node.localName === 'tr') {
        const cells = [...node.children].filter((child) => child.localName === 'tc');
        return [cells.map((cell) => [...cell.getElementsByTagNameNS(namespace, 'p')].map(paragraphText).join(' ')).join(' | ')];
      }
      return [...node.children].flatMap(linesFor);
    }

    return linesFor(body).join('\n');
  }

  async function readPdf(bytes) {
    if (pdfAssets?.protocol === 'file:') throw new Error('Для PDF открой тренажёр по его веб-адресу.');
    const pdf = await import(new URL('pdf.min.mjs', pdfAssets).href);
    pdf.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', pdfAssets).href;
    const loading = pdf.getDocument({
      data: bytes,
      cMapUrl: new URL('cmaps/', pdfAssets).href,
      cMapPacked: true,
      standardFontDataUrl: new URL('standard_fonts/', pdfAssets).href,
      useWasm: false,
      isEvalSupported: false,
    });
    try {
      const doc = await loading.promise;
      if (doc.numPages > 150) throw new Error('В PDF больше 150 страниц. Раздели его по темам.');
      const pages = [];
      let length = 0;
      for (let number = 1; number <= doc.numPages; number += 1) {
        const page = await doc.getPage(number);
        const { items } = await page.getTextContent();
        let text = '';
        let lastLine;
        for (const item of items) {
          if (typeof item.str !== 'string') continue;
          const line = item.transform?.[5];
          if (lastLine !== undefined && line !== undefined && Math.abs(lastLine - line) > 2 && !text.endsWith('\n')) text += '\n';
          text += item.str + (item.hasEOL ? '\n' : '');
          lastLine = line;
        }
        length += text.length;
        if (length > textLimit) throw new Error('В PDF слишком много текста. Раздели его по темам.');
        pages.push(text.trim());
        page.cleanup();
      }
      const text = pages.filter(Boolean).join('\n\n');
      if (!text.trim()) throw new Error('В PDF нет текстового слоя. Добавь PDF с выделяемым текстом или скопируй текст в TXT.');
      return text;
    } catch (error) {
      if (error?.name === 'PasswordException') throw new Error('PDF защищён паролем. Добавь копию без защиты.');
      if (error?.name === 'InvalidPDFException') throw new Error('PDF повреждён или сохранён в другом формате.');
      throw error;
    } finally {
      await loading.destroy();
    }
  }

  function takeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function readStructured(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('В JSON есть синтаксическая ошибка.');
    }
    const invalid = 'Для JSON нужны название курса и непустой массив topics с разделами вида { title, text }.';
    if (!data || !takeText(data.title) || !Array.isArray(data.topics) || !data.topics.length || data.topics.length > 80) throw new Error(invalid);
    const topicIds = new Set();
    const topics = data.topics.map((topic, index) => {
      if (!takeText(topic?.title) || !Array.isArray(topic.sections) || !topic.sections.length || topic.sections.length > 100) throw new Error(invalid);
      const id = takeText(topic.id) || `topic-${index + 1}`;
      if (topicIds.has(id)) throw new Error('В JSON повторяется идентификатор темы.');
      topicIds.add(id);
      const sections = topic.sections.map((section) => {
        if (!takeText(section?.title) || !takeText(section.text)) throw new Error(invalid);
        return { title: takeText(section.title), text: takeText(section.text), example: takeText(section.example) };
      });
      return { id, title: takeText(topic.title), intro: takeText(topic.intro), sections };
    });
    function rows(rowsValue, required, map) {
      if (rowsValue === undefined) return [];
      if (!Array.isArray(rowsValue) || rowsValue.length > 250) throw new Error('В JSON слишком много карточек или заданий либо они записаны вне массива.');
      return rowsValue.map((row) => {
        if (!row || required.some((key) => !takeText(row[key]))) throw new Error('В JSON пропущен текст карточки или задания.');
        const topicId = takeText(row.topicId) || topics[0].id;
        if (!topicIds.has(topicId)) throw new Error('Карточка или задание ссылается на отсутствующую тему JSON.');
        const checks = Array.isArray(row.checks) ? row.checks.filter(Array.isArray)
          .map((group) => group.map(takeText).filter(Boolean)).filter((group) => group.length) : [];
        return { ...map(row), topicId, ...(checks.length ? { checks } : {}) };
      });
    }
    return {
      title: takeText(data.title), subject: takeText(data.subject), subtitle: takeText(data.subtitle), topics,
      terms: rows(data.terms, ['term', 'definition'], (row) => ({
        term: takeText(row.term), definition: takeText(row.definition), hint: takeText(row.hint) || hintFor(row.definition),
      })),
      tasks: rows(data.tasks, ['title', 'prompt', 'solution'], (row) => ({
        title: takeText(row.title), difficulty: takeText(row.difficulty) || 'Базовый',
        scenario: takeText(row.scenario), prompt: takeText(row.prompt), solution: takeText(row.solution),
        hints: Array.isArray(row.hints) ? row.hints.map(takeText).filter(Boolean) : [],
      })),
    };
  }

  async function readFiles(files) {
    const sources = [];
    const errors = [];
    for (const file of files) {
      try {
        if (file.size > fileLimit) throw new Error('Файл больше 25 МБ. Раздели его на части.');
        const extension = file.name.toLowerCase().split('.').pop();
        if (!['txt', 'md', 'doc', 'docx', 'pdf', 'json'].includes(extension)) throw new Error('Поддерживаются TXT, MD, DOC, DOCX, PDF и JSON.');
        const bytes = new Uint8Array(await file.arrayBuffer());
        let text;
        if (extension === 'docx') text = await readDocx(bytes);
        else if (extension === 'doc') text = await readLegacyWord(bytes);
        else if (extension === 'pdf') text = await readPdf(bytes);
        else text = decodeText(bytes);
        text = cleanText(text);
        if (text.length > textLimit) throw new Error('В файле слишком много текста. Раздели его на файлы по темам.');
        if (!text.trim()) throw new Error('В файле нет текста.');
        const course = extension === 'json' ? readStructured(text) : undefined;
        sources.push({ name: file.name, text, ...(course ? { course } : {}) });
      } catch (error) {
        const message = error instanceof RangeError ? invalidWord : error.message;
        errors.push({ name: file.name, message: /[А-Яа-яЁё]/u.test(message ?? '') ? message : 'Файл не прочитался. Проверь его формат или сохрани копию в TXT.' });
      }
    }
    return { sources, errors };
  }

  function heading(line, nextLine) {
    const markdown = line.match(/^#{1,6}\s+(.+?)\s*#*$/u);
    if (markdown) return markdown[1].trim();
    const numbered = line.match(/^\d{1,2}[.)]\s+(.+)$/u);
    if (numbered && numbered[1].length <= 100 && !/[.!]$/u.test(numbered[1])) return numbered[1];
    if (line.length >= 6 && line.length <= 95 && /^[\p{L}\p{N}]/u.test(line) && !/[,.:;!?|«»]/u.test(line)
      && line === line.toUpperCase() && /[А-ЯЁA-Z]{3,}/u.test(line)) return line;
    if (line.length >= 11 && line.length <= 72 && nextLine.length >= 90 && /^[А-ЯЁA-Z]/u.test(nextLine)
      && /^[А-ЯЁA-Z][\p{L}\p{N}\s()[\]«»/—–-]+$/u.test(line)
      && !/^(?:например|пример|итог|условие|шаг|важно|запомни|примечание|продолжение|ответ|проверка)(?:\s|$)/iu.test(line)
      && !/(?:имеет|содержит|является|требует|следующие|»|«)$/iu.test(line)) return line;
    return '';
  }

  function displayLine(line) {
    return line.replace(/\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/gu, (_, bold, under, code) => bold ?? under ?? code).trim();
  }

  function splitTopics(source) {
    const groups = [];
    const sourceTitle = source.name.replace(/\.[^.]+$/u, '').replace(/_/g, ' ');
    let title = sourceTitle;
    let lines = [];
    function saveGroup() {
      if (lines.some(Boolean)) groups.push({ title, lines });
      lines = [];
    }
    const rawLines = cleanText(source.text).split('\n');
    for (const [index, rawLine] of rawLines.entries()) {
      const line = rawLine.trim();
      const nextLine = rawLines[index + 1]?.trim() || rawLines[index + 2]?.trim() || '';
      const nextTitle = heading(line, nextLine);
      if (nextTitle && groups.length < 39) {
        saveGroup();
        title = displayLine(nextTitle);
      } else {
        lines.push(displayLine(line));
      }
    }
    saveGroup();
    return groups;
  }

  function sentences(line) {
    return line.split(/(?<=[.!?])\s+(?=[А-ЯЁA-Z0-9«])/u).map((text) => text.trim()).filter(Boolean);
  }

  function looksLikeTerm(term) {
    const text = term.replace(/\([^()]*\)/gu, '').replace(/[«»]/gu, '').trim();
    return /^[\p{L}\p{N}][\p{L}\p{N}\s./+–-]*$/u.test(text) && /\p{L}/u.test(text)
      && text.split(/\s+/u).length <= 6
      && !/^(?:а|в|вне|на|для|до|со?|по|при|из|о|у|за|без|но|и|если|когда|где|так|вот|это|еще|ещё|этот|такие|каждая?|каждый|одна|которые|чтобы|однако|среди|например|пример|проверка|ответ|итог|условие|шаг|вопрос|примечание|важно|запомни|лекция|содержание|введение|основа|задание|рассмотрим|перечислим|подчеркни|дай)(?:\s|$)/iu.test(text)
      && !/(?:^|\s)(?:представляют|решает|требует|можно|будет|бывает|имеет|выполняет|выполнено|должно|позволяет|считается|объединяет|называется|показывает|описывает|определяется|допускает|содержит|состоит|понять|работает|производится|поддерживается|выполняется|формируется)(?:\s|$)/iu.test(text);
  }

  function definitionsFrom(lines) {
    const definitions = [];
    const definitionsPattern = /^(.{1,85}?)(?:\s*[:=]\s+|\s+[—–-]\s+|\s+(?:представляет собой|означает|обозначает)\s+)(.{3,})$/iu;
    for (const [index, line] of lines.entries()) {
      const after = lines[index + 1] ?? '';
      const afterPair = lines[index + 2] ?? '';
      const rawPair = /^[а-яёa-z]/u.test(after) || (afterPair === '' && /^[А-ЯЁA-Z]/u.test(after) && after.length >= 60);
      if ((!index || !lines[index - 1]) && /^[А-ЯЁA-Z]/u.test(line) && line.length <= 78
        && !/[.?!:;]$/u.test(line) && after.length >= 16 && after.length <= 450 && rawPair && looksLikeTerm(line)) {
        const definition = sentences(after)[0];
        if (definition && !definition.endsWith('?')) definitions.push({ term: line, definition, hint: hintFor(definition) });
      }
      for (const sentence of sentences(line)) {
        const cleaned = sentence.replace(/^(?:[-•*]|\d{1,2}[.)])\s+/u, '');
        const dashCount = cleaned.match(/\s[—–-]\s/gu)?.length ?? 0;
        const clauses = dashCount >= 2 ? cleaned.split(/(?<!\([^)]{0,80})[,;]\s+(?=[\p{L}\p{N}][\p{L}\p{N}\s-]{0,62}\s+[—–-]\s)/u) : [cleaned];
        for (const clause of clauses) {
          const explicit = clause.match(definitionsPattern);
          const subject = explicit ? null : clause.match(subjectDefinition);
          if (!explicit && !subject) continue;
          const term = (explicit ?? subject)[1].trim().replace(/^(?:«(.+)»|"(.+)"|“(.+)”)$/u, (_, angle, straight, curly) => angle ?? straight ?? curly);
          if (!looksLikeTerm(term) || (subject && (term.split(/\s+/u).length > 4 || /^(?:пары|количество|значение|результат|часть|элемент|данные)$/iu.test(term)))) continue;
          const definition = (explicit ? explicit[2].replace(/^это\s+/iu, '') : `${subject[2]} ${subject[3]}`).trim();
          if (!/\p{L}/u.test(definition) || definition.length > 560 || /https?:\/\//u.test(definition)) continue;
          definitions.push({ term, definition, hint: hintFor(definition) });
        }
      }
    }
    return definitions;
  }

  function hintFor(definition) {
    const words = definition.trim().split(/\s+/u);
    if (words.length <= 3) return 'Вспомни, к какой группе относится понятие или для чего оно нужно.';
    return `Определение начинается со слов «${words.slice(0, Math.min(4, Math.floor(words.length / 2))).join(' ')}…»`;
  }

  function makeSections(lines) {
    const sections = [];
    let current = [];
    let length = 0;
    function flush() {
      const text = current.join('\n').trim();
      if (text) {
        const firstTerm = definitionsFrom([current[0] ?? ''])[0]?.term;
        const possibleTitle = sentences(current[0] ?? '')[0]?.split(/\s+/u).slice(0, 7).join(' ').replace(/[,.:;]$/u, '');
        const title = firstTerm || (sections.length && possibleTitle ? possibleTitle : 'Ключевые идеи');
        sections.push({ title, text });
      }
      current = [];
      length = 0;
    }
    for (const line of lines) {
      const example = line.match(/^Пример(?:(?:\s+\d+)?[.:—–-])\s+(.+)$/iu);
      if (example && current.length) {
        flush();
        sections.at(-1).example = example[1];
        continue;
      }
      if ((!line && length > 280) || (line && length > 1000 && !line.includes('|'))) flush();
      if (line || current.length) current.push(line);
      length += line.length + 1;
    }
    flush();
    return sections;
  }

  function introFor(sections, definitions) {
    const parts = definitions.slice(0, 2).map(({ term, definition }) => {
      const linksDirectly = descriptionStart.test(definition);
      return `${term}${linksDirectly ? ' ' : ' — '}${definition.replace(/[.;]$/u, '')}.`;
    });
    const summary = parts.join(' ');
    if (summary.length > 0 && summary.length <= 320) return summary;
    const firstSentence = sentences(sections[0].text.split('\n')[0])[0] ?? '';
    return firstSentence.length >= 35 && firstSentence.length <= 270 ? firstSentence : '';
  }

  function taskFor(title, sections, definitions) {
    if (/^(?:источники|ссылки|литература|список литературы|содержание)(?:\s|$)/iu.test(title)) return null;
    const sectionWithExample = sections.find((section) => section.example);
    if (sectionWithExample) return {
      title: `Пример по теме «${title}»`, difficulty: 'Базовый', scenario: sectionWithExample.example,
      prompt: 'Назови правило или понятие из темы, которое видно в примере. Объясни, какие детали это показывают.',
      hints: ['Выдели в примере главное действие или связь.', `Дальше вспомни правила из части «${sectionWithExample.title}».`],
      solution: `Сверь объяснение с материалом.\n\n${sectionWithExample.text}`,
    };
    if (definitions.length >= 2) {
      const [first, second] = definitions;
      return {
        title: `Сравнение «${first.term}» и «${second.term}»`, difficulty: 'Базовый',
        scenario: `Одногруппник попросил тебя объяснить ему «${first.term}» и «${second.term}».`,
        prompt: 'Объясни каждое понятие своими словами. Чтобы разница была видна, приведи по одному примеру.',
        hints: ['Начни с вопроса «что это или зачем это нужно?» для каждого понятия.', first.hint],
        solution: `${first.term}\n${first.definition}\n\n${second.term}\n${second.definition}\n\nПроверь, что у каждого примера видно, какое именно понятие он иллюстрирует.`,
      };
    }
    if (definitions.length) {
      const [definition] = definitions;
      return {
        title: `Свой пример для «${definition.term}»`, difficulty: 'Базовый',
        scenario: `Объясни «${definition.term}» человеку, который слышит это впервые.`,
        prompt: 'Придумай ситуацию, где видно, как работает понятие. Свяжи одну деталь ситуации с определением.',
        hints: ['Выбери простой случай из учёбы, работы или жизни.', definition.hint],
        solution: `${definition.term}\n${definition.definition}\n\nПроверь, что деталь твоего примера связана с главным свойством из определения.`,
      };
    }

    const excerpt = sections[0].text.split('\n').flatMap(sentences).slice(0, 3).join(' ').slice(0, 1000);
    if (excerpt.length < 35) return null;
    return {
      title: `Объяснение темы «${title}»`, difficulty: 'Базовый',
      scenario: 'На КТ тебя просят объяснить главное в этой теме за полминуты.',
      prompt: 'Назови одну главную идею из материала и приведи пример, который помог бы её понять.',
      hints: ['Что бы ты объяснил человеку, который впервые слышит о теме?', 'После главной мысли ответь на вопрос «как это выглядит на примере?».'],
      solution: `Сверь главную мысль и пример с началом темы в исходнике.\n\n${excerpt}`,
    };
  }

  function buildCourse(title, sources) {
    const topics = [];
    const terms = [];
    const tasks = [];
    const seenTerms = new Set();
    const structured = sources.length === 1 ? sources[0].course : null;
    function addTopic(topic, definitions, exercises) {
      const topicId = `topic-${topics.length + 1}`;
      topics.push({ ...topic, id: topicId });
      for (const definition of definitions) {
        const normalized = definition.term.toLocaleLowerCase('ru').replace(/ё/g, 'е');
        if (seenTerms.has(normalized)) continue;
        seenTerms.add(normalized);
        terms.push({ ...definition, id: `term-${terms.length + 1}`, topicId });
      }
      for (const exercise of exercises) {
        tasks.push({ ...exercise, id: `task-${tasks.length + 1}`, topicId });
      }
    }

    for (const source of sources) {
      if (source.course) {
        const course = source.course;
        for (const topic of course.topics) {
          addTopic(topic, course.terms.filter((term) => term.topicId === topic.id), course.tasks.filter((task) => task.topicId === topic.id));
        }
        continue;
      }
      for (const group of splitTopics(source)) {
        const sections = makeSections(group.lines);
        if (!sections.length) continue;
        const definitions = definitionsFrom(group.lines);
        const task = taskFor(group.title, sections, definitions);
        addTopic({ title: group.title, intro: introFor(sections, definitions), sections }, definitions, task ? [task] : []);
      }
    }
    if (!topics.length) throw new Error('Добавь файл с учебным текстом или вставь текст из конспекта.');

    return {
      id: `course-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)}`,
      title: takeText(title) || structured?.title || 'Мои материалы',
      subject: structured?.subject || 'Подготовка к КТ',
      subtitle: structured?.subtitle || 'Конспект, определения и задания из твоих материалов.',
      topics, terms, tasks,
      sources: sources.map((source) => ({ name: source.name, text: source.text })),
    };
  }

  window.StudyImport = { readFiles, buildCourse };
})();
