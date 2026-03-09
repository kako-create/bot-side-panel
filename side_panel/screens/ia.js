import { callBG, MessageType } from '../../services/messaging.js';
import { getMeta, listBotIntents, listBotLexIntents } from '../../data/db.js';

const TEMPLATE_ID = 'tpl-screen-ia';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';

const createInitialState = () => ({
  botId: null,
  contextMode: null,
  hasAuth: false,
  syncingConditions: false,
  syncingLex: false,
  exportingConditions: false,
  exportingLex: false,
  lastConditionsError: null,
  lastLexError: null,
  meta: null,
  conditions: [],
  lexIntents: [],
  openConditionGroups: {},
  openLexGroups: {},
  collapsedSections: {
    status: false,
    conditions: false,
    lex: false,
  },
});

let rootEl = null;
let state = createInitialState();
let els = {};
let disposed = false;
let cleanupFns = [];

const on = (target, event, handler, options) => {
  if (!target) return;
  target.addEventListener(event, handler, options);
  cleanupFns.push(() => target.removeEventListener(event, handler, options));
};

const setText = (el, value) => {
  if (!el) return;
  el.textContent = value ?? '';
};

const setLight = (el, color) => {
  if (!el) return;
  el.classList.remove('semaforo--red', 'semaforo--yellow', 'semaforo--green');
  if (color) el.classList.add(`semaforo--${color}`);
};

const setHidden = (el, hidden) => {
  if (!el) return;
  if (hidden) el.setAttribute('hidden', 'true');
  else el.removeAttribute('hidden');
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

const sortByLabel = (items) =>
  (Array.isArray(items) ? items.slice() : []).sort((a, b) =>
    String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR'),
  );

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  const qa = (sel) => (rootEl ? Array.from(rootEl.querySelectorAll(sel)) : []);
  return {
    light: q('#ia-light'),
    bot: q('#ia-bot'),
    auth: q('#ia-auth'),
    status: q('#ia-status'),
    total: q('#ia-total'),
    lastSync: q('#ia-last-sync'),
    syncBtn: q('#ia-sync'),
    toggleGroupsBtn: q('#ia-groups-toggle'),
    exportBtn: q('#ia-export'),
    results: q('#ia-results'),
    lexStatus: q('#ia-lex-status'),
    lexTotalIntents: q('#ia-lex-total-intents'),
    lexTotalSamples: q('#ia-lex-total-samples'),
    lexLastSync: q('#ia-lex-last-sync'),
    lexSyncBtn: q('#ia-lex-sync'),
    lexToggleGroupsBtn: q('#ia-lex-groups-toggle'),
    lexExportBtn: q('#ia-lex-export'),
    lexResults: q('#ia-lex-results'),
    sectionToggles: qa('.section-toggle'),
  };
};

const getCanonicalMode = () => normalizeMode(state.contextMode);

const isBusy = () =>
  state.syncingConditions || state.syncingLex || state.exportingConditions || state.exportingLex;

const getConditionsStatusInfo = () => {
  const hasBotAndAuth = Boolean(state.botId) && Boolean(state.hasAuth);
  const mode = getCanonicalMode();

  if (!hasBotAndAuth) return { text: 'Aguardando bot/token', color: 'red' };
  if (mode !== MODE_BOT) return { text: 'Disponível apenas no mode BOT.', color: 'red' };
  if (state.syncingConditions) return { text: 'Sincronizando...', color: 'yellow' };
  if (state.lastConditionsError) return { text: `Erro: ${state.lastConditionsError}`, color: 'red' };
  if (state.meta?.lastIntentsSyncAt) return { text: 'OK', color: 'green' };
  return { text: 'Pronto para sincronizar', color: 'red' };
};

const getLexStatusInfo = () => {
  if (!state.botId) return { text: 'Aguardando bot', color: 'red' };
  if (getCanonicalMode() !== MODE_BOT) return { text: 'Disponível apenas no mode BOT.', color: 'red' };
  if (state.syncingLex) return { text: 'Sincronizando...', color: 'yellow' };
  if (state.lastLexError) return { text: `Erro: ${state.lastLexError}`, color: 'red' };
  if (state.meta?.lastLexIntentsSyncAt) return { text: 'OK', color: 'green' };
  return { text: 'Pronto para sincronizar', color: 'red' };
};

