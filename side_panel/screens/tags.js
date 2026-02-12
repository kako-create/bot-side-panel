import { callBG, MessageType } from '../../services/messaging.js';
import { getMeta, listBotTags } from '../../data/db.js';
import { saveActiveScreenId } from '../router.js';
import { saveConsultaIntent } from '../consultaIntent.js';

const TEMPLATE_ID = 'tpl-screen-tags';
const TAG_GROUP_REGEX = /^([A-Za-z]{3})\.(\d{3,4})$/;

const createInitialState = () => ({
  botId: null,
  hasAuth: false,
  syncing: false,
  lastError: null,
  meta: null,
  tags: [],
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
    light: q('#tags-light'),
    bot: q('#tags-bot'),
    auth: q('#tags-auth'),
    status: q('#tags-status'),
    total: q('#tags-total'),
    lastSync: q('#tags-last-sync'),
    syncBtn: q('#tags-sync'),
    results: q('#tags-results'),
  };
};

const updateHeader = () => {
  const title = state.meta?.botTitle;
  if (!state.botId) setText(els.bot, '-');
  else if (title) setText(els.bot, `${title} (${state.botId})`);
  else setText(els.bot, state.botId);
  setText(els.auth, state.hasAuth ? 'ok' : 'ausente');
};

const updateStatus = () => {
  const hasBotAndAuth = Boolean(state.botId) && Boolean(state.hasAuth);
  const synced = Boolean(state.meta?.lastTagsSyncAt);
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
  setText(els.status, synced ? 'OK' : 'Pronto para sincronizar');
  setLight(els.light, synced ? 'green' : 'red');
};

const updateStats = () => {
  const total = Array.isArray(state.tags) ? state.tags.length : 0;
  setText(els.total, String(total));
  setText(els.lastSync, formatDate(state.meta?.lastTagsSyncAt));
};

const updateSyncButton = () => {
  if (!els.syncBtn) return;
  const ready = Boolean(state.botId) && Boolean(state.hasAuth) && !state.syncing;
  els.syncBtn.disabled = !ready;
};

const getTagLabel = (rec) => String(rec?.label ?? rec?.payload?.tag ?? rec?.payload?.label ?? '').trim();

const buildGroups = (records) => {
  const groups = new Map(); // key -> { key, min, max, width, items: [] }
  const others = [];

  records.forEach((rec) => {
    const label = getTagLabel(rec);
    if (!label) return;
    const match = TAG_GROUP_REGEX.exec(label);
    if (!match) {
      others.push({ label, tagId: rec?.tagId ?? label });
      return;
    }
    const key = match[1].toUpperCase();
    const rawNumber = match[2];
    const width = rawNumber.length;
    const value = Number.parseInt(rawNumber, 10);
    if (!groups.has(key)) {
      groups.set(key, { key, min: value, max: value, width, items: [] });
    }
    const g = groups.get(key);
    g.items.push({ label, tagId: rec?.tagId ?? label });
    g.width = Math.max(Number(g.width) || 0, width);
    if (value < g.min) g.min = value;
    if (value > g.max) g.max = value;
  });

  const out = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  out.forEach((g) => {
    g.items.sort((a, b) => {
      const matchA = TAG_GROUP_REGEX.exec(a.label);
      const matchB = TAG_GROUP_REGEX.exec(b.label);
      const numA = matchA ? Number.parseInt(matchA[2], 10) : Number.POSITIVE_INFINITY;
      const numB = matchB ? Number.parseInt(matchB[2], 10) : Number.POSITIVE_INFINITY;
      if (numA !== numB) return numA - numB;
      return a.label.localeCompare(b.label);
    });
  });

  others.sort((a, b) => a.label.localeCompare(b.label));
  return { groups: out, others };
};

