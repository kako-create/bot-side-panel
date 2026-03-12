import { callBG, MessageType } from '../../services/messaging.js';
import { getMeta, searchFullItems } from '../../data/db.js';
import { safeGet } from '../../services/storage.js';
import {
  fetchBuilderPendingPage,
  fetchBuilderTrackingDetails,
} from '../../services/apiClient.js';
import {
  buildPendingItemIndex,
  countPendingActionGroups,
  groupPendingChangesByUserAndAction,
} from './alteracoes/helpers.js';
import {
  appendDiffContent,
  buildKeyDiff,
  parseMaybeJson,
  renderDiffValue,
} from './alteracoes/diffUtils.js';

const TEMPLATE_ID = 'tpl-screen-alteracoes';
const AUTH_SESSION_KEY = 'bot_sp_auth_v1';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';

const createInitialState = () => ({
  botId: null,
  mode: null,
  hasAuth: false,
  authorization: null,
  loading: false,
  error: null,
  meta: null,
  groupedChanges: [],
  totalDocs: 0,
  lastLoadedAt: null,
  openUsers: {},
  openActions: {},
});

let rootEl = null;
let state = createInitialState();
let els = {};
let disposed = false;
let cleanupFns = [];
let activeLoadController = null;

const on = (target, event, handler, options) => {
  if (!target) return;
  target.addEventListener(event, handler, options);
  cleanupFns.push(() => target.removeEventListener(event, handler, options));
};

const setText = (el, value) => {
  if (el) el.textContent = value ?? '';
};

const setHidden = (el, hidden) => {
  if (!el) return;
  if (hidden) el.setAttribute('hidden', 'true');
  else el.removeAttribute('hidden');
};

const setLight = (el, color) => {
  if (!el) return;
  el.classList.remove('semaforo--red', 'semaforo--yellow', 'semaforo--green');
  if (color) el.classList.add(`semaforo--${color}`);
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const normalizeMode = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const isBotMode = () => normalizeMode(state.mode) === MODE_BOT;

const clearActiveLoad = () => {
  if (!activeLoadController) return;
  try {
    activeLoadController.abort();
  } catch {
    // ignorar
  }
  activeLoadController = null;
};

const clearPendingData = () => {
  clearActiveLoad();
  state.loading = false;
  state.groupedChanges = [];
  state.totalDocs = 0;
  state.lastLoadedAt = null;
  state.error = null;
  state.openUsers = {};
  state.openActions = {};
};

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  return {
    light: q('#alteracoes-light'),
    bot: q('#alteracoes-bot'),
    auth: q('#alteracoes-auth'),
    sync: q('#alteracoes-sync'),
    total: q('#alteracoes-total'),
    users: q('#alteracoes-users'),
    actions: q('#alteracoes-actions'),
    lastUpdate: q('#alteracoes-last-update'),
    refreshBtn: q('#alteracoes-refresh'),
    groupsToggleBtn: q('#alteracoes-groups-toggle'),
    feedback: q('#alteracoes-feedback'),
    results: q('#alteracoes-results'),
  };
};

const appendMessage = (target, text, className = 'muted') => {
  if (!target) return;
  const message = document.createElement('div');
  message.className = className;
  message.textContent = text;
  target.appendChild(message);
};

const getBotLabel = () => {
  if (!state.botId) return '-';
  const title = String(state.meta?.botTitle ?? '').trim();
  return title ? `${title} (${state.botId})` : state.botId;
};

const getFeedbackState = () => {
  if (!state.botId) {
    return {
      kind: 'info',
      text: 'Selecione um bot no Boteria para consultar as alterações pendentes.',
    };
  }
  if (!isBotMode()) {
    return {
      kind: 'error',
      text: 'Esta tela está disponível apenas para BOT.',
    };
  }
  if (!state.hasAuth) {
    return {
      kind: 'error',
      text: 'Token expirado ou ausente. Recarregue o builder do Boteria e tente novamente.',
    };
  }
  if (!state.authorization) {
    return {
      kind: 'error',
      text: 'Token não disponível no painel. Recarregue a extensão e o builder do Boteria.',
    };
  }
  if (state.loading) {
    return {
      kind: 'info',
      text: 'Carregando alterações pendentes...',
    };
  }
  if (state.error) {
    return {
      kind: 'error',
      text: state.error,
    };
  }
  if (!state.meta?.lastItemsSyncAt) {
    return {
      kind: 'info',
      text: 'Sem full sync local. Alguns títulos podem aparecer genéricos.',
    };
  }
  if (state.lastLoadedAt && state.totalDocs === 0) {
    return {
      kind: 'success',
      text: `Nenhuma alteração pendente encontrada. Leitura mais recente: ${formatDate(state.lastLoadedAt)}.`,
    };
  }
  if (state.lastLoadedAt) {
    return {
      kind: 'success',
      text: `Leitura mais recente: ${formatDate(state.lastLoadedAt)}.`,
    };
  }
  return {
    kind: 'info',
    text: 'Pronto para consultar as alterações pendentes.',
  };
};

