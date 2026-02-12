const CONSULTA_INTENT_KEY = 'bot_sp_consulta_intent_v1';

export const saveConsultaIntent = async (intent) => {
  try {
    await chrome.storage.local.set({
      [CONSULTA_INTENT_KEY]: {
        ...intent,
        createdAt: Date.now(),
      },
    });
    return true;
  } catch {
    return false;
  }
};

export const consumeConsultaIntent = async () => {
  try {
    const result = await chrome.storage.local.get([CONSULTA_INTENT_KEY]);
    const intent = result?.[CONSULTA_INTENT_KEY] ?? null;
    if (intent) {
      await chrome.storage.local.remove([CONSULTA_INTENT_KEY]);
    }
    return intent;
  } catch {
    return null;
  }
};
