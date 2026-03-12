import { AUTH_SESSION_TTL_MS } from '../config/limits.js';
import { DEBUG_SAVE_NETWORK_LOGS } from '../config/flags.js';
import { DEFAULT_MODE, MODE_BOT, MODE_URA, resolveContextFromUrl, normalizeMode } from '../config/modeResolver.js';
import { USER_SETTINGS_KEY, DEFAULT_USER_SETTINGS, sanitizeUserSettings, mergeUserSettings } from '../config/userSettings.js';
import { MessageType, ErrorCode, respondOk, respondErr } from '../services/messaging.js';
import { safeGet, safeSet, safeRemove } from '../services/storage.js';
import { listMetas, clearBotData, getMeta, saveMeta, addDebugLog, listDebugLogs, clearDebugLogs, countDebugLogs } from '../data/db.js';
import { startSync, getSyncState, cancelSync } from '../services/syncManager.js';
import { syncBotVariables } from '../services/variablesSync.js';
import { syncBotTags } from '../services/tagsSync.js';
import { syncBotIntents } from '../services/intentsSync.js';
import { syncLexIntents } from '../services/lexIntentsSync.js';
import {
  fetchBuilderPendingPage,
  fetchBuilderTrackingDetails,
  fetchUraAiAgentFunctions,
} from '../services/apiClient.js';

const CONTEXT_KEY = 'bot_sp_context_v1';
const AUTH_SESSION_KEY = 'bot_sp_auth_v1';

let contextState = {
  botId: null,
  mode: DEFAULT_MODE,
  appBaseUrl: null,
  updatedAt: null,
};

/** @type {Map<number, { botId: string | null, mode: string, appBaseUrl: string | null, updatedAt: string | null }>} */
const contextByTabState = new Map();

let authSessionState = {
  authorization: null,
  updatedAt: null,
  expiresAt: null,
};

let userSettingsState = { ...DEFAULT_USER_SETTINGS };

let lastAutoSyncBotId = null;
let storageError = null;

const isAuthSessionValid = (sessionAuth) => {
  if (!sessionAuth?.authorization) return false;
  if (!sessionAuth?.expiresAt) return true;
  return new Date(sessionAuth.expiresAt).getTime() > Date.now();
};

const initState = async () => {
  const localResult = await safeGet('local', [CONTEXT_KEY, USER_SETTINGS_KEY]);
  if (localResult.ok && localResult.data?.[CONTEXT_KEY]) {
    const stored = localResult.data[CONTEXT_KEY];
    contextState = {
      botId: stored?.botId ?? null,
      mode: normalizeMode(stored?.mode),
      appBaseUrl: stored?.appBaseUrl ?? null,
      updatedAt: stored?.updatedAt ?? null,
    };
  }
  if (localResult.ok) {
    userSettingsState = sanitizeUserSettings(localResult.data?.[USER_SETTINGS_KEY] ?? DEFAULT_USER_SETTINGS);
  }

  const sessionResult = await safeGet('session', [AUTH_SESSION_KEY]);
  if (sessionResult.ok && sessionResult.data?.[AUTH_SESSION_KEY]) {
    authSessionState = sessionResult.data[AUTH_SESSION_KEY];
    if (!isAuthSessionValid(authSessionState)) {
      authSessionState = { authorization: null, updatedAt: null, expiresAt: null };
      await safeRemove('session', [AUTH_SESSION_KEY]);
    }
  }
};

const toTabId = (value) => {
  if (!Number.isInteger(value)) return null;
  if (value < 0) return null;
  return value;
};

const normalizeContextSnapshot = (value) => ({
  botId: value?.botId ?? null,
  mode: normalizeMode(value?.mode),
  appBaseUrl: value?.appBaseUrl ?? null,
  updatedAt: value?.updatedAt ?? null,
});

const areContextsEqual = (left, right) =>
  (left?.botId ?? null) === (right?.botId ?? null) &&
  normalizeMode(left?.mode) === normalizeMode(right?.mode) &&
  (left?.appBaseUrl ?? null) === (right?.appBaseUrl ?? null);

const getTabContext = (tabId) => {
  const normalizedTabId = toTabId(tabId);
  if (normalizedTabId == null) return null;
  const value = contextByTabState.get(normalizedTabId);
  return value ? normalizeContextSnapshot(value) : null;
};

