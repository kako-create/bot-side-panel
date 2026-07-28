import { callBG, MessageType } from '../../services/messaging.js';
import {
  getGroupsByBot,
  getMeta,
  listBotTags,
  listBotVariables,
  listFlowConnectors,
  searchFullItems,
} from '../../data/db.js';
import {
  buildFlowJsonSnapshot,
  downloadFlowJsonSnapshot,
} from '../services/flowJsonExport.js';

const TEMPLATE_ID = 'tpl-screen-exportacao';

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('pt-BR');
};

const createState = () => ({
  botId: null,
  hasAuth: false,
  meta: null,
  groups: [],
  items: [],
  connectors: [],
  variables: [],
  tags: [],
  loading: false,
  syncing: false,
  exporting: false,
  feedback: '',
  feedbackKind: 'info',
});

let rootEl = null;
let state = createState();
let els = {};
let disposed = false;
let cleanupFns = [];

const q = (selector) => rootEl?.querySelector(selector) ?? null;
const setText = (element, value) => {
  if (element) element.textContent = value ?? '';
};
const on = (target, event, handler) => {
  if (!target) return;
  target.addEventListener(event, handler);
  cleanupFns.push(() => target.removeEventListener(event, handler));
};

const initEls = () => ({
  light: q('#export-light'),
  bot: q('#export-bot'),
  itemsStatus: q('#export-items-status'),
  connectorsStatus: q('#export-connectors-status'),
  itemsCount: q('#export-items-count'),
  connectorsCount: q('#export-connectors-count'),
  scopesCount: q('#export-scopes-count'),
  syncConnectors: q('#export-sync-connectors'),
  exportJson: q('#export-json'),
  feedback: q('#export-feedback'),
});

const connectorsAreCurrent = () =>
  Boolean(state.meta?.lastConnectorsSyncAt) &&
  state.meta?.connectorsComplete === true &&
  String(state.meta?.connectorsForItemsSyncAt ?? '') ===
    String(state.meta?.lastItemsSyncAt ?? '');

const render = () => {
  const hasFullSync = Boolean(state.meta?.lastItemsSyncAt);
  const connectorsCurrent = connectorsAreCurrent();
  const busy = state.loading || state.syncing || state.exporting;

  setText(
    els.bot,
    state.botId
      ? state.meta?.botTitle
        ? `${state.meta.botTitle} (${state.botId})`
        : state.botId
      : '-',
  );
  setText(els.itemsStatus, formatDate(state.meta?.lastItemsSyncAt));
  setText(
    els.connectorsStatus,
    connectorsCurrent
      ? formatDate(state.meta?.lastConnectorsSyncAt)
      : state.meta?.lastConnectorsSyncAt
        ? state.meta?.connectorsComplete === false
          ? 'Incompletos'
          : 'Desatualizados'
        : '-',
  );
  setText(els.itemsCount, String(state.items.length));
  setText(els.connectorsCount, String(state.connectors.length));
  setText(
    els.scopesCount,
    String(Math.max(0, Number(state.meta?.connectorScopesCount ?? 0) - 1)),
  );

  if (els.light) {
    els.light.classList.remove('semaforo--red', 'semaforo--yellow', 'semaforo--green');
    els.light.classList.add(
      !hasFullSync ? 'semaforo--red' : connectorsCurrent ? 'semaforo--green' : 'semaforo--yellow',
    );
  }
  if (els.syncConnectors) {
    els.syncConnectors.disabled = busy || !state.botId || !state.hasAuth || !hasFullSync;
    els.syncConnectors.textContent = state.syncing
      ? 'Sincronizando...'
      : 'Sincronizar conectores';
  }
  if (els.exportJson) {
    els.exportJson.disabled = busy || !hasFullSync || !connectorsCurrent;
    els.exportJson.textContent = state.exporting ? 'Exportando...' : 'Exportar JSON';
    els.exportJson.title = !hasFullSync
      ? 'Execute a sincronização completa em Consulta & status.'
      : !connectorsCurrent
        ? 'Sincronize os conectores para a versão atual dos blocos.'
        : 'Exportar o fluxo completo com blocos e conectores.';
  }
  if (els.feedback) {
    els.feedback.hidden = !state.feedback;
    els.feedback.className = `settings-feedback settings-feedback--${state.feedbackKind}`;
    setText(els.feedback, state.feedback);
  }
};