const renderFeedback = () => {
  if (!els.feedback) return;
  const { kind, text } = getFeedbackState();
  els.feedback.className = 'settings-feedback';
  els.feedback.classList.add(
    kind === 'error'
      ? 'settings-feedback--error'
      : kind === 'success'
        ? 'settings-feedback--success'
        : 'settings-feedback--info',
  );
  setText(els.feedback, text);
  setHidden(els.feedback, !text);
};

const updateHeader = () => {
  setText(els.bot, getBotLabel());
  setText(els.auth, state.hasAuth ? 'ok' : 'ausente');
  setText(els.sync, formatDate(state.meta?.lastItemsSyncAt));
};

const updateStats = () => {
  setText(els.total, String(Number(state.totalDocs) || 0));
  setText(els.users, String(Array.isArray(state.groupedChanges) ? state.groupedChanges.length : 0));
  setText(els.actions, String(countPendingActionGroups(state.groupedChanges)));
  setText(els.lastUpdate, state.lastLoadedAt ? formatDate(state.lastLoadedAt) : '-');
};

const areAllGroupsOpen = () => {
  const users = Array.isArray(state.groupedChanges) ? state.groupedChanges : [];
  if (!users.length) return false;
  for (const userGroup of users) {
    if (state.openUsers[userGroup.key] === false) return false;
    for (const actionGroup of userGroup.actions ?? []) {
      if (state.openActions[actionGroup.key] === false) return false;
    }
  }
  return true;
};

const updateControls = () => {
  if (els.refreshBtn) {
    els.refreshBtn.disabled =
      !state.botId || !state.hasAuth || !state.authorization || !isBotMode() || state.loading;
    els.refreshBtn.textContent = state.loading ? 'Atualizando...' : 'Atualizar';
  }
  if (els.groupsToggleBtn) {
    const hasGroups = Array.isArray(state.groupedChanges) && state.groupedChanges.length > 0;
    els.groupsToggleBtn.disabled = !hasGroups || state.loading;
    els.groupsToggleBtn.textContent = areAllGroupsOpen() ? 'Fechar grupos' : 'Abrir grupos';
  }

  if (!state.botId || !isBotMode() || !state.hasAuth || !state.authorization) {
    setLight(els.light, 'red');
    return;
  }
  if (state.loading) {
    setLight(els.light, 'yellow');
    return;
  }
  if (state.error) {
    setLight(els.light, 'red');
    return;
  }
  if (state.lastLoadedAt) {
    setLight(els.light, 'green');
    return;
  }
  setLight(els.light, 'yellow');
};

const ensureGroupState = () => {
  const nextUsers = {};
  const nextActions = {};

  (Array.isArray(state.groupedChanges) ? state.groupedChanges : []).forEach((userGroup) => {
    nextUsers[userGroup.key] = state.openUsers[userGroup.key] ?? true;
    (userGroup.actions ?? []).forEach((actionGroup) => {
      nextActions[actionGroup.key] = state.openActions[actionGroup.key] ?? true;
    });
  });

  state.openUsers = nextUsers;
  state.openActions = nextActions;
};

const setAllGroupsOpen = (open) => {
  (Array.isArray(state.groupedChanges) ? state.groupedChanges : []).forEach((userGroup) => {
    state.openUsers[userGroup.key] = open;
    (userGroup.actions ?? []).forEach((actionGroup) => {
      state.openActions[actionGroup.key] = open;
    });
  });
  renderResults();
};

const bindToggleHeader = (header, toggle) => {
  if (!header) return;
  header.setAttribute('role', 'button');
  header.tabIndex = 0;
  header.addEventListener('click', toggle);
  header.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  });
};

const toMetaLine = (doc) => {
  const parts = [];
  if (doc.updatedAt) parts.push(formatDate(doc.updatedAt));
  if (doc.id) parts.push(doc.id);
  return parts.join(' · ');
};

