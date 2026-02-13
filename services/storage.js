export const normalizeStorageError = (error) => {
  if (!error) return 'STORAGE_ERROR';
  return /quota/i.test(String(error)) ? 'STORAGE_QUOTA' : String(error);
};

export const mapStorageErrorCode = (error) =>
  /quota/i.test(String(error)) ? 'QUOTA' : 'STORAGE_ERROR';

const resolveStorageArea = (area) => {
  const name = String(area ?? '').trim();
  if (name && chrome?.storage?.[name]) return name;
  if (name === 'session' && chrome?.storage?.local) return 'local';
  return name;
};

export const safeGet = async (area, keys) =>
  new Promise((resolve) => {
    try {
      const targetArea = resolveStorageArea(area);
      if (!targetArea || !chrome?.storage?.[targetArea]) {
        resolve({ ok: false, error: normalizeStorageError(`Área de storage inválida: ${area}`) });
        return;
      }
      chrome.storage[targetArea].get(keys, (result) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: normalizeStorageError(err.message) });
          return;
        }
        resolve({ ok: true, data: result ?? {} });
      });
    } catch (error) {
      resolve({ ok: false, error: normalizeStorageError(error) });
    }
  });

export const safeSet = async (area, obj) =>
  new Promise((resolve) => {
    try {
      const targetArea = resolveStorageArea(area);
      if (!targetArea || !chrome?.storage?.[targetArea]) {
        resolve({ ok: false, error: normalizeStorageError(`Área de storage inválida: ${area}`) });
        return;
      }
      chrome.storage[targetArea].set(obj, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: normalizeStorageError(err.message) });
          return;
        }
        resolve({ ok: true });
      });
    } catch (error) {
      resolve({ ok: false, error: normalizeStorageError(error) });
    }
  });

export const safeRemove = async (area, keys) =>
  new Promise((resolve) => {
    try {
      const targetArea = resolveStorageArea(area);
      if (!targetArea || !chrome?.storage?.[targetArea]) {
        resolve({ ok: false, error: normalizeStorageError(`Área de storage inválida: ${area}`) });
        return;
      }
      chrome.storage[targetArea].remove(keys, () => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve({ ok: false, error: normalizeStorageError(err.message) });
          return;
        }
        resolve({ ok: true });
      });
    } catch (error) {
      resolve({ ok: false, error: normalizeStorageError(error) });
    }
  });
