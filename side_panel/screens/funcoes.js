import { callBG, MessageType } from '../../services/messaging.js';
import { getMeta } from '../../data/db.js';

const TEMPLATE_ID = 'tpl-screen-funcoes';

const createInitialState = () => ({
  loading: false,
  botId: null,
  mode: null,
  hasAuth: false,
  meta: null,
  functions: [],
  error: null,
  fetchedAt: null,
  openGroups: {},
  collapsedSections: {
    status: false,
    results: false,
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
  const qa = (sel) => (rootEl ? Array.from(rootEl.querySelectorAll(sel)) : []);
  return {
    light: q('#funcoes-light'),
    bot: q('#funcoes-bot'),
    auth: q('#funcoes-auth'),
    status: q('#funcoes-status'),
    total: q('#funcoes-total'),
    lastSync: q('#funcoes-last-sync'),
    refreshBtn: q('#funcoes-refresh'),
    results: q('#funcoes-results'),
    sectionToggles: qa('.section-toggle'),
  };
};

const normalizeModeValue = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === 'bot' || raw === 'ura') return raw;
  return null;
};

const initSectionToggles = () => {
  if (!Array.isArray(els.sectionToggles) || !els.sectionToggles.length) return;
  els.sectionToggles.forEach((button) => {
    const targetId = String(button?.dataset?.target ?? '').trim();
    if (!targetId) return;
    const target = rootEl?.querySelector(`#${targetId}`) ?? null;
    if (!target) return;

    const sectionKey =
      targetId === 'funcoes-status-content'
        ? 'status'
        : targetId === 'funcoes-results-content'
          ? 'results'
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

const getFnTitle = (fn) => {
  if (typeof fn === 'string') return fn;
  if (!fn || typeof fn !== 'object') return 'Função';
  return fn.name || fn.functionName || fn.title || fn.label || fn._id || fn.id || 'Função';
};

const getFnDesc = (fn) => {
  if (!fn || typeof fn !== 'object') return '';
  return fn.description || fn.summary || fn.detail || '';
};

const getFnId = (fn) => {
  if (!fn || typeof fn !== 'object') return '';
  return fn._id || fn.id || fn.functionId || '';
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
  if (!hasBotAndAuth) {
    setText(els.status, 'Aguardando bot/token');
    setLight(els.light, 'red');
    return;
  }
  if (state.loading) {
    setText(els.status, 'Atualizando...');
    setLight(els.light, 'yellow');
    return;
  }
  if (state.error) {
    setText(els.status, `Erro: ${state.error}`);
    setLight(els.light, 'red');
    return;
  }
  if (state.mode !== 'ura') {
    setText(els.status, 'Disponível apenas no mode URA.');
    setLight(els.light, 'red');
    return;
  }
  setText(els.status, 'OK');
  setLight(els.light, 'green');
};

const updateStats = () => {
  const total = Array.isArray(state.functions) ? state.functions.length : 0;
  setText(els.total, String(total));
  setText(els.lastSync, formatDate(state.fetchedAt));
};

const renderResults = () => {
  if (!els.results) return;
  els.results.innerHTML = '';

  const list = Array.isArray(state.functions) ? state.functions : [];
  if (state.loading) return;
  if (state.error) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = String(state.error);
    els.results.appendChild(empty);
    return;
  }
  if (!list.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma função encontrada.';
    els.results.appendChild(empty);
    return;
  }

  for (const [index, fn] of list.entries()) {
    const title = getFnTitle(fn);
    const id = getFnId(fn);
    const key = id ? `id:${id}` : `idx:${index}:${title}`;
    const open = Boolean(state.openGroups?.[key]);

    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';

    const left = document.createElement('span');
    left.textContent = title;

    const right = document.createElement('span');
    right.className = 'tag-group-meta';
    right.textContent = id ? String(id).slice(-6) : '';

    header.appendChild(left);
    header.appendChild(right);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    if (!open) content.setAttribute('hidden', 'true');

    const descValue = getFnDesc(fn);
    if (descValue) {
      const desc = document.createElement('div');
      desc.className = 'compare-line__desc';
      desc.textContent = String(descValue);
      content.appendChild(desc);
    }

    const pre = document.createElement('pre');
    pre.className = 'funcoes-json';
    try {
      pre.textContent = JSON.stringify(fn, null, 2);
    } catch {
      pre.textContent = String(fn);
    }
    content.appendChild(pre);

    header.addEventListener('click', () => {
      const isOpen = !content.hasAttribute('hidden');
      if (isOpen) {
        content.setAttribute('hidden', 'true');
        delete state.openGroups[key];
      } else {
        content.removeAttribute('hidden');
        state.openGroups[key] = true;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.results.appendChild(wrapper);
  }
};

const render = () => {
  updateHeader();
  updateStatus();
  updateStats();
  renderResults();

  if (els.refreshBtn) {
    els.refreshBtn.disabled = Boolean(state.loading);
    els.refreshBtn.textContent = state.loading ? 'Atualizando...' : 'Atualizar';
  }
};

const load = async () => {
  if (disposed) return;
  state.loading = true;
  state.error = null;
  render();

  try {
    const ctx = await callBG(MessageType.GET_CONTEXT);
    if (disposed) return;
    if (ctx.ok && ctx.data?.context) {
      state.botId = ctx.data.context.botId ?? null;
      state.mode = normalizeModeValue(ctx.data.context.mode) ?? null;
      state.hasAuth = Boolean(ctx.data.hasAuth);
    }

    if (state.botId) {
      try {
        state.meta = await getMeta(state.botId);
      } catch {
        state.meta = null;
      }
    } else {
      state.meta = null;
    }

    if (!state.hasAuth) {
      state.functions = [];
      state.error = 'Token ausente (recarregue o builder).';
      return;
    }
    if (state.mode !== 'ura') {
      state.functions = [];
      state.error = 'Disponível apenas no mode URA.';
      return;
    }

    const res = await callBG(MessageType.LIST_URA_FUNCTIONS);
    if (!res.ok) {
      state.functions = [];
      state.error = res.error?.message ?? 'Falha ao buscar funções.';
      return;
    }
    state.functions = Array.isArray(res.data?.functions) ? res.data.functions : [];
    state.fetchedAt = new Date().toISOString();
  } finally {
    state.loading = false;
    render();
  }
};

const init = async () => {
  if (els.refreshBtn) on(els.refreshBtn, 'click', load);
  initSectionToggles();
  await load();
};

export const screenFuncoes = {
  id: 'funcoes',
  title: 'Funções',
  // Relevante apenas para URA (o endpoint existe somente la).
  modes: ['ura'],
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