const getActionTone = (action) => {
  const raw = String(action ?? '').trim().toLowerCase();
  if (raw === 'insert') return 'insert';
  if (raw === 'update') return 'update';
  if (raw === 'delete') return 'delete';
  return 'neutral';
};

const stringifyDiffValue = (value) => {
  if (value === undefined) return 'undefined';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const renderDetailPanel = (detailPanel, payload) => {
  detailPanel.innerHTML = '';
  if (!payload || typeof payload !== 'object') {
    detailPanel.textContent = 'Detalhes indisponíveis.';
    return;
  }

  const header = document.createElement('div');
  header.className = 'alteracao-detail-panel-header';
  header.textContent = payload.updateTarget
    ? `Alteração em ${payload.updateTarget}`
    : 'Detalhes da alteração';
  detailPanel.appendChild(header);

  const diff = payload.diff ?? {};
  const parsedOld = parseMaybeJson(diff.old ?? undefined);
  const parsedNew = parseMaybeJson(diff.new ?? undefined);
  const changes =
    parsedOld.ok && parsedNew.ok
      ? buildKeyDiff(parsedOld.value, parsedNew.value)
      : buildKeyDiff(parsedOld.ok ? parsedOld.value : undefined, parsedNew.ok ? parsedNew.value : undefined);

  if (changes.length > 0) {
    const changesList = document.createElement('div');
    changesList.className = 'alteracao-detail-changes';

    changes.forEach((change) => {
      const row = document.createElement('div');
      row.className = `alteracao-detail-change ${change.type}`;

      const key = document.createElement('strong');
      key.textContent = change.key;

      const values = document.createElement('div');
      values.className = 'alteracao-detail-change-values';

      const oldValue = document.createElement('span');
      oldValue.className = 'alteracao-detail-change-old';
      oldValue.textContent = change.type === 'added' ? '∅' : stringifyDiffValue(change.oldValue);

      const arrow = document.createElement('span');
      arrow.textContent = '->';

      const newValue = document.createElement('span');
      newValue.className = 'alteracao-detail-change-new';
      newValue.textContent = change.type === 'removed' ? '∅' : stringifyDiffValue(change.newValue);

      values.append(oldValue, arrow, newValue);
      row.append(key, values);
      changesList.appendChild(row);
    });

    detailPanel.appendChild(changesList);
  }

  const oldText = diff.old !== undefined ? renderDiffValue(diff.old ?? '') : '';
  const newText = diff.new !== undefined ? renderDiffValue(diff.new ?? '') : '';

  if (diff.old !== undefined || diff.new !== undefined) {
    const diffContainer = document.createElement('div');
    diffContainer.className = 'alteracao-detail-diff';

    if (diff.old !== undefined) {
      const oldBox = document.createElement('div');
      oldBox.className = 'alteracao-detail-diff-box';

      const oldTitle = document.createElement('span');
      oldTitle.textContent = 'Antes';

      const oldPre = document.createElement('pre');
      appendDiffContent(oldPre, oldText, 'old', diff.new !== undefined ? newText : null);

      oldBox.append(oldTitle, oldPre);
      diffContainer.appendChild(oldBox);
    }

    if (diff.new !== undefined) {
      const newBox = document.createElement('div');
      newBox.className = 'alteracao-detail-diff-box';

      const newTitle = document.createElement('span');
      newTitle.textContent = 'Depois';

      const newPre = document.createElement('pre');
      appendDiffContent(newPre, newText, 'new', diff.old !== undefined ? oldText : null);

      newBox.append(newTitle, newPre);
      diffContainer.appendChild(newBox);
    }

    detailPanel.appendChild(diffContainer);
  }
};

const loadChangeDetails = async (doc, detailPanel, button) => {
  if (!detailPanel || !doc?.apiId || !state.botId) return;
  if (!state.hasAuth || !state.authorization) {
    detailPanel.textContent = 'Sem autorização disponível para carregar os detalhes.';
    return;
  }
  detailPanel.textContent = 'Carregando detalhes...';

  try {
    const payload = await fetchBuilderTrackingDetails(
      state.botId,
      doc.apiId,
      state.authorization,
    );
    if (disposed) return;
    renderDetailPanel(detailPanel, payload);
    detailPanel.dataset.loaded = 'true';
    if (button) button.textContent = 'Ocultar';
  } catch (error) {
    const status = Number(error?.status ?? 0);
    detailPanel.textContent =
      status === 401 || status === 419
        ? 'Token expirado. Recarregue o builder do Boteria e tente novamente.'
        : `Falha ao carregar detalhes: ${String(error?.message ?? error)}`;
  }
};

const buildChangeRow = (doc) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'pending-change-entry';

  const row = document.createElement('div');
  row.className = 'list-item';

  const info = document.createElement('div');
  info.className = 'alteracao-detail-info';

  const title = document.createElement('div');
  title.className = 'alteracao-detail-title';
  title.textContent = doc.title || 'Sem título';
  info.appendChild(title);

  if (doc.description) {
    const description = document.createElement('div');
    description.className = 'alteracao-detail-description';
    description.textContent = doc.description;
    info.appendChild(description);
  }

  const meta = document.createElement('div');
  meta.className = 'alteracao-detail-meta';
  meta.textContent = toMetaLine(doc);
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'alteracao-detail-actions';

  if (doc.type) {
    const typeBadge = document.createElement('span');
    typeBadge.className = 'pending-change-type';
    typeBadge.textContent = doc.type;
    actions.appendChild(typeBadge);
  }

  const detailPanel = document.createElement('div');
  detailPanel.className = 'alteracao-detail-panel';
  detailPanel.hidden = true;

  if (doc.apiId) {
    const detailsBtn = document.createElement('button');
    detailsBtn.className = 'btn btn--ghost btn--sm';
    detailsBtn.type = 'button';
    detailsBtn.textContent = 'Detalhes';
    detailsBtn.addEventListener('click', async () => {
      const shouldOpen = detailPanel.hidden;
      detailPanel.hidden = !detailPanel.hidden;
      detailsBtn.textContent = detailPanel.hidden ? 'Detalhes' : 'Ocultar';
      if (shouldOpen && detailPanel.dataset.loaded !== 'true') {
        await loadChangeDetails(doc, detailPanel, detailsBtn);
      }
    });
    actions.appendChild(detailsBtn);
  }

  row.append(info, actions);
  wrapper.append(row, detailPanel);
  return wrapper;
};