const getOverallLightColor = () => {
  if (!state.botId || getCanonicalMode() !== MODE_BOT) return 'red';
  if (state.syncingConditions || state.syncingLex) return 'yellow';
  if (state.lastConditionsError || state.lastLexError) return 'red';

  const conditionsSynced = Boolean(state.meta?.lastIntentsSyncAt);
  const lexSynced = Boolean(state.meta?.lastLexIntentsSyncAt);

  if (conditionsSynced && lexSynced) return 'green';
  if (conditionsSynced || lexSynced) return 'yellow';
  return 'red';
};

const updateHeader = () => {
  const title = state.meta?.botTitle;
  if (!state.botId) setText(els.bot, '-');
  else if (title) setText(els.bot, `${title} (${state.botId})`);
  else setText(els.bot, state.botId);
  setText(els.auth, state.hasAuth ? 'ok' : 'ausente');
};

const updateConditionsStatus = () => {
  setText(els.status, getConditionsStatusInfo().text);
  setLight(els.light, getOverallLightColor());
};

const updateConditionsStats = () => {
  setText(els.total, String(Array.isArray(state.conditions) ? state.conditions.length : 0));
  setText(els.lastSync, formatDate(state.meta?.lastIntentsSyncAt));
};

const updateConditionsSyncButton = () => {
  if (!els.syncBtn) return;
  const ready = Boolean(state.botId) && Boolean(state.hasAuth) && getCanonicalMode() === MODE_BOT && !isBusy();
  els.syncBtn.disabled = !ready;
  els.syncBtn.textContent = 'Sinc Condições';
};

const updateConditionsExportButton = () => {
  if (!els.exportBtn) return;
  const hasItems = Array.isArray(state.conditions) && state.conditions.length > 0;
  const ready = Boolean(state.botId) && getCanonicalMode() === MODE_BOT && hasItems && !isBusy();
  els.exportBtn.disabled = !ready;
  els.exportBtn.textContent = state.exportingConditions ? 'Exportando...' : 'Exportar';
};

