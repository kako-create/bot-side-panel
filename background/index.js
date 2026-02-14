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
import { fetchUraAiAgentFunctions } from '../services/apiClient.js';

const CONTEXT_KEY = 'bot_sp_context_v1';
const AUTH_SESSION_KEY = 'bot_sp_auth_v1';

let contextState = {
  botId: null,
  mode: DEFAULT_MODE,
  appBaseUrl: null,
  updatedAt: null,
};

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

const updateContextFromUrl = async (url) => {
  const { botId, mode, appBaseUrl } = resolveContextFromUrl(url);
  if (!botId && !mode) return false;
  const nextMode = normalizeMode(mode);
  const nextAppBaseUrl = appBaseUrl ?? null;
  const changed =
    botId !== contextState.botId ||
    nextMode !== contextState.mode ||
    nextAppBaseUrl !== (contextState.appBaseUrl ?? null);
  if (!changed) return false;
  contextState = {
    botId,
    mode: nextMode,
    appBaseUrl: nextAppBaseUrl,
    updatedAt: new Date().toISOString(),
  };
  await persistContextState();
  return true;
};

const resolveBotIdFromMessage = (message) => {
  const explicitBotId = String(message?.botId ?? '').trim();
  if (explicitBotId) return explicitBotId;
  const fromUrl = resolveContextFromUrl(message?.url).botId;
  if (fromUrl) return fromUrl;
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

    // Redact sensitive query params.
    for (const [key, value] of url.searchParams.entries()) {
      const k = String(key ?? '');
      const kFold = k.toLowerCase();
      const v = String(value ?? '');
      if (DEBUG_SENSITIVE_QUERY_KEYS.has(kFold) || DEBUG_SENSITIVE_QUERY_KEYS.has(k)) {
        url.searchParams.set(k, 'REDACTED');
        continue;
      }
      // Extra safeguard: if a value looks like a JWT, redact it.
      if (
        v.length > 30 &&
        /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(v)
      ) {
        url.searchParams.set(k, 'REDACTED');
      }
    }

    return absolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    // Best-effort fallback: redact obvious query params without parsing.
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

const broadcastStatus = (state) => {
  try {
    chrome.runtime.sendMessage({ type: MessageType.SYNC_STATUS, state }, () => {
      const err = chrome.runtime.lastError;
      if (err && !/receiving end does not exist/i.test(err.message)) {
        // ignore known no-receiver errors
      }
    });
  } catch {
    // ignore
  }
};

const triggerAutoSync = async () => {
  const settings = getUserSettingsState();
  if (!settings.autoSyncEnabled) return;
  if (!contextState.botId || !authSessionState.authorization) return;
  if (contextState.botId === lastAutoSyncBotId) return;
  lastAutoSyncBotId = contextState.botId;
  try {
    await startSync({
      botId: contextState.botId,
      authorization: authSessionState.authorization,
      fullItems: settings.autoSyncFullItems,
      onProgress: broadcastStatus,
    });
  } catch {
    // sync error already reported via status
  }
};

const initPromise = initState();

if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
        updateContextFromUrl(message.url).then((changed) => {
          if (changed) triggerAutoSync();
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

        const targetBotId = resolveBotIdFromMessage(message);
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
        if (contextState.mode !== MODE_URA) {
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
        let mode = contextState.mode;
        if (contextState.botId) {
          const syncedMode = await getSyncedMode(contextState.botId);
          if (syncedMode) mode = syncedMode;
        }
        respond(
          respondOk({
            context: { ...contextState, mode },
            hasAuth: Boolean(authSessionState.authorization),
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
    case MessageType.START_SYNC: {
      initPromise.then(() => {
        const requestedBotId = message?.botId ?? contextState.botId;
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
        const requestedBotId = message?.botId ?? contextState.botId;
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
        const requestedBotId = message?.botId ?? contextState.botId;
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