const renderResults = () => {
  if (!els.results) return;
  els.results.innerHTML = '';

  if (!state.botId) {
    appendMessage(els.results, 'Selecione um bot no Boteria para consultar as alterações.');
    updateControls();
    return;
  }

  if (!isBotMode()) {
    appendMessage(els.results, 'As alterações pendentes são exibidas apenas para BOT.');
    updateControls();
    return;
  }

  if (!state.hasAuth) {
    appendMessage(els.results, 'Token expirado ou ausente. Recarregue o builder do Boteria.');
    updateControls();
    return;
  }

  if (state.loading && (!state.groupedChanges || state.groupedChanges.length === 0)) {
    appendMessage(els.results, 'Carregando alterações pendentes...');
    updateControls();
    return;
  }

  if (state.error && (!state.groupedChanges || state.groupedChanges.length === 0)) {
    appendMessage(els.results, state.error);
    updateControls();
    return;
  }

  if (!state.groupedChanges || state.groupedChanges.length === 0) {
    appendMessage(
      els.results,
      state.lastLoadedAt
        ? 'Nenhuma alteração pendente encontrada.'
        : 'Clique em "Atualizar" para consultar as alterações pendentes.',
    );
    updateControls();
    return;
  }

  state.groupedChanges.forEach((userGroup) => {
    const userWrapper = document.createElement('div');
    userWrapper.className = 'search-group';

    const userHeader = document.createElement('div');
    userHeader.className = 'search-group-header';

    const userHead = document.createElement('div');
    userHead.className = 'pending-group-head';

    const userToggle = document.createElement('span');
    userToggle.className = 'pending-group-toggle';
    userToggle.textContent = state.openUsers[userGroup.key] === false ? '▶' : '▼';

    const userTitle = document.createElement('span');
    userTitle.className = 'pending-group-title';
    userTitle.textContent = userGroup.userName;

    userHead.append(userToggle, userTitle);

    const userMeta = document.createElement('span');
    userMeta.className = 'pending-group-meta';
    userMeta.textContent = `${userGroup.count} alterações`;

    userHeader.append(userHead, userMeta);

    const userContent = document.createElement('div');
    userContent.className = 'search-group-content pending-group-content';
    setHidden(userContent, state.openUsers[userGroup.key] === false);

    bindToggleHeader(userHeader, () => {
      const nextOpen = !(state.openUsers[userGroup.key] === false);
      state.openUsers[userGroup.key] = !nextOpen;
      setHidden(userContent, nextOpen);
      userToggle.textContent = nextOpen ? '▶' : '▼';
      updateControls();
    });

    (userGroup.actions ?? []).forEach((actionGroup) => {
      const actionWrapper = document.createElement('div');
      actionWrapper.className = 'search-group pending-action-group';

      const actionHeader = document.createElement('div');
      actionHeader.className = 'search-group-header pending-action-group-header';

      const actionHead = document.createElement('div');
      actionHead.className = 'pending-group-head';

      const actionToggle = document.createElement('span');
      actionToggle.className = 'pending-group-toggle';
      actionToggle.textContent = state.openActions[actionGroup.key] === false ? '▶' : '▼';

      const actionBadge = document.createElement('span');
      actionBadge.className = `pending-action-badge pending-action-badge--${getActionTone(actionGroup.action)}`;
      actionBadge.textContent = actionGroup.action;

      actionHead.append(actionToggle, actionBadge);

      const actionMeta = document.createElement('span');
      actionMeta.className = 'pending-group-meta';
      actionMeta.textContent = `${actionGroup.count} itens`;

      actionHeader.append(actionHead, actionMeta);

      const actionContent = document.createElement('div');
      actionContent.className = 'search-group-content pending-action-group-content';
      setHidden(actionContent, state.openActions[actionGroup.key] === false);

      bindToggleHeader(actionHeader, () => {
        const nextOpen = !(state.openActions[actionGroup.key] === false);
        state.openActions[actionGroup.key] = !nextOpen;
        setHidden(actionContent, nextOpen);
        actionToggle.textContent = nextOpen ? '▶' : '▼';
        updateControls();
      });

      (actionGroup.docs ?? []).forEach((doc) => {
        actionContent.appendChild(buildChangeRow(doc));
      });

      actionWrapper.append(actionHeader, actionContent);
      userContent.appendChild(actionWrapper);
    });

    userWrapper.append(userHeader, userContent);
    els.results.appendChild(userWrapper);
  });

  updateControls();
};

