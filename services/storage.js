export const normalizeStorageError = (error) => {
  if (!error) return 'STORAGE_ERROR';
  return /quota/i.test(String(error)) ? 'STORAGE_QUOTA' : String(error);
};

export const mapStorageErrorCode = (error) =>
  /quota/i.test(String(error)) ? 'QUOTA' : 'STORAGE_ERROR';

export const safeGet = async (area, keys) =>
  new Promise((resolve) => {
    try {
      chrome.storage[area].get(keys, (result) => {
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
      chrome.storage[area].set(obj, () => {
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
      chrome.storage[area].remove(keys, () => {
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
