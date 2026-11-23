(() => {
  "use strict";

  const maxInputBytes = 20 * 1024 * 1024;
  const maxSavedBytes = 2 * 1024 * 1024;
  const maxPhotos = 8;
  const photoTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif", "image/bmp"]);
  const photoExtensions = /\.(?:png|jpe?g|webp|avif|gif|bmp)$/i;
  const storagePrefix = "kt-praktikum-photo:";
  const slotSelector = ".study-attachments";
  const activeUrls = new Map();
  const revisions = new WeakMap();
  const busyKeys = new Set();
  let databasePromise;

  function escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[character]);
  }

  function renderSlot(courseId, targetKey, label = "Изображения") {
    const key = JSON.stringify([String(courseId), String(targetKey)]);
    const controlLabel = label === "Изображения" ? "Добавить изображение" : `Добавить ${label.toLocaleLowerCase("ru")}`;
    return `<section class="study-attachments" data-study-attachment-key="${escape(key)}" aria-label="${escape(label)}">
      <div class="attachment-list"></div>
      <details class="attachment-controls">
        <summary class="attachment-toggle">${escape(controlLabel)}</summary>
        <div class="attachment-panel">
          <label class="form-label">Подпись к изображению (по желанию)
            <input class="text-input attachment-caption-input" type="text" maxlength="160" placeholder="Например, формула из конспекта">
          </label>
          <div class="attachment-actions">
            <button type="button" class="button secondary attachment-choose">Выбрать файл</button>
            <input class="attachment-input" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif,image/bmp" hidden>
            <textarea class="text-input attachment-paste" rows="1" aria-label="Поле для вставки изображения" placeholder="Вставь сюда через Ctrl+V"></textarea>
          </div>
        </div>
      </details>
      <div class="attachment-status" role="status"></div>
    </section>`;
  }

  function openDatabase() {
    databasePromise ||= new Promise((resolve, reject) => {
      const request = indexedDB.open("kt-praktikum-photos", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("slots", { keyPath: "key" });
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => {
          database.close();
          databasePromise = undefined;
        };
        resolve(database);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Хранилище изображений занято."));
    }).catch(() => null);
    return databasePromise;
  }

  function transact(database, key, change) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction("slots", change ? "readwrite" : "readonly");
      const store = transaction.objectStore("slots");
      const request = store.get(key);
      let photos;
      let changeError;
      request.onsuccess = () => {
        photos = request.result?.photos || [];
        if (!change) return;
        try {
          photos = change(photos);
          if (photos.length) store.put({ key, photos });
          else store.delete(key);
        } catch (error) {
          changeError = error;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(photos);
      transaction.onabort = () => reject(changeError || transaction.error || request.error || new Error("Не удалось сохранить изображение."));
    });
  }

  function localPrefix(key) {
    return storagePrefix + encodeURIComponent(key) + ":";
  }

  function listLocal(key) {
    const prefix = localPrefix(key);
    const photos = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const storageKey = localStorage.key(index);
      if (!storageKey?.startsWith(prefix)) continue;
      try {
        const photo = JSON.parse(localStorage.getItem(storageKey));
        const [header, encoded] = String(photo?.url).split(",", 2);
        const mimeType = /^data:(image\/(?:png|jpeg|webp|avif|gif|bmp));base64$/i.exec(header)?.[1];
        if (typeof photo?.id === "string" && mimeType && encoded) {
          const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
          photos.push({ ...photo, blob: new Blob([bytes], { type: mimeType }) });
        }
      } catch {
        // Other images remain available if a browser entry is damaged.
      }
    }
    return photos.sort((left, right) => left.createdAt - right.createdAt);
  }

  async function listPhotos(key) {
    const database = await openDatabase();
    return database ? transact(database, key) : listLocal(key);
  }

  function checkCapacity(photos) {
    if (photos.length >= maxPhotos) throw new Error(`Сюда можно добавить до ${maxPhotos} изображений.`);
  }

  function asDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function putPhoto(key, photo) {
    const database = await openDatabase();
    if (database) {
      await transact(database, key, photos => {
        checkCapacity(photos);
        return [...photos, photo];
      });
      return;
    }
    const { blob, ...details } = photo;
    const url = await asDataUrl(blob);
    checkCapacity(listLocal(key));
    localStorage.setItem(localPrefix(key) + photo.id, JSON.stringify({ ...details, url }));
  }

  async function removePhoto(key, id) {
    const database = await openDatabase();
    if (database) {
      await transact(database, key, photos => photos.filter(photo => photo.id !== id));
      return;
    }
    localStorage.removeItem(localPrefix(key) + id);
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Браузер не смог открыть это изображение."));
      image.src = url;
    });
  }

  function resizePhoto(image, maxSide, quality) {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не может подготовить изображение.");
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Не удалось обработать изображение."));
    }, "image/webp", quality));
  }

  async function preparePhoto(file) {
    if (!photoTypes.has(file.type) && (file.type || !photoExtensions.test(file.name))) {
      throw new Error("Подойдут PNG, JPEG, WebP, AVIF, GIF или BMP.");
    }
    if (file.size > maxInputBytes) throw new Error("Выбери изображение размером до 20 МБ.");
    const url = URL.createObjectURL(file);
    try {
      const image = await loadImage(url);
      if (["image/png", "image/jpeg", "image/webp"].includes(file.type) &&
          file.size <= 768 * 1024 && Math.max(image.naturalWidth, image.naturalHeight) <= 2048) return file;
      let blob = await resizePhoto(image, 2048, 0.92);
      if (blob.size > maxSavedBytes) blob = await resizePhoto(image, 1500, 0.85);
      if (blob.size > maxSavedBytes) throw new Error("Сохрани изображение меньшего размера и попробуй снова.");
      return blob;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function releaseUrls(slot) {
    for (const url of activeUrls.get(slot) || []) URL.revokeObjectURL(url);
    activeUrls.delete(slot);
  }

  function slotsForKey(key) {
    return [...document.querySelectorAll(slotSelector)].filter(slot => slot.dataset.studyAttachmentKey === key);
  }

  function showStatus(slot, message, error = false) {
    const status = slot.querySelector(".attachment-status");
    status.classList.toggle("is-error", error);
    status.textContent = message;
  }

  function statusForKey(key, message, error = false) {
    for (const slot of slotsForKey(key)) showStatus(slot, message, error);
  }

  function errorMessage(error) {
    if (error?.name === "QuotaExceededError") return "Память браузера заполнена. Попробуй изображение меньшего размера.";
    if (["SecurityError", "InvalidStateError", "UnknownError"].includes(error?.name)) {
      return "Браузер не разрешил сохранить изображение. Попробуй открыть сайт по HTTPS или через локальный сервер.";
    }
    return error?.message || "Не удалось сохранить изображение.";
  }

  function updateBusy(slot) {
    const busy = busyKeys.has(slot.dataset.studyAttachmentKey);
    slot.querySelector(".attachment-choose").disabled = busy;
    slot.querySelector(".attachment-controls").setAttribute("aria-busy", String(busy));
    for (const button of slot.querySelectorAll(".attachment-remove")) button.disabled = busy;
  }

  async function refresh(slot) {
    const revision = (revisions.get(slot) || 0) + 1;
    revisions.set(slot, revision);
    try {
      const photos = await listPhotos(slot.dataset.studyAttachmentKey);
      if (!slot.isConnected || revisions.get(slot) !== revision) return;
      releaseUrls(slot);
      const urls = [];
      const label = slot.getAttribute("aria-label") || "Изображение из материала";
      slot.querySelector(".attachment-list").innerHTML = photos.map((photo, index) => {
        const url = URL.createObjectURL(photo.blob);
        urls.push(url);
        const alt = photo.caption || `${label} · ${index + 1}`;
        return `<figure class="attachment-item">
          <a class="attachment-link" href="${escape(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escape(`Открыть изображение ${index + 1} в полном размере`)}">
            <img class="attachment-image" src="${escape(url)}" alt="${escape(alt)}" loading="lazy" decoding="async">
          </a>
          ${photo.caption ? `<figcaption class="attachment-caption">${escape(photo.caption)}</figcaption>` : ""}
          <button type="button" class="button ghost attachment-remove" data-photo-id="${escape(photo.id)}" aria-label="${escape(`Убрать изображение ${index + 1}`)}">Убрать</button>
        </figure>`;
      }).join("");
      if (urls.length) activeUrls.set(slot, urls);
      updateBusy(slot);
    } catch (error) {
      if (slot.isConnected && revisions.get(slot) === revision) showStatus(slot, errorMessage(error), true);
    }
  }

  function hydrate(root) {
    for (const slot of activeUrls.keys()) {
      if (!slot.isConnected) releaseUrls(slot);
    }
    for (const slot of root.querySelectorAll(slotSelector)) {
      updateBusy(slot);
      void refresh(slot);
    }
  }

  async function savePhoto(slot, file) {
    const key = slot.dataset.studyAttachmentKey;
    if (!file || busyKeys.has(key)) return;
    busyKeys.add(key);
    updateBusy(slot);
    const captionInput = slot.querySelector(".attachment-caption-input");
    const caption = captionInput.value.trim().slice(0, 160);
    showStatus(slot, "Сохраняю изображение…");
    try {
      const blob = await preparePhoto(file);
      const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint32Array(4))].map(value => value.toString(36)).join("-");
      await putPhoto(key, { id, blob, caption, createdAt: Date.now() });
      if (captionInput.value.trim() === caption) captionInput.value = "";
      statusForKey(key, "Изображение добавлено.");
      await Promise.all(slotsForKey(key).map(refresh));
    } catch (error) {
      statusForKey(key, errorMessage(error), true);
    } finally {
      busyKeys.delete(key);
      for (const current of slotsForKey(key)) updateBusy(current);
    }
  }

  async function deleteFromSlot(slot, button) {
    const key = slot.dataset.studyAttachmentKey;
    if (busyKeys.has(key) || !window.confirm("Убрать это изображение из курса?")) return;
    busyKeys.add(key);
    updateBusy(slot);
    try {
      await removePhoto(key, button.dataset.photoId);
      statusForKey(key, "Изображение убрано.");
      await Promise.all(slotsForKey(key).map(refresh));
      slot.querySelector(".attachment-toggle").focus({ preventScroll: true });
    } catch (error) {
      statusForKey(key, errorMessage(error), true);
    } finally {
      busyKeys.delete(key);
      for (const current of slotsForKey(key)) updateBusy(current);
    }
  }

  document.addEventListener("click", event => {
    const chooser = event.target.closest(".attachment-choose");
    const remove = event.target.closest(".attachment-remove");
    if (chooser) chooser.closest(slotSelector).querySelector(".attachment-input").click();
    if (remove) void deleteFromSlot(remove.closest(slotSelector), remove);
  });

  document.addEventListener("change", event => {
    if (!event.target.matches(".attachment-input")) return;
    const [file] = event.target.files;
    event.target.value = "";
    void savePhoto(event.target.closest(slotSelector), file);
  });

  document.addEventListener("beforeinput", event => {
    if (event.target.matches(".attachment-paste")) event.preventDefault();
  });

  document.addEventListener("paste", event => {
    if (!event.target.matches(".attachment-paste")) return;
    event.preventDefault();
    const slot = event.target.closest(slotSelector);
    const file = [...(event.clipboardData?.items || [])]
      .find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile()
      || event.clipboardData?.files?.[0];
    if (file) void savePhoto(slot, file);
    else showStatus(slot, "В буфере обмена нет изображения. Скопируй сам скриншот или выбери файл.", true);
  });

  window.StudyAttachments = { renderSlot, hydrate };
})();