const loadMeta = async () => {
  if (!state.botId) {
    state.meta = null;
    return;
  }
  try {
    state.meta = await getMeta(state.botId);
  } catch {
    state.meta = null;
  }
};

const loadAuthorization = async () => {
  const response = await safeGet('session', [AUTH_SESSION_KEY]);
  if (!response.ok) return null;
  const session = response.data?.[AUTH_SESSION_KEY] ?? null;
  const authorization = String(session?.authorization ?? '').trim();
  return authorization || null;
};

const formatFetchError = (error) => {
  const status = Number(error?.status ?? 0);
  if (status === 401 || status === 419) {
    return 'Token expirado. Recarregue o builder do Boteria e tente novamente.';
  }
  return `Erro ao consultar alterações: ${String(error?.message ?? error)}`;
};

const refreshPendingChanges = async () => {
  if (!state.botId || !isBotMode() || !state.hasAuth || !state.authorization || state.loading) {
    updateControls();
    renderFeedback();
    return;
  }

  clearActiveLoad();
  const controller = new AbortController();
  activeLoadController = controller;
  state.loading = true;
  state.error = null;
  renderFeedback();
  updateControls();
  if (!state.groupedChanges.length) renderResults();

  try {
    const firstPage = await fetchBuilderPendingPage(state.botId, state.authorization, {
      signal: controller.signal,
    });
    if (disposed || controller.signal.aborted) return;

    let allDocs = Array.isArray(firstPage?.docs) ? [...firstPage.docs] : [];
    const totalDocs =
      typeof firstPage?.totalDocs === 'number' ? firstPage.totalDocs : allDocs.length;
    const totalPages =
      typeof firstPage?.totalPages === 'number'
        ? firstPage.totalPages
        : typeof firstPage?.limit === 'number' && totalDocs > 0
          ? Math.ceil(totalDocs / firstPage.limit)
          : 1;

    if (firstPage?.hasNextPage === true || totalPages > 1) {
      for (let page = 2; page <= Math.max(1, totalPages); page += 1) {
        const nextPage = await fetchBuilderPendingPage(state.botId, state.authorization, {
          page,
          signal: controller.signal,
        });
        if (disposed || controller.signal.aborted) return;
        if (Array.isArray(nextPage?.docs) && nextPage.docs.length > 0) {
          allDocs = allDocs.concat(nextPage.docs);
        }
        if (nextPage?.hasNextPage === false) break;
      }
    }

    let itemIndex = new Map();
    if (state.meta?.lastItemsSyncAt) {
      const fullItems = await searchFullItems(state.botId, { limit: 0 });
      if (disposed || controller.signal.aborted) return;
      itemIndex = buildPendingItemIndex(fullItems);
    }

    state.groupedChanges = groupPendingChangesByUserAndAction(allDocs, itemIndex);
    state.totalDocs = typeof totalDocs === 'number' ? totalDocs : allDocs.length;
    state.lastLoadedAt = new Date().toISOString();
    state.error = null;
    ensureGroupState();
    renderResults();
  } catch (error) {
    if (disposed || controller.signal.aborted) return;
    state.error = formatFetchError(error);
    if (!state.groupedChanges.length) renderResults();
  } finally {
    const isCurrentController = activeLoadController === controller;
    if (isCurrentController) activeLoadController = null;
    if (!isCurrentController || disposed) return;
    state.loading = false;
    updateHeader();
    updateStats();
    renderFeedback();
    updateControls();
  }
};

