import { callBG, MessageType } from '../../services/messaging.js';

const TEMPLATE_ID = 'tpl-screen-acesso-rapido';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';
const ABSTRACT_BASE_URL = 'https://bots.digitalcontact.cloud';

const createInitialState = () => ({
  records: [],
  loading: false,
  error: null,
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

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  return {
    refreshBtn: q('#quick-access-refresh'),
    recordsCount: q('#quick-access-records-count'),
    error: q('#quick-access-error'),
    list: q('#quick-access-list'),
    empty: q('#quick-access-empty'),
  };
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const normalizeMode = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const modeLabel = (mode) => {
  if (mode === MODE_URA) return 'URA';
  if (mode === MODE_BOT) return 'BOT';
  return '?';
};

const buildAbstractUrl = (botId, mode) => {
  const id = String(botId ?? '').trim();
  const normalizedMode = normalizeMode(mode);
  if (!id || !normalizedMode) return null;
  if (normalizedMode === MODE_URA) return `${ABSTRACT_BASE_URL}/ivrs/${id}/abstract`;
  return `${ABSTRACT_BASE_URL}/bots/${id}/abstract`;
};

const sortRecords = (records) => {
  const list = Array.isArray(records) ? records.slice() : [];
  list.sort((a, b) => {
    const titleA = String(a?.botTitle ?? a?.botId ?? '').trim();
    const titleB = String(b?.botTitle ?? b?.botId ?? '').trim();
    return titleA.localeCompare(titleB, 'pt-BR');
  });
  return list;
};

const updateSummary = () => {
  const records = Array.isArray(state.records) ? state.records : [];
  setText(els.recordsCount, String(records.length));

  if (els.error) {
    if (state.error) {
      els.error.hidden = false;
      els.error.textContent = state.error;
    } else {
      els.error.hidden = true;
      els.error.textContent = '';
    }
  }

  if (els.refreshBtn) {
    els.refreshBtn.disabled = Boolean(state.loading);
    els.refreshBtn.textContent = state.loading ? 'Atualizando...' : 'Atualizar';
  }
};

const buildRecordRow = (record) => {
  const row = document.createElement('div');
  row.className = 'quick-access-row';

  const info = document.createElement('div');
  info.className = 'quick-access-info';

  const title = document.createElement('div');
  title.className = 'quick-access-title';
  title.textContent = record?.botTitle || record?.botId || '-';
  info.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'quick-access-meta';
  meta.textContent = `${modeLabel(record?.mode)} • ${record?.botId || '-'} • Full: ${formatDate(record?.lastItemsSyncAt)}`;
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'quick-access-actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'item-link';
  openBtn.type = 'button';
  openBtn.textContent = 'Acessar';
  const abstractUrl = buildAbstractUrl(record?.botId, record?.mode);
  openBtn.disabled = !abstractUrl;
  if (abstractUrl) {
    openBtn.title = abstractUrl;
    openBtn.addEventListener('click', () => {
      callBG(MessageType.OPEN_URL_CURRENT_TAB, { url: abstractUrl }).catch(() => undefined);
    });
  }

  actions.appendChild(openBtn);

  row.appendChild(info);
  row.appendChild(actions);

  return row;
};

const renderRecords = () => {
  if (!els.list) return;
  els.list.innerHTML = '';

  const records = Array.isArray(state.records) ? state.records : [];
  if (els.empty) els.empty.hidden = records.length > 0;
  if (!records.length) return;

  for (const record of records) {
    els.list.appendChild(buildRecordRow(record));
  }
};

const loadRecords = async () => {
  if (disposed) return;
  state.loading = true;
  state.error = null;
  updateSummary();

  try {
    const response = await callBG(MessageType.LIST_BOTS);
    if (!response.ok) {
      state.records = [];
      state.error = response.error?.message ?? 'Falha ao listar registros.';
    } else {
      const list = Array.isArray(response.data?.bots) ? response.data.bots : [];
      const filtered = list
        .filter((meta) => {
          const mode = normalizeMode(meta?.mode);
          return Boolean(mode);
        })
        .map((meta) => ({ ...meta, mode: normalizeMode(meta?.mode) }));

      state.records = sortRecords(filtered);
    }
  } catch (error) {
    state.records = [];
    state.error = String(error?.message ?? error);
  } finally {
    state.loading = false;
  }

  updateSummary();
  renderRecords();
};

const init = async () => {
  if (els.refreshBtn) on(els.refreshBtn, 'click', () => loadRecords());
  await loadRecords();
};

export const screenAcessoRapido = {
  id: 'acesso-rapido',
  title: 'Acesso Rápido',
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