const setTabContext = (tabId, context) => {
  const normalizedTabId = toTabId(tabId);
  if (normalizedTabId == null) return false;
  const next = normalizeContextSnapshot(context);
  const prev = contextByTabState.get(normalizedTabId) ?? null;
  if (areContextsEqual(prev, next)) return false;
  contextByTabState.set(normalizedTabId, next);
  return true;
};

const getActiveTab = async () => {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tabs?.[0] ?? null;
  } catch {
    return null;
  }
};

const BUILDER_HOSTS = new Set([
  'new.boteria.com.br',
  'bots.digitalcontact.cloud',
]);

const getUrlHostname = (url) => {
  try {
    return new URL(String(url ?? '')).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const isBuilderUrl = (url) => {
  const host = getUrlHostname(url);
  if (!host) return false;
  return BUILDER_HOSTS.has(host);
};

const isTransientTabUrl = (url) => {
  const value = String(url ?? '').trim().toLowerCase();
  if (!value) return true;
  if (value === 'about:blank') return true;
  return (
    value.startsWith('about:') ||
    value.startsWith('chrome-error://') ||
    value.startsWith('edge-error://')
  );
};

const requestContextFromTab = (tabId) =>
  new Promise((resolve) => {
    const normalizedTabId = toTabId(tabId);
    if (normalizedTabId == null) {
      resolve(null);
      return;
    }
    try {
      chrome.tabs.sendMessage(normalizedTabId, { type: MessageType.REQUEST_CONTEXT }, (response) => {
        const err = chrome.runtime.lastError;
        if (err) {
          resolve(null);
          return;
        }
        const url = typeof response?.url === 'string' ? response.url : null;
        if (!url) {
          resolve(null);
          return;
        }
        resolve({ url });
      });
    } catch {
      resolve(null);
    }
  });

const requestAiIntentsFromTab = (tabId, botId, authorization) =>
  new Promise((resolve, reject) => {
    const normalizedTabId = toTabId(tabId);
    if (normalizedTabId == null) {
      reject(new Error('Aba ativa inválida para buscar intenções.'));
      return;
    }
    try {
      chrome.tabs.sendMessage(
        normalizedTabId,
        { type: MessageType.FETCH_AI_INTENTS_PAGE, botId, authorization },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            reject(new Error(err.message || 'Falha ao acessar o builder.'));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error?.message ?? response?.error ?? 'Falha ao buscar intenções na página.'));
            return;
          }
          resolve(Array.isArray(response?.items) ? response.items : []);
        },
      );
    } catch (error) {
      reject(error);
    }
  });

const requestLexIntentsFromTab = (tabId) =>
  new Promise((resolve, reject) => {
    const normalizedTabId = toTabId(tabId);
    if (normalizedTabId == null) {
      reject(new Error('Aba ativa inválida para buscar intenções.'));
      return;
    }
    try {
      chrome.tabs.sendMessage(
        normalizedTabId,
        { type: MessageType.FETCH_LEX_INTENTS_PAGE },
        (response) => {
          const err = chrome.runtime.lastError;
          if (err) {
            reject(new Error(err.message || 'Falha ao acessar o builder.'));
            return;
          }
          if (!response?.ok) {
            reject(new Error(response?.error?.message ?? response?.error ?? 'Falha ao buscar intenções na página.'));
            return;
          }
          resolve(Array.isArray(response?.items) ? response.items : []);
        },
      );
    } catch (error) {
      reject(error);
    }
  });

const persistContextState = async () => {
  const result = await safeSet('local', { [CONTEXT_KEY]: contextState });
  if (!result.ok) storageError = result.error;
};

const persistAuthState = async () => {
  const result = await safeSet('session', { [AUTH_SESSION_KEY]: authSessionState });
  if (!result.ok) storageError = result.error;
};

const persistUserSettingsState = async () => {
  const result = await safeSet('local', { [USER_SETTINGS_KEY]: userSettingsState });
  if (!result.ok) storageError = result.error;
  return Boolean(result.ok);
};

const areSettingsEqual = (left, right) =>
  left.appearance === right.appearance &&
  left.themeId === right.themeId &&
  left.autoSyncEnabled === right.autoSyncEnabled &&
  left.autoSyncFullItems === right.autoSyncFullItems;

const areSyncSettingsEqual = (left, right) =>
  left.autoSyncEnabled === right.autoSyncEnabled &&
  left.autoSyncFullItems === right.autoSyncFullItems;

