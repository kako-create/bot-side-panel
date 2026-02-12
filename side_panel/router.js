const ACTIVE_SCREEN_KEY = 'bot_sp_active_screen_v1';

export const loadActiveScreenId = async () => {
  try {
    const result = await chrome.storage.local.get([ACTIVE_SCREEN_KEY]);
    return result?.[ACTIVE_SCREEN_KEY] ?? null;
  } catch {
    return null;
  }
};

export const saveActiveScreenId = async (screenId) => {
  try {
    await chrome.storage.local.set({ [ACTIVE_SCREEN_KEY]: screenId });
  } catch {
    // ignore
  }
};

