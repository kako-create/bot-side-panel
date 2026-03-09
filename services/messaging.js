export const MessageType = Object.freeze({
  BOT_AUTH: 'BOT_SP_AUTH',
  BOT_ID: 'BOT_SP_BOT_ID',
  REQUEST_CONTEXT: 'BOT_SP_REQUEST_CONTEXT',
  CONTEXT_CHANGED: 'BOT_SP_CONTEXT_CHANGED',
  COMPANY_INFO: 'BOT_SP_COMPANY_INFO',
  DEBUG_EVENT: 'BOT_SP_DEBUG_EVENT',
  DEBUG_CLEAR: 'BOT_SP_DEBUG_CLEAR',
  DEBUG_EXPORT: 'BOT_SP_DEBUG_EXPORT',
  DEBUG_STATS: 'BOT_SP_DEBUG_STATS',
  LIST_URA_FUNCTIONS: 'BOT_SP_LIST_URA_FUNCTIONS',
  GET_CONTEXT: 'BOT_SP_GET_CONTEXT',
  GET_SETTINGS: 'BOT_SP_GET_SETTINGS',
  UPDATE_SETTINGS: 'BOT_SP_UPDATE_SETTINGS',
  RESET_SETTINGS: 'BOT_SP_RESET_SETTINGS',
  START_SYNC: 'BOT_SP_START_SYNC',
  SYNC_VARIABLES: 'BOT_SP_SYNC_VARIABLES',
  SYNC_TAGS: 'BOT_SP_SYNC_TAGS',
  SYNC_AI_INTENTS: 'BOT_SP_SYNC_AI_INTENTS',
  FETCH_AI_INTENTS_PAGE: 'BOT_SP_FETCH_AI_INTENTS_PAGE',
  SYNC_LEX_INTENTS: 'BOT_SP_SYNC_LEX_INTENTS',
  FETCH_LEX_INTENTS_PAGE: 'BOT_SP_FETCH_LEX_INTENTS_PAGE',
  GET_STATUS: 'BOT_SP_GET_STATUS',
  LIST_BOTS: 'BOT_SP_LIST_BOTS',
  REMOVE_BOT: 'BOT_SP_REMOVE_BOT',
  SYNC_STATUS: 'BOT_SP_SYNC_STATUS',
  OPEN_URL_CURRENT_TAB: 'BOT_SP_OPEN_URL_CURRENT_TAB',
  TOGGLE_PIN: 'BOT_SP_TOGGLE_PIN',
});

export const ErrorCode = Object.freeze({
  INVALID_REQUEST: 'INVALID_REQUEST',
  NOT_READY: 'NOT_READY',
  NOT_FOUND: 'NOT_FOUND',
  STORAGE_ERROR: 'STORAGE_ERROR',
  QUOTA: 'QUOTA',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL: 'INTERNAL',
});

export const respondOk = (data) => ({ ok: true, data });

export const respondErr = (code, message, details) => ({
  ok: false,
  error: { code, message, details },
});

export const callBG = (type, payload = {}) =>
  new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: { code: ErrorCode.INTERNAL, message: err.message } });
        return;
      }
      if (!response || typeof response.ok !== 'boolean') {
        resolve({ ok: true, data: response ?? null });
        return;
      }
      resolve(response);
    });
  });