const updateUserSettingsState = async ({ patch = null, reset = false } = {}) => {
  const prev = sanitizeUserSettings(userSettingsState);
  const nextBase = reset ? sanitizeUserSettings(DEFAULT_USER_SETTINGS) : mergeUserSettings(prev, patch);
  const next = {
    ...nextBase,
    updatedAt: new Date().toISOString(),
  };
  userSettingsState = next;
  await persistUserSettingsState();
  const changed = !areSettingsEqual(prev, next);
  const syncChanged = !areSyncSettingsEqual(prev, next);
  if (syncChanged) {
    lastAutoSyncBotId = null;
  }
  return { settings: sanitizeUserSettings(userSettingsState), changed, syncChanged };
};

const getUserSettingsState = () => sanitizeUserSettings(userSettingsState);

const updateAuthSession = async (token) => {
  const now = new Date();
  authSessionState = {
    authorization: token,
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + AUTH_SESSION_TTL_MS).toISOString(),
  };
  await persistAuthState();
};

const updateContextFromUrl = async (url, { tabId = null, broadcast = true } = {}) => {
  const { botId, mode, appBaseUrl } = resolveContextFromUrl(url);
  if (!botId && !mode) return { changed: false, context: null };

  const normalizedTabId = toTabId(tabId);
  const nextContext = {
    botId,
    mode: normalizeMode(mode),
    appBaseUrl: appBaseUrl ?? null,
    updatedAt: new Date().toISOString(),
  };

  const tabChanged = normalizedTabId != null ? setTabContext(normalizedTabId, nextContext) : false;
  const globalChanged = !areContextsEqual(contextState, nextContext);
  const changed = tabChanged || globalChanged;

  if (!changed) {
    return {
      changed: false,
      context: normalizedTabId != null ? getTabContext(normalizedTabId) : normalizeContextSnapshot(contextState),
    };
  }

  contextState = normalizeContextSnapshot(nextContext);
  await persistContextState();
  if (broadcast) {
    broadcastContextChanged({ context: nextContext, tabId: normalizedTabId });
  }
  return { changed: true, context: normalizeContextSnapshot(nextContext) };
};

const resolveBotIdFromMessage = (message, senderTabId = null) => {
  const explicitBotId = String(message?.botId ?? '').trim();
  if (explicitBotId) return explicitBotId;
  const fromUrl = resolveContextFromUrl(message?.url).botId;
  if (fromUrl) return fromUrl;
  const tabContext = getTabContext(senderTabId);
  if (tabContext?.botId) return tabContext.botId;
  return contextState.botId || null;
};

