import { AUTO_SYNC_ENABLED, AUTO_SYNC_FULL_ITEMS } from '../config/flags.js';
import { AUTH_SESSION_TTL_MS } from '../config/limits.js';
import { DEFAULT_MODE, resolveContextFromUrl, normalizeMode } from '../config/modeResolver.js';
import { MessageType, ErrorCode, respondOk, respondErr } from '../services/messaging.js';
import { safeGet, safeSet, safeRemove, mapStorageErrorCode } from '../services/storage.js';
import { listMetas, clearBotData, getMeta, saveMeta } from '../data/db.js';
import { startSync, getSyncState, cancelSync } from '../services/syncManager.js';
import { syncBotVariables } from '../services/variablesSync.js';
import { syncBotTags } from '../services/tagsSync.js';

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

let lastAutoSyncBotId = null;
let storageError = null;

const isAuthSessionValid = (sessionAuth) => {
  if (!sessionAuth?.authorization) return false;
  if (!sessionAuth?.expiresAt) return true;
  return new Date(sessionAuth.expiresAt).getTime() > Date.now();
};

const initState = async () => {
  const localResult = await safeGet('local', [CONTEXT_KEY]);
  if (localResult.ok && localResult.data?.[CONTEXT_KEY]) {
    const stored = localResult.data[CONTEXT_KEY];
    contextState = {
      botId: stored?.botId ?? null,
      mode: normalizeMode(stored?.mode),
      appBaseUrl: stored?.appBaseUrl ?? null,
      updatedAt: stored?.updatedAt ?? null,
    };
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
  if (!AUTO_SYNC_ENABLED) return;
  if (!contextState.botId || !authSessionState.authorization) return;
  if (contextState.botId === lastAutoSyncBotId) return;
  lastAutoSyncBotId = contextState.botId;
  try {
    await startSync({
      botId: contextState.botId,
      authorization: authSessionState.authorization,
      fullItems: AUTO_SYNC_FULL_ITEMS,
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
    case MessageType.GET_CONTEXT: {
      initPromise.then(() => {
        respond(
          respondOk({
            context: { ...contextState },
            hasAuth: Boolean(authSessionState.authorization),
            authUpdatedAt: authSessionState.updatedAt,
            storageError,
          }),
        );
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
      initPromise.then(() => {
        const requestedBotId = message?.botId ?? contextState.botId;
        const requestedMode = normalizeMode(message?.mode ?? contextState.mode);
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }
        syncBotVariables({
          botId: requestedBotId,
          authorization: authSessionState.authorization,
          mode: requestedMode,
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
      initPromise.then(() => {
        const requestedBotId = message?.botId ?? contextState.botId;
        if (!requestedBotId || !authSessionState.authorization) {
          respond(respondErr(ErrorCode.NOT_READY, 'botId ou token ausente.'));
          return;
        }
        syncBotTags({
          botId: requestedBotId,
          authorization: authSessionState.authorization,
          mode: contextState.mode,
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