const buildConditionGroups = (records) => {
  const grouped = new Map();
  records.forEach((rec) => {
    const key = String(rec?.group ?? rec?.groupLabel ?? 'Sem destino').trim() || 'Sem destino';
    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        title: String(rec?.groupLabel ?? 'Sem destino').trim() || 'Sem destino',
        type: String(rec?.type ?? '').trim(),
        items: [],
      });
    }
    grouped.get(key).items.push(rec);
  });

  const groups = Array.from(grouped.values());
  groups.sort((a, b) => {
    const titleDiff = a.title.localeCompare(b.title, 'pt-BR');
    if (titleDiff !== 0) return titleDiff;
    return String(a.type).localeCompare(String(b.type), 'pt-BR');
  });
  groups.forEach((group) => {
    group.items.sort((a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR'));
  });
  return groups;
};

const getCurrentConditionGroups = () => buildConditionGroups(Array.isArray(state.conditions) ? state.conditions : []);

const areAllConditionGroupsOpen = (groups = getCurrentConditionGroups()) =>
  groups.length > 0 && groups.every((group) => state.openConditionGroups[group.key] !== false);

const updateConditionGroupsToggleButton = () => {
  if (!els.toggleGroupsBtn) return;
  const groups = getCurrentConditionGroups();
  const ready = groups.length > 0 && !isBusy();
  els.toggleGroupsBtn.disabled = !ready;
  els.toggleGroupsBtn.textContent = areAllConditionGroupsOpen(groups) ? 'Fechar grupos' : 'Abrir grupos';
};

const getLexTotalSamples = () =>
  (Array.isArray(state.lexIntents) ? state.lexIntents : []).reduce(
    (acc, item) => acc + Number(item?.samplesCount ?? (Array.isArray(item?.samples) ? item.samples.length : 0)),
    0,
  );

const updateLexStatus = () => {
  setText(els.lexStatus, getLexStatusInfo().text);
  setLight(els.light, getOverallLightColor());
};

const updateLexStats = () => {
  setText(els.lexTotalIntents, String(Array.isArray(state.lexIntents) ? state.lexIntents.length : 0));
  setText(els.lexTotalSamples, String(getLexTotalSamples()));
  setText(els.lexLastSync, formatDate(state.meta?.lastLexIntentsSyncAt));
};

const updateLexSyncButton = () => {
  if (!els.lexSyncBtn) return;
  const ready = Boolean(state.botId) && getCanonicalMode() === MODE_BOT && !isBusy();
  els.lexSyncBtn.disabled = !ready;
  els.lexSyncBtn.textContent = 'Sinc Intenções';
};

const updateLexExportButton = () => {
  if (!els.lexExportBtn) return;
  const hasItems = Array.isArray(state.lexIntents) && state.lexIntents.length > 0;
  const ready = Boolean(state.botId) && getCanonicalMode() === MODE_BOT && hasItems && !isBusy();
  els.lexExportBtn.disabled = !ready;
  els.lexExportBtn.textContent = state.exportingLex ? 'Exportando...' : 'Exportar';
};

const getCurrentLexGroups = () => (Array.isArray(state.lexIntents) ? state.lexIntents : []);

const areAllLexGroupsOpen = (groups = getCurrentLexGroups()) =>
  groups.length > 0 && groups.every((group) => state.openLexGroups[group.intentId] === true);

const updateLexGroupsToggleButton = () => {
  if (!els.lexToggleGroupsBtn) return;
  const groups = getCurrentLexGroups();
  const ready = groups.length > 0 && !isBusy();
  els.lexToggleGroupsBtn.disabled = !ready;
  els.lexToggleGroupsBtn.textContent = areAllLexGroupsOpen(groups) ? 'Fechar grupos' : 'Abrir grupos';
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const sanitizeFileName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'bot';

const downloadExcelTable = (filename, header, rows) => {
  const tableRows = [header, ...rows]
    .map((cols) => `<tr>${cols.map((col) => `<td>${escapeHtml(col)}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <table>${tableRows}</table>
  </body>
</html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const onExportConditions = () => {
  if (disposed || isBusy()) return;
  if (getCanonicalMode() !== MODE_BOT) return;

  const items = Array.isArray(state.conditions) ? state.conditions.slice() : [];
  if (!items.length) return;

  state.exportingConditions = true;
  refreshUi();

  try {
    items.sort((a, b) => {
      const destinationDiff = String(a?.groupLabel ?? '').localeCompare(String(b?.groupLabel ?? ''), 'pt-BR');
      if (destinationDiff !== 0) return destinationDiff;
      return String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR');
    });

    const rows = items.map((item) => [
      item?.label ?? '',
      item?.groupLabel ?? '',
      item?.destinationId ?? '',
      item?.type ?? '',
      item?.active == null ? '' : item.active ? 'Sim' : 'Não',
      item?.confidence == null ? '' : `${item.confidence}%`,
    ]);

    const safeBot = sanitizeFileName(state.meta?.botTitle || state.botId);
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    downloadExcelTable(
      `bot-side-panel-condicoes_${safeBot}_${safeDate}.xls`,
      ['Condição', 'Destino', 'ID destino', 'Tipo', 'Ativo', 'Confiança'],
      rows,
    );
  } finally {
    state.exportingConditions = false;
    refreshUi();
  }
};

const onExportLex = () => {
  if (disposed || isBusy()) return;
  if (getCanonicalMode() !== MODE_BOT) return;

  const items = Array.isArray(state.lexIntents) ? state.lexIntents.slice() : [];
  if (!items.length) return;

  state.exportingLex = true;
  refreshUi();

  try {
    items.sort((a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR'));

    const rows = [];
    items.forEach((intent) => {
      const samples = Array.isArray(intent?.samples) ? intent.samples : [];
      if (!samples.length) {
        rows.push([intent?.label ?? '', '']);
        return;
      }
      samples.forEach((sample) => {
        rows.push([intent?.label ?? '', sample?.text ?? '']);
      });
    });

    const safeBot = sanitizeFileName(state.meta?.botTitle || state.botId);
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    downloadExcelTable(
      `bot-side-panel-intencoes_${safeBot}_${safeDate}.xls`,
      ['Intenção', 'Frase'],
      rows,
    );
  } finally {
    state.exportingLex = false;
    refreshUi();
  }
};

const onToggleConditionGroups = () => {
  if (disposed || isBusy()) return;
  const groups = getCurrentConditionGroups();
  if (!groups.length) return;

  const shouldOpen = !areAllConditionGroupsOpen(groups);
  groups.forEach((group) => {
    state.openConditionGroups[group.key] = shouldOpen;
  });

  renderConditions();
  updateConditionGroupsToggleButton();
};

const buildConditionRow = (rec) => {
  const row = document.createElement('div');
  row.className = 'item-row';

  const title = document.createElement('div');
  title.className = 'item-title';
  const titleText = document.createElement('span');
  titleText.textContent = rec?.label ?? 'Sem condição';
  titleText.title = rec?.entity ? `${rec.label} | entidade: ${rec.entity}` : String(rec?.label ?? '');
  title.appendChild(titleText);

  const actions = document.createElement('div');
  actions.className = 'actions-group';

  if (rec?.active === false) {
    const inactive = document.createElement('span');
    inactive.className = 'muted';
    inactive.textContent = 'inativo';
    actions.appendChild(inactive);
  }

  const right = document.createElement('strong');
  right.textContent = rec?.confidence == null ? '' : `${rec.confidence}%`;
  actions.appendChild(right);

  row.appendChild(title);
  row.appendChild(actions);
  return row;
};

const renderConditions = () => {
  if (!els.results) return;
  els.results.innerHTML = '';

  if (!state.botId) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Selecione um bot no Boteria para ver as condições.';
    els.results.appendChild(empty);
    updateConditionGroupsToggleButton();
    return;
  }

  const items = Array.isArray(state.conditions) ? state.conditions : [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma condição encontrada.';
    els.results.appendChild(empty);
    updateConditionGroupsToggleButton();
    return;
  }

  const groups = buildConditionGroups(items);
  groups.forEach((group) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';

    const title = document.createElement('span');
    title.textContent = group.title;

    const count = document.createElement('span');
    count.className = 'tag-group-meta';
    count.textContent = group.type ? `${group.type} (${group.items.length})` : String(group.items.length);

    header.appendChild(title);
    header.appendChild(count);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    group.items.forEach((rec) => content.appendChild(buildConditionRow(rec)));

    const isOpen = state.openConditionGroups[group.key] !== false;
    if (!isOpen) content.setAttribute('hidden', 'true');

    header.addEventListener('click', () => {
      const open = !content.hasAttribute('hidden');
      if (open) {
        content.setAttribute('hidden', 'true');
        state.openConditionGroups[group.key] = false;
      } else {
        content.removeAttribute('hidden');
        state.openConditionGroups[group.key] = true;
      }
      updateConditionGroupsToggleButton();
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.results.appendChild(wrapper);
  });

  updateConditionGroupsToggleButton();
};

const buildLexSampleRow = (sample) => {
  const row = document.createElement('div');
  row.className = 'item-row';

  const title = document.createElement('div');
  title.className = 'item-title';
  const titleText = document.createElement('span');
  titleText.textContent = sample?.text ?? 'Sem frase';
  title.appendChild(titleText);

  row.appendChild(title);
  return row;
};

const renderLexIntents = () => {
  if (!els.lexResults) return;
  els.lexResults.innerHTML = '';

  if (!state.botId) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Selecione um bot no Boteria para ver as intenções.';
    els.lexResults.appendChild(empty);
    updateLexGroupsToggleButton();
    return;
  }

  const items = Array.isArray(state.lexIntents) ? state.lexIntents : [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma intenção encontrada.';
    els.lexResults.appendChild(empty);
    updateLexGroupsToggleButton();
    return;
  }

  items.forEach((intent) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';

    const title = document.createElement('span');
    title.textContent = intent?.label ?? 'Sem nome';

    const count = document.createElement('span');
    count.className = 'tag-group-meta';
    count.textContent = `${intent?.samplesCount ?? 0} frase(s)`;

    header.appendChild(title);
    header.appendChild(count);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    const samples = Array.isArray(intent?.samples) ? intent.samples : [];
    if (!samples.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Nenhuma frase relacionada.';
      content.appendChild(empty);
    } else {
      samples.forEach((sample) => content.appendChild(buildLexSampleRow(sample)));
    }

    const isOpen = state.openLexGroups[intent.intentId] === true;
    if (!isOpen) content.setAttribute('hidden', 'true');

    header.addEventListener('click', () => {
      const open = !content.hasAttribute('hidden');
      if (open) {
        content.setAttribute('hidden', 'true');
        delete state.openLexGroups[intent.intentId];
      } else {
        content.removeAttribute('hidden');
        state.openLexGroups[intent.intentId] = true;
      }
      updateLexGroupsToggleButton();
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.lexResults.appendChild(wrapper);
  });

  updateLexGroupsToggleButton();
};

const onToggleLexGroups = () => {
  if (disposed || isBusy()) return;
  const groups = getCurrentLexGroups();
  if (!groups.length) return;

  const shouldOpen = !areAllLexGroupsOpen(groups);
  groups.forEach((group) => {
    if (shouldOpen) state.openLexGroups[group.intentId] = true;
    else delete state.openLexGroups[group.intentId];
  });

  renderLexIntents();
  updateLexGroupsToggleButton();
};

const initSectionToggles = () => {
  if (!Array.isArray(els.sectionToggles) || !els.sectionToggles.length) return;

  els.sectionToggles.forEach((button) => {
    const targetId = String(button?.dataset?.target ?? '').trim();
    if (!targetId) return;
    const target = rootEl?.querySelector(`#${targetId}`) ?? null;
    if (!target) return;

    const sectionKey =
      targetId === 'ia-status-content'
        ? 'status'
        : targetId === 'ia-conditions-content'
          ? 'conditions'
          : targetId === 'ia-lex-content'
            ? 'lex'
            : null;
    if (!sectionKey) return;

    if (state.collapsedSections[sectionKey]) {
      target.setAttribute('hidden', 'true');
      button.textContent = 'Exibir';
    } else {
      target.removeAttribute('hidden');
      button.textContent = 'Recolher';
    }

    on(button, 'click', () => {
      const isHidden = target.hasAttribute('hidden');
      if (isHidden) {
        target.removeAttribute('hidden');
        button.textContent = 'Recolher';
        state.collapsedSections[sectionKey] = false;
      } else {
        target.setAttribute('hidden', 'true');
        button.textContent = 'Exibir';
        state.collapsedSections[sectionKey] = true;
      }
    });
  });
};

const loadMetaAndData = async () => {
  if (disposed) return;

  if (!state.botId) {
    state.meta = null;
    state.conditions = [];
    state.lexIntents = [];
    return;
  }

  const [metaResult, conditionsResult, lexResult] = await Promise.allSettled([
    getMeta(state.botId),
    listBotIntents(state.botId),
    listBotLexIntents(state.botId),
  ]);

  if (disposed) return;

  state.meta = metaResult.status === 'fulfilled' ? metaResult.value : null;
  state.conditions =
    conditionsResult.status === 'fulfilled' && Array.isArray(conditionsResult.value) ? conditionsResult.value : [];
  state.lexIntents = lexResult.status === 'fulfilled' ? sortByLabel(lexResult.value) : [];
};

const refreshUi = () => {
  updateHeader();
  updateConditionsStatus();
  updateConditionsStats();
  updateConditionsSyncButton();
  updateConditionsExportButton();
  updateConditionGroupsToggleButton();
  updateLexStatus();
  updateLexStats();
  updateLexSyncButton();
  updateLexExportButton();
  updateLexGroupsToggleButton();
};

const loadContext = async () => {
  if (disposed) return;
  const response = await callBG(MessageType.GET_CONTEXT);
  if (disposed) return;
  if (!response.ok || !response.data?.context) return;

  const prevBotId = state.botId;
  const prevMode = getCanonicalMode();
  const prevConditionsSyncAt = state.meta?.lastIntentsSyncAt ?? null;
  const prevLexSyncAt = state.meta?.lastLexIntentsSyncAt ?? null;

  state.botId = response.data.context.botId ?? null;
  state.contextMode = response.data.context.mode ?? null;
  state.hasAuth = Boolean(response.data.hasAuth);

  if (state.botId !== prevBotId) {
    state.lastConditionsError = null;
    state.lastLexError = null;
    state.openConditionGroups = {};
    state.openLexGroups = {};
    await loadMetaAndData();
    renderConditions();
    renderLexIntents();
  } else if (state.botId) {
    try {
      state.meta = await getMeta(state.botId);
    } catch {
      state.meta = null;
    }
    if (disposed) return;

    const modeChanged = getCanonicalMode() !== prevMode;
    const conditionsSyncChanged = (state.meta?.lastIntentsSyncAt ?? null) !== prevConditionsSyncAt;
    const lexSyncChanged = (state.meta?.lastLexIntentsSyncAt ?? null) !== prevLexSyncAt;

    if (conditionsSyncChanged) {
      try {
        state.conditions = await listBotIntents(state.botId);
      } catch {
        state.conditions = [];
      }
      if (disposed) return;
    }

    if (lexSyncChanged) {
      try {
        state.lexIntents = sortByLabel(await listBotLexIntents(state.botId));
      } catch {
        state.lexIntents = [];
      }
      if (disposed) return;
    }

    if (conditionsSyncChanged || modeChanged) renderConditions();
    if (lexSyncChanged || modeChanged) renderLexIntents();
  }

  refreshUi();
};

const startConditionsSync = async () => {
  if (!state.botId || !state.hasAuth || getCanonicalMode() !== MODE_BOT || isBusy()) return;

  state.syncingConditions = true;
  state.lastConditionsError = null;
  refreshUi();

  const response = await callBG(MessageType.SYNC_AI_INTENTS, { botId: state.botId });
  state.syncingConditions = false;

  if (!response.ok) {
    state.lastConditionsError = response.error?.details ?? response.error?.message ?? 'Falha ao sincronizar.';
    refreshUi();
    return;
  }

  await loadMetaAndData();
  renderConditions();
  renderLexIntents();
  refreshUi();
};

const startLexSync = async () => {
  if (!state.botId || getCanonicalMode() !== MODE_BOT || isBusy()) return;

  state.syncingLex = true;
  state.lastLexError = null;
  refreshUi();

  const response = await callBG(MessageType.SYNC_LEX_INTENTS, { botId: state.botId });
  state.syncingLex = false;

  if (!response.ok) {
    state.lastLexError = response.error?.details ?? response.error?.message ?? 'Falha ao sincronizar.';
    refreshUi();
    return;
  }

  await loadMetaAndData();
  renderConditions();
  renderLexIntents();
  refreshUi();
};

const init = async () => {
  if (els.syncBtn) on(els.syncBtn, 'click', () => startConditionsSync());
  if (els.toggleGroupsBtn) on(els.toggleGroupsBtn, 'click', onToggleConditionGroups);
  if (els.exportBtn) on(els.exportBtn, 'click', onExportConditions);
  if (els.lexSyncBtn) on(els.lexSyncBtn, 'click', () => startLexSync());
  if (els.lexToggleGroupsBtn) on(els.lexToggleGroupsBtn, 'click', onToggleLexGroups);
  if (els.lexExportBtn) on(els.lexExportBtn, 'click', onExportLex);
  initSectionToggles();

  await loadContext();

  refreshUi();
  renderConditions();
  renderLexIntents();

  const onMessage = (message) => {
    if (disposed) return;
    if (message?.type === MessageType.CONTEXT_CHANGED) {
      loadContext();
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  cleanupFns.push(() => chrome.runtime.onMessage.removeListener(onMessage));

  const intervalId = setInterval(() => loadContext(), 2000);
  cleanupFns.push(() => clearInterval(intervalId));
};

export const screenIa = {
  id: 'ia',
  title: 'I.A.',
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