const normalizeCompanyPayload = (message) => {
  const orgId = String(message?.orgId ?? '').trim();
  const fantasyName = String(message?.fantasyName ?? '').trim();
  if (!orgId || !fantasyName) return null;
  return { orgId, fantasyName };
};

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const clampText = (value, maxLen) => {
  const text = String(value ?? '');
  if (!maxLen || text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 16))}\n... (truncado)`;
};

const DEBUG_SENSITIVE_QUERY_KEYS = new Set([
  'token',
  'access_token',
  'refresh_token',
  'id_token',
  'api_key',
  'apikey',
  'apiKey',
  'key',
  'secret',
  'client_secret',
  'clientSecret',
  'password',
  'pass',
  'authorization',
  'auth',
  'jwt',
  'session',
]);

const DEBUG_SENSITIVE_JSON_KEY_RE =
  /^(?:authorization|apiKey|apikey|api_key|token|access_token|refresh_token|id_token|password|pass|secret|clientSecret|client_secret)$/i;

const isAbsoluteUrlLike = (value) => /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(String(value ?? ''));

const sanitizeUrlForDebug = (rawUrl) => {
  const text = String(rawUrl ?? '').trim();
  if (!text) return null;
  try {
    const absolute = isAbsoluteUrlLike(text);
    const url = absolute ? new URL(text) : new URL(text, 'https://debug.invalid');

    // Mascarar parametros sensiveis da query.
    for (const [key, value] of url.searchParams.entries()) {
      const k = String(key ?? '');
      const kFold = k.toLowerCase();
      const v = String(value ?? '');
      if (DEBUG_SENSITIVE_QUERY_KEYS.has(kFold) || DEBUG_SENSITIVE_QUERY_KEYS.has(k)) {
        url.searchParams.set(k, 'REDACTED');
        continue;
      }
      // Protecao extra: se um valor parecer um JWT, mascarar.
      if (
        v.length > 30 &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)
      ) {
        url.searchParams.set(k, 'REDACTED');
      }
    }

    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Alternativa de melhor esforco: mascarar params obvios sem fazer parse.
    return text.replace(
      /([?&](?:token|access_token|refresh_token|id_token|apiKey|apikey|api_key|password|pass|secret|client_secret|clientSecret)=)[^&#\s]+/gi,
      '$1REDACTED',
    );
  }
};

const redactDebugJsonValue = (value, depth = 0) => {
  if (depth > 12) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.map((v) => redactDebugJsonValue(v, depth + 1));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (DEBUG_SENSITIVE_JSON_KEY_RE.test(k)) {
        out[k] = '[REDACTED]';
        continue;
      }
      if (
        typeof v === 'string' &&
        v.length > 200 &&
        /^data:image\/[^;]+;base64,/i.test(v)
      ) {
        out[k] = '[OMITTED]';
        continue;
      }
      out[k] = redactDebugJsonValue(v, depth + 1);
    }
    return out;
  }
  if (
    typeof value === 'string' &&
    value.length > 30 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
  ) {
    return '[REDACTED]';
  }
  return value;
};

const redactDebugText = (rawText) => {
  const text = String(rawText ?? '');
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    const redacted = redactDebugJsonValue(parsed);
    return JSON.stringify(redacted);
  } catch {
    return text
      .replace(
        /([?&](?:token|access_token|refresh_token|id_token|apiKey|apikey|api_key|password|pass|secret|client_secret|clientSecret)=)[^&#\s]+/gi,
        '$1REDACTED',
      )
      .replace(
        /(\"(?:authorization|apiKey|apikey|api_key|token|access_token|refresh_token|id_token|password|pass|secret|clientSecret|client_secret)\"\s*:\s*\")([^\"]*)(\")/gi,
        '$1[REDACTED]$3',
      );
  }
};

const normalizeDebugEvent = (message) => {
  const raw = message?.event;
  if (!raw || typeof raw !== 'object') return null;
  const url = sanitizeUrlForDebug(raw.url);
  if (!url) return null;
  const method = String(raw.method ?? '').trim().toUpperCase() || 'GET';
  const kind = String(raw.kind ?? '').trim().toLowerCase() || 'unknown';
  const status = raw.status == null ? null : Number(raw.status);
  const durationMs = raw.durationMs == null ? null : Number(raw.durationMs);
  const responseBytes = raw.responseBytes == null ? null : Number(raw.responseBytes);
  const responseText = raw.responseText ? clampText(redactDebugText(raw.responseText), 20_000) : null;
  const href = raw.href ? sanitizeUrlForDebug(raw.href) : null;

  return {
    createdAt: new Date().toISOString(),
    kind,
    method,
    url,
    status: Number.isFinite(status) ? status : null,
    ok: Boolean(raw.ok),
    durationMs: Number.isFinite(durationMs) ? durationMs : null,
    responseBytes: Number.isFinite(responseBytes) ? responseBytes : null,
    responseText,
    href,
  };
};

const sanitizeDebugLogForExport = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const url = sanitizeUrlForDebug(entry.url);
  if (!url) return null;
  return {
    ...entry,
    url,
    href: entry.href ? sanitizeUrlForDebug(entry.href) : null,
    responseText: entry.responseText ? clampText(redactDebugText(entry.responseText), 20_000) : null,
  };
};

const getStoredMode = (meta) => {
  const raw = String(meta?.mode ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const getSyncedMode = async (botId) => {
  if (!botId) return null;
  try {
    const meta = await getMeta(botId);
    return getStoredMode(meta);
  } catch {
    return null;
  }
};

const resolveContextForActiveTab = async ({ refreshFromContent = false } = {}) => {
  const activeTab = await getActiveTab();
  const activeTabId = toTabId(activeTab?.id);
  if (activeTabId == null) {
    return { context: normalizeContextSnapshot(contextState), tabId: null };
  }

  if (refreshFromContent) {
    const fromContent = await requestContextFromTab(activeTabId);
    if (fromContent?.url) {
      await updateContextFromUrl(fromContent.url, { tabId: activeTabId, broadcast: false });
    }
  }

  const activeUrl = typeof activeTab?.url === 'string' ? activeTab.url : '';
  if (activeUrl) {
    const parsed = resolveContextFromUrl(activeUrl);
    if (parsed?.botId || parsed?.mode) {
      await updateContextFromUrl(activeUrl, { tabId: activeTabId, broadcast: false });
    }
  }

  const byTab = getTabContext(activeTabId);
  if (byTab) {
    return { context: byTab, tabId: activeTabId };
  }

  const fromTabUrl = resolveContextFromUrl(activeUrl);
  const canFallbackToGlobal =
    Boolean(contextState?.botId) &&
    (isBuilderUrl(activeUrl) || isTransientTabUrl(activeUrl));

  if (canFallbackToGlobal) {
    const fallback = normalizeContextSnapshot({
      ...contextState,
      appBaseUrl: fromTabUrl?.appBaseUrl ?? contextState?.appBaseUrl ?? null,
    });
    setTabContext(activeTabId, fallback);
    return { context: fallback, tabId: activeTabId };
  }

  return {
    context: normalizeContextSnapshot({
      botId: null,
      mode: DEFAULT_MODE,
      appBaseUrl: fromTabUrl?.appBaseUrl ?? null,
      updatedAt: null,
    }),
    tabId: activeTabId,
  };
};

const withSyncedMode = async (context) => {
  const base = normalizeContextSnapshot(context);
  if (!base.botId) return base;
  const syncedMode = await getSyncedMode(base.botId);
  if (!syncedMode) return base;
  return { ...base, mode: syncedMode };
};

const broadcastContextChanged = ({ context, tabId = null }) => {
  try {
    chrome.runtime.sendMessage(
      {
        type: MessageType.CONTEXT_CHANGED,
        context: normalizeContextSnapshot(context),
        tabId: toTabId(tabId),
        hasAuth: Boolean(authSessionState.authorization),
        authUpdatedAt: authSessionState.updatedAt,
      },
      () => {
        const err = chrome.runtime.lastError;
        if (err && !/receiving end does not exist/i.test(err.message)) {
          // ignorar erros conhecidos de "no receiver"
        }
      },
    );
  } catch {
    // ignorar
  }
};

const broadcastStatus = (state) => {
  try {
    chrome.runtime.sendMessage({ type: MessageType.SYNC_STATUS, state }, () => {
      const err = chrome.runtime.lastError;
      if (err && !/receiving end does not exist/i.test(err.message)) {
        // ignorar erros conhecidos de "no receiver"
      }
    });
  } catch {
    // ignorar
  }
};

const triggerAutoSync = async (context = contextState) => {
  const effectiveContext = normalizeContextSnapshot(context);
  const settings = getUserSettingsState();
  if (!settings.autoSyncEnabled) return;
  if (!effectiveContext.botId || !authSessionState.authorization) return;
  if (effectiveContext.botId === lastAutoSyncBotId) return;
  lastAutoSyncBotId = effectiveContext.botId;
  try {
    await startSync({
      botId: effectiveContext.botId,
      authorization: authSessionState.authorization,
      fullItems: settings.autoSyncFullItems,
      onProgress: broadcastStatus,
    });
  } catch {
    // erro de sync ja reportado via status
  }
};

const initPromise = initState();

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

if (chrome.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    const normalizedTabId = toTabId(tabId);
    if (normalizedTabId == null) return;
    contextByTabState.delete(normalizedTabId);
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const respond = (payload) => {
    sendResponse(payload);
    return true;
  };

  if (!message?.type) return false;

  switch (message.type) {
    case MessageType.BOT_AUTH: {
      initPromise.then(() => {
        if (typeof message.token === 'string' && message.token.toLowerCase().startsWith('bearer ')) {
          updateAuthSession(message.token).then(triggerAutoSync);
          respond(respondOk({ ok: true }));
          return;
        }
        respond(respondErr(ErrorCode.INVALID_REQUEST, 'Token inválido.'));
      });
      return true;
    }
    case MessageType.BOT_ID: {
      initPromise.then(() => {
        const senderTabId = toTabId(sender?.tab?.id);
        updateContextFromUrl(message.url, { tabId: senderTabId }).then((result) => {
          if (result?.changed && result.context) triggerAutoSync(result.context);
        });
        respond(respondOk({ ok: true }));
      });
      return true;
    }
    case MessageType.COMPANY_INFO: {
      initPromise.then(async () => {
        const company = normalizeCompanyPayload(message);
        if (!company) {
          respond(respondOk({ ok: false, skipped: 'invalid_payload' }));
          return;
        }

        const targetBotId = resolveBotIdFromMessage(message, sender?.tab?.id);
        if (!targetBotId) {
          respond(respondOk({ ok: false, skipped: 'bot_not_found' }));
          return;
        }

        try {
          const current = await getMeta(targetBotId);
          if (!current) {
            respond(respondOk({ ok: false, skipped: 'meta_not_found' }));
            return;
          }

          const sameOrg = String(current.orgId ?? '').trim() === company.orgId;
          const sameName = String(current.companyFantasyName ?? '').trim() === company.fantasyName;
          if (sameOrg && sameName) {
            respond(respondOk({ ok: true, updated: false }));
            return;
          }

          await saveMeta({
            ...current,
            botId: targetBotId,
            orgId: company.orgId,
            companyFantasyName: company.fantasyName,
            companyUpdatedAt: new Date().toISOString(),
          });
          respond(respondOk({ ok: true, updated: true }));
        } catch (error) {
          respond(
            respondErr(
              ErrorCode.INTERNAL,
              'Falha ao salvar dados da organização.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.DEBUG_EVENT: {
      initPromise.then(async () => {
        if (!DEBUG_SAVE_NETWORK_LOGS) {
          respond(respondOk({ ok: false, skipped: 'disabled' }));
          return;
        }
        const entry = normalizeDebugEvent(message);
        if (!entry) {
          respond(respondOk({ ok: false, skipped: 'invalid_payload' }));
          return;
        }
        try {
          await addDebugLog(entry);
          respond(respondOk({ ok: true }));
        } catch (error) {
          respond(
            respondErr(ErrorCode.INTERNAL, 'Falha ao salvar debug.', String(error?.message ?? error)),
          );
        }
      });
      return true;
    }
    case MessageType.DEBUG_CLEAR: {
      initPromise.then(async () => {
        try {
          await clearDebugLogs();
          respond(respondOk({ ok: true }));
        } catch (error) {
          respond(respondErr(ErrorCode.INTERNAL, 'Falha ao limpar debug.', String(error?.message ?? error)));
        }
      });
      return true;
    }
    case MessageType.DEBUG_STATS: {
      initPromise.then(async () => {
        try {
          const count = await countDebugLogs();
          respond(respondOk({ enabled: DEBUG_SAVE_NETWORK_LOGS, count }));
        } catch (error) {
          respond(respondErr(ErrorCode.INTERNAL, 'Falha ao ler debug.', String(error?.message ?? error)));
        }
      });
      return true;
    }
    case MessageType.DEBUG_EXPORT: {
      initPromise.then(async () => {
        try {
          const logs = await listDebugLogs({ newestFirst: false });
          const sanitized = (logs || [])
            .map((entry) => {
              try {
                return sanitizeDebugLogForExport(entry);
              } catch {
                return null;
              }
            })
            .filter(Boolean);
          respond(respondOk({ logs: sanitized }));
        } catch (error) {
          respond(respondErr(ErrorCode.INTERNAL, 'Falha ao exportar debug.', String(error?.message ?? error)));
        }
      });
      return true;
    }
    case MessageType.LIST_URA_FUNCTIONS: {
      initPromise.then(async () => {
        if (!authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'Token ausente.'));
          return;
        }
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const activeContext = await withSyncedMode(active.context);
        if (activeContext.mode !== MODE_URA) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'Disponível apenas no mode URA.'));
          return;
        }
        try {
          const functions = await fetchUraAiAgentFunctions(authSessionState.authorization);
          respond(respondOk({ functions: functions || [] }));
        } catch (error) {
          respond(
            respondErr(
              ErrorCode.INTERNAL,
              'Falha ao buscar funções.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.GET_CONTEXT: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const context = await withSyncedMode(active.context);
        respond(
          respondOk({
            context,
            tabId: active.tabId,
            hasAuth: Boolean(authSessionState.authorization),
            authorization: message?.includeAuth ? authSessionState.authorization : null,
            authUpdatedAt: authSessionState.updatedAt,
            storageError,
          }),
        );
      });
      return true;
    }
    case MessageType.GET_SETTINGS: {
      initPromise.then(() => {
        respond(respondOk({ settings: getUserSettingsState() }));
      });
      return true;
    }
    case MessageType.UPDATE_SETTINGS: {
      initPromise.then(async () => {
        try {
          if (message?.settings && !isPlainObject(message.settings)) {
            respond(respondErr(ErrorCode.INVALID_REQUEST, 'settings inválido.'));
            return;
          }
          const result = await updateUserSettingsState({ patch: message?.settings ?? {} });
          respond(respondOk(result));
          if (result.syncChanged && result.settings.autoSyncEnabled) {
            triggerAutoSync();
          }
        } catch (error) {
          respond(
            respondErr(
              ErrorCode.INTERNAL,
              'Falha ao salvar configurações.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.RESET_SETTINGS: {
      initPromise.then(async () => {
        try {
          const result = await updateUserSettingsState({ reset: true });
          respond(respondOk(result));
          if (result.syncChanged && result.settings.autoSyncEnabled) {
            triggerAutoSync();
          }
        } catch (error) {
          respond(
            respondErr(
              ErrorCode.INTERNAL,
              'Falha ao restaurar configurações.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.GET_STATUS: {
      initPromise.then(() => {
        respond(respondOk({ status: getSyncState() }));
      });
      return true;
    }
    case MessageType.FETCH_PENDING_CHANGES_PAGE: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }

        try {
          const payload = await fetchBuilderPendingPage(requestedBotId, authSessionState.authorization, {
            page: message?.page,
            limit: message?.limit,
          });
          respond(respondOk(payload));
        } catch (error) {
          const status = Number(error?.status ?? 0);
          const code =
            status === 401 || status === 419 ? ErrorCode.UNAUTHORIZED : ErrorCode.INTERNAL;
          respond(
            respondErr(
              code,
              'Falha ao buscar alterações pendentes.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.FETCH_PENDING_CHANGE_DETAILS: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        const apiId = String(message?.apiId ?? '').trim();
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }
        if (!apiId) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'apiId ausente.'));
          return;
        }

        try {
          const payload = await fetchBuilderTrackingDetails(
            requestedBotId,
            apiId,
            authSessionState.authorization,
          );
          respond(respondOk(payload));
        } catch (error) {
          const status = Number(error?.status ?? 0);
          const code =
            status === 401 || status === 419 ? ErrorCode.UNAUTHORIZED : ErrorCode.INTERNAL;
          respond(
            respondErr(
              code,
              'Falha ao buscar detalhes da alteração.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.START_SYNC: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }
        startSync({
          botId: requestedBotId,
          authorization: authSessionState.authorization,
          fullItems: Boolean(message?.fullItems),
          onProgress: broadcastStatus,
        })
          .then((state) => respond(respondOk({ status: state })))
          .catch((error) =>
            respond(respondErr(ErrorCode.INTERNAL, 'Falha na sincronização.', String(error?.message ?? error))),
          );
      });
      return true;
    }
    case MessageType.SYNC_VARIABLES: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }
        const syncedMode = await getSyncedMode(requestedBotId);
        if (!syncedMode) {
          respond(
            respondErr(
              ErrorCode.NOT_READY,
              'Modo (BOT/URA) não identificado. Execute "Sinc. Busca avançada" para definir o modo.',
            ),
          );
          return;
        }
        syncBotVariables({
          botId: requestedBotId,
          authorization: authSessionState.authorization,
          mode: syncedMode,
        })
          .then((data) => respond(respondOk(data)))
          .catch((error) =>
            respond(
              respondErr(
                ErrorCode.INTERNAL,
                'Falha ao sincronizar variáveis.',
                String(error?.message ?? error),
              ),
            ),
          );
      });
      return true;
    }
    case MessageType.SYNC_TAGS: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }
        const syncedMode = await getSyncedMode(requestedBotId);
        if (!syncedMode) {
          respond(
            respondErr(
              ErrorCode.NOT_READY,
              'Modo (BOT/URA) não identificado. Execute "Sinc. Busca avançada" para definir o modo.',
            ),
          );
          return;
        }
        syncBotTags({
          botId: requestedBotId,
          authorization: authSessionState.authorization,
          mode: syncedMode,
        })
          .then((data) => respond(respondOk(data)))
          .catch((error) =>
            respond(
              respondErr(
                ErrorCode.INTERNAL,
                'Falha ao sincronizar TAGs.',
                String(error?.message ?? error),
              ),
            ),
          );
      });
      return true;
    }
    case MessageType.SYNC_AI_INTENTS: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }

        const syncedMode = (await getSyncedMode(requestedBotId)) ?? normalizeMode(active.context?.mode);
        if (syncedMode !== MODE_BOT) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'Disponível apenas no mode BOT.'));
          return;
        }

        try {
          const items = await requestAiIntentsFromTab(active.tabId, requestedBotId, authSessionState.authorization);
          const data = await syncBotIntents({
            botId: requestedBotId,
            authorization: authSessionState.authorization,
            items,
          });
          respond(respondOk(data));
        } catch (error) {
          respond(
            respondErr(
              ErrorCode.INTERNAL,
              'Falha ao sincronizar intenções.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.SYNC_LEX_INTENTS: {
      initPromise.then(async () => {
        const active = await resolveContextForActiveTab({ refreshFromContent: true });
        const requestedBotId = message?.botId ?? active.context?.botId ?? contextState.botId;
        if (!requestedBotId) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ausente.'));
          return;
        }

        const syncedMode = (await getSyncedMode(requestedBotId)) ?? normalizeMode(active.context?.mode);
        if (syncedMode !== MODE_BOT) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'Disponível apenas no mode BOT.'));
          return;
        }

        try {
          const items = await requestLexIntentsFromTab(active.tabId);
          const data = await syncLexIntents({
            botId: requestedBotId,
            items,
          });
          respond(respondOk(data));
        } catch (error) {
          respond(
            respondErr(
              ErrorCode.INTERNAL,
              'Falha ao sincronizar intenções.',
              String(error?.message ?? error),
            ),
          );
        }
      });
      return true;
    }
    case MessageType.LIST_BOTS: {
      initPromise.then(() => {
        listMetas()
          .then((metas) => respond(respondOk({ bots: metas || [] })))
          .catch((error) =>
            respond(respondErr(ErrorCode.INTERNAL, 'Falha ao listar bots.', String(error?.message ?? error))),
          );
      });
      return true;
    }
    case MessageType.REMOVE_BOT: {
      initPromise.then(() => {
        if (!message?.botId) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'botId obrigatório.'));
          return;
        }
        getMeta(message.botId)
          .then((meta) => {
            if (meta?.pinned) {
              respond(respondErr(ErrorCode.INVALID_REQUEST, 'Bot está fixado. Desfixe para remover.'));
              return;
            }
            clearBotData(message.botId)
              .then(() => respond(respondOk({ ok: true })))
              .catch((error) =>
                respond(respondErr(ErrorCode.INTERNAL, 'Falha ao remover bot.', String(error?.message ?? error))),
              );
          })
          .catch((error) =>
            respond(respondErr(ErrorCode.INTERNAL, 'Falha ao remover bot.', String(error?.message ?? error))),
          );
      });
      return true;
    }
    case MessageType.TOGGLE_PIN: {
      initPromise.then(() => {
        if (!message?.botId) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'botId obrigatório.'));
          return;
        }
        const nextPinned = Boolean(message?.pinned);
        getMeta(message.botId)
          .then((meta) => {
            const updated = { ...(meta || { botId: message.botId }), botId: message.botId, pinned: nextPinned };
            return saveMeta(updated);
          })
          .then(() => respond(respondOk({ ok: true })))
          .catch((error) =>
            respond(respondErr(ErrorCode.INTERNAL, 'Falha ao atualizar bot.', String(error?.message ?? error))),
          );
      });
      return true;
    }
    case MessageType.OPEN_URL_CURRENT_TAB: {
      initPromise.then(async () => {
        const { url } = message;
        if (!url) {
          respond(respondErr(ErrorCode.INVALID_REQUEST, 'URL ausente.'));
          return;
        }
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tabs?.length || !tabs[0].id) {
            respond(respondErr(ErrorCode.NOT_FOUND, 'Aba ativa não encontrada.'));
            return;
          }
          await chrome.tabs.update(tabs[0].id, { url });
          respond(respondOk({ ok: true }));
        } catch (error) {
          respond(respondErr(ErrorCode.INTERNAL, 'Falha ao abrir URL.', String(error?.message ?? error)));
        }
      });
      return true;
    }
    default:
      return false;
  }
});
