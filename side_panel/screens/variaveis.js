import { callBG, MessageType } from '../../services/messaging.js';
import { getMeta, listBotVariables } from '../../data/db.js';
import { saveActiveScreenId } from '../router.js';
import { saveConsultaIntent } from '../consultaIntent.js';
import { PANEL_EVENTS } from '../panelEvents.js';

const TEMPLATE_ID = 'tpl-screen-variaveis';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';

const createInitialState = () => ({
  botId: null,
  hasAuth: false,
  syncing: false,
  lastError: null,
  meta: null,
  variables: [],
  openGroups: {},
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

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  return {
    light: q('#vars-light'),
    bot: q('#vars-bot'),
    auth: q('#vars-auth'),
    status: q('#vars-status'),
    total: q('#vars-total'),
    lastSync: q('#vars-last-sync'),
    syncBtn: q('#vars-sync'),
    results: q('#vars-results'),
  };
};

const updateHeader = () => {
  const title = state.meta?.botTitle;
  if (!state.botId) setText(els.bot, '-');
  else if (title) setText(els.bot, `${title} (${state.botId})`);
  else setText(els.bot, state.botId);
  setText(els.auth, state.hasAuth ? 'ok' : 'ausente');
};

const getCanonicalMode = () => {
  const raw = String(state.meta?.mode ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const updateStatus = () => {
  const hasBotAndAuth = Boolean(state.botId) && Boolean(state.hasAuth);
  const mode = getCanonicalMode();
  const synced = Boolean(state.meta?.lastVariablesSyncAt);
  if (!hasBotAndAuth) {
    setText(els.status, 'Aguardando bot/token');
    setLight(els.light, 'red');
    return;
  }
  if (state.syncing) {
    setText(els.status, 'Sincronizando...');
    setLight(els.light, 'yellow');
    return;
  }
  if (state.lastError) {
    setText(els.status, `Erro: ${state.lastError}`);
    setLight(els.light, 'red');
    return;
  }
  if (!mode) {
    setText(els.status, 'Modo indefinido. Execute "Sinc. Busca avançada".');
    setLight(els.light, 'red');
    return;
  }
  setText(els.status, synced ? 'OK' : 'Pronto para sincronizar');
  setLight(els.light, synced ? 'green' : 'red');
};

const updateStats = () => {
  const total = Array.isArray(state.variables) ? state.variables.length : 0;
  setText(els.total, String(total));
  setText(els.lastSync, formatDate(state.meta?.lastVariablesSyncAt));
};

const updateSyncButton = () => {
  if (!els.syncBtn) return;
  const ready = Boolean(state.botId) && Boolean(state.hasAuth) && Boolean(getCanonicalMode()) && !state.syncing;
  els.syncBtn.disabled = !ready;
};

const buildGroups = (records) => {
  const grouped = new Map();
  records.forEach((rec) => {
    const key = String(rec?.groupLabel || rec?.group || 'Outros').trim() || 'Outros';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(rec);
  });
  const groups = Array.from(grouped.entries()).map(([key, items]) => ({ key, items }));
  groups.sort((a, b) => a.key.localeCompare(b.key, 'pt-BR'));
  groups.forEach((g) => {
    g.items.sort((a, b) => String(a?.label ?? '').localeCompare(String(b?.label ?? ''), 'pt-BR'));
  });
  return groups;
};

const buildVariableRow = (rec) => {
  const row = document.createElement('div');
  row.className = 'item-row';

  const title = document.createElement('div');
  title.className = 'item-title';
  const titleText = document.createElement('span');
  titleText.textContent = rec?.label ?? 'Sem nome';
  title.appendChild(titleText);

  const actions = document.createElement('div');
  actions.className = 'actions-group';

  const right = document.createElement('strong');
  const rawId = rec?.payload?._id ?? rec?.payload?.id ?? '';
  right.textContent = rawId ? String(rawId).slice(-6) : '';
  actions.appendChild(right);

  const query = String(rec?.label ?? '').trim();
  const hasFullSync = Boolean(state.meta?.lastItemsSyncAt);
  if (hasFullSync && query) {
    const deepSearchButton = document.createElement('button');
    deepSearchButton.className = 'item-link';
    deepSearchButton.type = 'button';
    deepSearchButton.textContent = 'Buscar no payload';
    deepSearchButton.title = `Buscar "${query}" na busca avançada`;
    deepSearchButton.addEventListener('click', async () => {
      await saveConsultaIntent({
        kind: 'variable_payload_search',
        query,
        deep: true,
        type: '',
        autoRun: true,
      });
      await saveActiveScreenId('consulta');
      window.dispatchEvent(
        new CustomEvent(PANEL_EVENTS.NAVIGATE, {
          detail: { screenId: 'consulta' },
        }),
      );
    });
    actions.appendChild(deepSearchButton);
  }

  row.appendChild(title);
  row.appendChild(actions);
  return row;
};

const renderVariables = () => {
  if (!els.results) return;
  els.results.innerHTML = '';
  if (!state.botId) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Selecione um bot no Boteria para ver as variáveis.';
    els.results.appendChild(empty);
    return;
  }
  const items = Array.isArray(state.variables) ? state.variables : [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma variável encontrada.';
    els.results.appendChild(empty);
    return;
  }

  const groups = buildGroups(items);
  groups.forEach((group) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';
    const title = document.createElement('span');
    title.textContent = group.key;
    const count = document.createElement('span');
    count.textContent = String(group.items.length);
    header.appendChild(title);
    header.appendChild(count);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    group.items.forEach((rec) => content.appendChild(buildVariableRow(rec)));

    const isOpen = Boolean(state.openGroups[group.key]);
    if (!isOpen) content.setAttribute('hidden', 'true');

    header.addEventListener('click', () => {
      const open = !content.hasAttribute('hidden');
      if (open) {
        content.setAttribute('hidden', 'true');
        delete state.openGroups[group.key];
      } else {
        content.removeAttribute('hidden');
        state.openGroups[group.key] = true;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.results.appendChild(wrapper);
  });
};

const loadMetaAndVariables = async () => {
  if (disposed) return;
  if (!state.botId) {
    state.meta = null;
    state.variables = [];
    return;
  }
  try {
    state.meta = await getMeta(state.botId);
  } catch {
    state.meta = null;
  }
  if (disposed) return;
  try {
    state.variables = await listBotVariables(state.botId);
  } catch {
    state.variables = [];
  }
};

const loadContext = async () => {
  if (disposed) return;
  const response = await callBG(MessageType.GET_CONTEXT);
  if (disposed) return;
  if (!response.ok || !response.data?.context) return;

  const prevBotId = state.botId;
  const prevMeta = state.meta;
  const prevMode = getCanonicalMode();
  const prevVarsSyncAt = prevMeta?.lastVariablesSyncAt ?? null;
  state.botId = response.data.context.botId ?? null;
  state.hasAuth = Boolean(response.data.hasAuth);

  if (state.botId !== prevBotId) {
    state.openGroups = {};
    await loadMetaAndVariables();
    renderVariables();
  } else if (state.botId) {
    try {
      state.meta = await getMeta(state.botId);
    } catch {
      state.meta = null;
    }
    if (disposed) return;

    const modeChanged = getCanonicalMode() !== prevMode;
    const varsSyncChanged = (state.meta?.lastVariablesSyncAt ?? null) !== prevVarsSyncAt;

    if (varsSyncChanged) {
      try {
        state.variables = await listBotVariables(state.botId);
      } catch {
        state.variables = [];
      }
      if (disposed) return;
    }
    if (varsSyncChanged || modeChanged) {
      updateStats();
      renderVariables();
    }
  }

  updateHeader();
  updateSyncButton();
  updateStatus();
  updateStats();
};

const startSync = async () => {
  if (!state.botId || !state.hasAuth || !getCanonicalMode() || state.syncing) return;
  state.syncing = true;
  state.lastError = null;
  updateSyncButton();
  updateStatus();

  const response = await callBG(MessageType.SYNC_VARIABLES, { botId: state.botId });
  state.syncing = false;
  if (!response.ok) {
    state.lastError = response.error?.message ?? 'Falha ao sincronizar.';
    updateSyncButton();
    updateStatus();
    return;
  }

  await loadMetaAndVariables();
  updateHeader();
  updateStats();
  updateStatus();
  renderVariables();
  updateSyncButton();
};

const init = async () => {
  if (els.syncBtn) on(els.syncBtn, 'click', () => startSync());

  await loadContext();

  updateHeader();
  updateStats();
  updateStatus();
  renderVariables();
  updateSyncButton();

  const intervalId = setInterval(() => loadContext(), 2000);
  cleanupFns.push(() => clearInterval(intervalId));
};

export const screenVariaveis = {
  id: 'variaveis',
  title: 'Variáveis',
  mount: async ({ root }) => {
    disposed = false;
    cleanupFns = [];
    state = createInitialState();
    rootEl = root;

    const template = document.getElementById(TEMPLATE_ID);
    if (!template) {
      throw new Error(`Template \"${TEMPLATE_ID}\" não encontrado em panel.html`);
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
          // ignore
        }
      });
      if (rootEl) rootEl.innerHTML = '';
      els = {};
      rootEl = null;
      state = createInitialState();
    };
  },
};