const buildTagRow = (item) => {
  const row = document.createElement('div');
  row.className = 'item-row';

  const title = document.createElement('div');
  title.className = 'item-title';
  const titleText = document.createElement('span');
  titleText.textContent = item?.label ?? 'Sem nome';
  title.appendChild(titleText);

  const actions = document.createElement('div');
  actions.className = 'actions-group';

  const right = document.createElement('strong');
  right.textContent = '';
  actions.appendChild(right);

  const query = String(item?.label ?? '').trim();
  const hasFullSync = Boolean(state.meta?.lastItemsSyncAt);
  if (hasFullSync && query) {
    const deepSearchButton = document.createElement('button');
    deepSearchButton.className = 'item-link';
    deepSearchButton.type = 'button';
    deepSearchButton.textContent = 'Buscar no payload';
    deepSearchButton.title = `Buscar "${query}" na busca avançada`;
    deepSearchButton.addEventListener('click', async () => {
      await saveConsultaIntent({
        kind: 'tag_payload_search',
        query,
        deep: true,
        type: '',
        autoRun: true,
      });
      await saveActiveScreenId('consulta');
      window.dispatchEvent(
        new CustomEvent('bot-sp:navigate', {
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

const renderTags = () => {
  if (!els.results) return;
  els.results.innerHTML = '';

  if (!state.botId) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Selecione um bot no Boteria para ver as TAGs.';
    els.results.appendChild(empty);
    return;
  }

  const items = Array.isArray(state.tags) ? state.tags : [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma TAG encontrada.';
    els.results.appendChild(empty);
    return;
  }

  const { groups, others } = buildGroups(items);
  const allEmpty = groups.length === 0 && others.length === 0;
  if (allEmpty) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma TAG encontrada.';
    els.results.appendChild(empty);
    return;
  }

  const renderAccordion = ({ title, subtitle, count, rows }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';

    const left = document.createElement('span');
    left.textContent = title;

    const right = document.createElement('span');
    right.className = 'tag-group-meta';
    right.textContent = subtitle ? `${subtitle} (${count})` : String(count);

    header.appendChild(left);
    header.appendChild(right);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    rows.forEach((row) => content.appendChild(buildTagRow(row)));

    const isOpen = Boolean(state.openGroups[title]);
    if (!isOpen) content.setAttribute('hidden', 'true');

    header.addEventListener('click', () => {
      const open = !content.hasAttribute('hidden');
      if (open) {
        content.setAttribute('hidden', 'true');
        delete state.openGroups[title];
      } else {
        content.removeAttribute('hidden');
        state.openGroups[title] = true;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.results.appendChild(wrapper);
  };

  groups.forEach((g) => {
    const pad = Math.max(Number(g.width) || 0, 3);
    const min = String(g.min).padStart(pad, '0');
    const max = String(g.max).padStart(pad, '0');
    const subtitle = `${min} → ${max}`;
    renderAccordion({ title: g.key, subtitle, count: g.items.length, rows: g.items });
  });

  if (others.length > 0) {
    renderAccordion({ title: 'Outros', subtitle: '', count: others.length, rows: others });
  }
};

const loadMetaAndTags = async () => {
  if (disposed) return;
  if (!state.botId) {
    state.meta = null;
    state.tags = [];
    return;
  }
  try {
    state.meta = await getMeta(state.botId);
  } catch {
    state.meta = null;
  }
  if (disposed) return;
  try {
    state.tags = await listBotTags(state.botId);
  } catch {
    state.tags = [];
  }
};

const loadContext = async () => {
  if (disposed) return;
  const response = await callBG(MessageType.GET_CONTEXT);
  if (disposed) return;
  if (!response.ok || !response.data?.context) return;

  const prevBotId = state.botId;
  state.botId = response.data.context.botId ?? null;
  state.hasAuth = Boolean(response.data.hasAuth);
  updateHeader();
  updateSyncButton();
  updateStatus();

  if (state.botId !== prevBotId) {
    state.openGroups = {};
    await loadMetaAndTags();
    updateHeader();
    updateStats();
    updateStatus();
    renderTags();
  }
};

const startSync = async () => {
  if (!state.botId || !state.hasAuth || state.syncing) return;
  state.syncing = true;
  state.lastError = null;
  updateSyncButton();
  updateStatus();

  const response = await callBG(MessageType.SYNC_TAGS, { botId: state.botId });
  state.syncing = false;
  if (!response.ok) {
    state.lastError = response.error?.message ?? 'Falha ao sincronizar.';
    updateSyncButton();
    updateStatus();
    return;
  }

  await loadMetaAndTags();
  updateHeader();
  updateStats();
  updateStatus();
  renderTags();
  updateSyncButton();
};

const init = async () => {
  if (els.syncBtn) on(els.syncBtn, 'click', () => startSync());

  await loadContext();
  await loadMetaAndTags();

  updateHeader();
  updateStats();
  updateStatus();
  renderTags();
  updateSyncButton();

  const intervalId = setInterval(() => loadContext(), 2000);
  cleanupFns.push(() => clearInterval(intervalId));
};

export const screenTags = {
  id: 'tags',
  title: 'TAGs',
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
