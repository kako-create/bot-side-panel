import { callBG, MessageType } from '../../services/messaging.js';

const TEMPLATE_ID = 'tpl-screen-funcoes';

const createInitialState = () => ({
  loading: false,
  botId: null,
  mode: null,
  hasAuth: false,
  functions: [],
  error: null,
  fetchedAt: null,
  openRows: {},
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
    summary: q('#funcoes-summary'),
    refreshBtn: q('#funcoes-refresh'),
    results: q('#funcoes-results'),
  };
};

const normalizeModeValue = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === 'bot' || raw === 'ura') return raw;
  return null;
};

const render = () => {
  if (els.summary) {
    const bot = state.botId ? state.botId : '-';
    const mode = state.mode ? state.mode.toUpperCase() : '-';
    const auth = state.hasAuth ? 'ok' : 'ausente';
    const count = Array.isArray(state.functions) ? state.functions.length : 0;
    const fetched = state.fetchedAt ? new Date(state.fetchedAt).toLocaleString('pt-BR') : '-';
    setText(
      els.summary,
      state.error
        ? `Erro: ${state.error}`
        : `Bot: ${bot} | Mode: ${mode} | Token: ${auth} | Funções: ${count} | Atualizado: ${fetched}`,
    );
  }
  if (els.refreshBtn) {
    els.refreshBtn.disabled = Boolean(state.loading);
    els.refreshBtn.textContent = state.loading ? 'Atualizando...' : 'Atualizar';
  }

  if (els.results) {
    els.results.innerHTML = '';
    const list = Array.isArray(state.functions) ? state.functions : [];
    if (state.loading) return;
    if (state.error) return;
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Nenhuma função encontrada.';
      els.results.appendChild(empty);
      return;
    }

    const getFnTitle = (fn) => {
      if (typeof fn === 'string') return fn;
      if (!fn || typeof fn !== 'object') return 'Função';
      return (
        fn.name ||
        fn.functionName ||
        fn.title ||
        fn.label ||
        fn._id ||
        fn.id ||
        'Função'
      );
    };

    const getFnDesc = (fn) => {
      if (!fn || typeof fn !== 'object') return '';
      return fn.description || fn.summary || fn.detail || '';
    };

    for (const [index, fn] of list.entries()) {
      const rowKey = `${index}:${getFnTitle(fn)}`;
      const wrapper = document.createElement('div');
      wrapper.className = 'compare-line compare-line--expandable';
      const open = Boolean(state.openRows?.[rowKey]);

      const head = document.createElement('div');
      head.className = 'compare-line__head';

      const info = document.createElement('div');
      info.className = 'compare-line__head-info';

      const headTitle = document.createElement('div');
      headTitle.className = 'compare-line__title';
      headTitle.textContent = getFnTitle(fn);
      info.appendChild(headTitle);

      head.appendChild(info);

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'btn btn--ghost btn--sm';
      toggle.textContent = open ? '▾' : '▸';
      toggle.title = open ? 'Recolher' : 'Expandir';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      head.appendChild(toggle);

      const details = document.createElement('div');
      details.className = 'compare-line__details';
      if (!open) details.setAttribute('hidden', 'true');

      // Expanded: keep the same content format as before.
      const title = document.createElement('div');
      title.className = 'compare-line__title';
      title.textContent = getFnTitle(fn);
      details.appendChild(title);

      const descValue = getFnDesc(fn);
      if (descValue) {
        const desc = document.createElement('div');
        desc.className = 'compare-line__desc';
        desc.textContent = String(descValue);
        details.appendChild(desc);
      }

      const pre = document.createElement('pre');
      pre.className = 'funcoes-json';
      try {
        pre.textContent = JSON.stringify(fn, null, 2);
      } catch {
        pre.textContent = String(fn);
      }

      details.appendChild(pre);

      const toggleOpen = () => {
        const isOpen = !details.hasAttribute('hidden');
        if (isOpen) {
          details.setAttribute('hidden', 'true');
          delete state.openRows[rowKey];
          toggle.textContent = '▸';
          toggle.title = 'Expandir';
          toggle.setAttribute('aria-expanded', 'false');
          return;
        }
        details.removeAttribute('hidden');
        state.openRows[rowKey] = true;
        toggle.textContent = '▾';
        toggle.title = 'Recolher';
        toggle.setAttribute('aria-expanded', 'true');
      };

      head.addEventListener('click', () => toggleOpen());
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleOpen();
      });

      wrapper.appendChild(head);
      wrapper.appendChild(details);

      els.results.appendChild(wrapper);
    }
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
  await load();
};

export const screenFuncoes = {
  id: 'funcoes',
  title: 'Funções',
  // Only relevant for URA (endpoint exists only there).
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