const loadCachedData = async () => {
  if (!state.botId) {
    state.meta = null;
    state.groups = [];
    state.items = [];
    state.connectors = [];
    state.variables = [];
    state.tags = [];
    render();
    return;
  }
  const requestedBotId = String(state.botId);
  const results = await Promise.all([
    getMeta(requestedBotId),
    getGroupsByBot(requestedBotId),
    searchFullItems(requestedBotId, { limit: 0 }),
    listFlowConnectors(requestedBotId),
    listBotVariables(requestedBotId),
    listBotTags(requestedBotId),
  ]);
  if (disposed || String(state.botId ?? '') !== requestedBotId) return;
  [state.meta, state.groups, state.items, state.connectors, state.variables, state.tags] = results;
  render();
};

const loadContext = async () => {
  state.loading = true;
  render();
  try {
    const response = await callBG(MessageType.GET_CONTEXT);
    if (disposed) return;
    if (!response.ok) throw new Error(response.error?.message ?? 'Falha ao ler contexto.');
    const nextBotId = response.data?.context?.botId ?? null;
    const changed = String(nextBotId ?? '') !== String(state.botId ?? '');
    state.botId = nextBotId;
    state.hasAuth = Boolean(response.data?.hasAuth);
    if (changed) state.feedback = '';
    await loadCachedData();
  } catch (error) {
    state.feedbackKind = 'error';
    state.feedback = String(error?.message ?? error);
  } finally {
    state.loading = false;
    render();
  }
};

const syncConnectors = async () => {
  if (disposed || state.syncing || !state.botId) return;
  state.syncing = true;
  state.feedbackKind = 'info';
  state.feedback = 'Consultando conectores do fluxo principal e dos subfluxos...';
  render();
  try {
    const response = await callBG(MessageType.SYNC_FLOW_CONNECTORS, { botId: state.botId });
    if (!response.ok) {
      throw new Error(response.error?.details ?? response.error?.message ?? 'Falha na sincronização.');
    }
    await loadCachedData();
    const warnings = Array.isArray(response.data?.warnings) ? response.data.warnings.length : 0;
    state.feedbackKind = warnings ? 'error' : 'success';
    state.feedback = warnings
      ? `${response.data.connectorsCount} conectores sincronizados, com falha em ${warnings} subfluxo(s).`
      : `${response.data.connectorsCount} conectores sincronizados com sucesso.`;
  } catch (error) {
    state.feedbackKind = 'error';
    state.feedback = String(error?.message ?? error);
  } finally {
    state.syncing = false;
    render();
  }
};

const exportJson = async () => {
  if (disposed || state.exporting || !connectorsAreCurrent()) return;
  state.exporting = true;
  state.feedbackKind = 'info';
  state.feedback = 'Gerando JSON completo do fluxo...';
  render();
  try {
    await loadCachedData();
    if (!connectorsAreCurrent()) {
      throw new Error('Os conectores estão desatualizados. Sincronize-os novamente.');
    }
    const snapshot = buildFlowJsonSnapshot({
      meta: state.meta,
      groups: state.groups,
      items: state.items,
      connectors: state.connectors,
      variables: state.variables,
      tags: state.tags,
    });
    downloadFlowJsonSnapshot(snapshot);
    const subflowCount = Object.keys(snapshot.subflows).length;
    state.feedbackKind = 'success';
    state.feedback =
      `JSON exportado com ${state.items.length} blocos, ` +
      `${state.connectors.length} conectores e ${subflowCount} subfluxo(s).`;
  } catch (error) {
    state.feedbackKind = 'error';
    state.feedback = String(error?.message ?? error);
  } finally {
    state.exporting = false;
    render();
  }
};

const bindEvents = () => {
  on(els.syncConnectors, 'click', syncConnectors);
  on(els.exportJson, 'click', exportJson);
  const onMessage = (message) => {
    if (message?.type === MessageType.CONTEXT_CHANGED) loadContext();
    if (message?.type === MessageType.SYNC_STATUS && !message?.state?.running) loadCachedData();
  };
  chrome.runtime.onMessage.addListener(onMessage);
  cleanupFns.push(() => chrome.runtime.onMessage.removeListener(onMessage));
};

export const screenExportacao = {
  id: 'exportacao',
  title: 'Exportação',
  mount: async ({ root }) => {
    disposed = false;
    cleanupFns = [];
    state = createState();
    rootEl = root;
    const template = document.getElementById(TEMPLATE_ID);
    if (!template) throw new Error(`Template "${TEMPLATE_ID}" não encontrado em panel.html`);
    root.innerHTML = '';
    root.appendChild(template.content.cloneNode(true));
    els = initEls();
    bindEvents();
    await loadContext();
    return () => {
      disposed = true;
      cleanupFns.forEach((cleanup) => cleanup());
      cleanupFns = [];
      rootEl = null;
      els = {};
    };
  },
};