const loadContext = async ({ autoRefresh = false } = {}) => {
  const prevBotId = state.botId;
  const prevMode = normalizeMode(state.mode);
  const prevHasAuth = state.hasAuth;

  const response = await callBG(MessageType.GET_CONTEXT, { includeAuth: true });
  if (disposed) return;
  if (!response.ok || !response.data?.context) return;

  state.botId = response.data.context.botId ?? null;
  state.mode = normalizeMode(response.data.context.mode);
  state.hasAuth = Boolean(response.data.hasAuth);
  state.authorization = await loadAuthorization();

  const botChanged = state.botId !== prevBotId;
  const modeChanged = normalizeMode(state.mode) !== prevMode;
  const authBecameAvailable = !prevHasAuth && state.hasAuth;

  if (!state.botId || !isBotMode()) {
    if (botChanged || modeChanged) {
      clearPendingData();
      renderResults();
    }
    await loadMeta();
    updateHeader();
    updateStats();
    renderFeedback();
    updateControls();
    return;
  }

  await loadMeta();
  if (botChanged || modeChanged) {
    clearPendingData();
    renderResults();
  }

  updateHeader();
  updateStats();
  renderFeedback();
  updateControls();

  if (!autoRefresh) return;

  const shouldRefresh =
    botChanged ||
    modeChanged ||
    authBecameAvailable ||
    (!state.lastLoadedAt && !state.loading && !state.groupedChanges.length && !state.error);

  if (shouldRefresh) {
    await refreshPendingChanges();
  }
};

const init = async () => {
  if (els.refreshBtn) on(els.refreshBtn, 'click', () => refreshPendingChanges());
  if (els.groupsToggleBtn) {
    on(els.groupsToggleBtn, 'click', () => {
      setAllGroupsOpen(!areAllGroupsOpen());
    });
  }

  renderResults();
  renderFeedback();
  updateControls();

  await loadContext({ autoRefresh: true });

  const onMessage = (message) => {
    if (disposed) return;
    if (message?.type === MessageType.CONTEXT_CHANGED) {
      loadContext({ autoRefresh: true });
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  cleanupFns.push(() => chrome.runtime.onMessage.removeListener(onMessage));

  const intervalId = setInterval(() => loadContext({ autoRefresh: false }), 2000);
  cleanupFns.push(() => clearInterval(intervalId));
};

export const screenAlteracoes = {
  id: 'alteracoes',
  title: 'Alterações pendentes',
  modes: ['bot'],
  mount: async ({ root }) => {
    disposed = false;
    cleanupFns = [];
    state = createInitialState();
    rootEl = root;

    const template = document.getElementById(TEMPLATE_ID);
    if (!template) {
      throw new Error(`Template "${TEMPLATE_ID}" não encontrado em panel.html`);
    }

    root.innerHTML = '';
    root.appendChild(template.content.cloneNode(true));
    els = initEls();

    await init();

    return () => {
      disposed = true;
      clearPendingData();
      const fns = cleanupFns.slice();
      cleanupFns = [];
      fns.reverse().forEach((fn) => {
        try {
          fn();
        } catch {
          // ignorar
        }
      });
      if (rootEl) rootEl.innerHTML = '';
      els = {};
      rootEl = null;
      state = createInitialState();
    };
  },
};
