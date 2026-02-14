import { callBG, MessageType } from '../../services/messaging.js';

const TEMPLATE_ID = 'tpl-screen-debug';

const createInitialState = () => ({
  loading: false,
  clearing: false,
  exporting: false,
  enabled: false,
  count: 0,
  statusText: '',
  statusKind: 'info',
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
    summary: q('#debug-summary'),
    exportBtn: q('#debug-export'),
    clearBtn: q('#debug-clear'),
    feedback: q('#debug-feedback'),
  };
};

const updateFeedback = () => {
  if (!els.feedback) return;
  els.feedback.classList.remove('settings-feedback--error', 'settings-feedback--success', 'settings-feedback--info');
  els.feedback.classList.add(`settings-feedback--${state.statusKind || 'info'}`);
  els.feedback.hidden = !state.statusText;
  setText(els.feedback, state.statusText);
};

const render = () => {
  if (els.summary) {
    const base = state.enabled
      ? `Debug ativo (salvando no IndexedDB). Logs: ${state.count}`
      : `Debug desativado (flag). Logs no IndexedDB: ${state.count}`;
    setText(els.summary, base);
  }

  const busy = Boolean(state.loading || state.exporting || state.clearing);
  if (els.exportBtn) {
    els.exportBtn.disabled = busy;
    els.exportBtn.textContent = state.exporting ? 'Exportando...' : 'Exportar';
  }
  if (els.clearBtn) {
    els.clearBtn.disabled = busy;
    els.clearBtn.textContent = state.clearing ? 'Limpando...' : 'Limpar';
  }

  updateFeedback();
};

const loadStats = async () => {
  if (disposed) return;
  state.loading = true;
  render();

  try {
    const res = await callBG(MessageType.DEBUG_STATS);
    if (!res.ok) {
      state.enabled = false;
      state.count = 0;
      state.statusKind = 'error';
      state.statusText = res.error?.message ?? 'Falha ao ler debug.';
      return;
    }
    state.enabled = Boolean(res.data?.enabled);
    state.count = Number(res.data?.count ?? 0) || 0;
  } finally {
    state.loading = false;
    render();
  }
};

const downloadText = (filename, text) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
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

const onExport = async () => {
  if (disposed || state.loading || state.exporting || state.clearing) return;

  state.exporting = true;
  state.statusKind = 'info';
  state.statusText = 'Gerando arquivo...';
  render();

  try {
    const res = await callBG(MessageType.DEBUG_EXPORT);
    if (!res.ok) {
      state.statusKind = 'error';
      state.statusText = res.error?.message ?? 'Falha ao exportar.';
      return;
    }

    const logs = Array.isArray(res.data?.logs) ? res.data.logs : [];
    const exportedAt = new Date().toISOString();
    const meta = { exportedAt, count: logs.length };
    const lines = [JSON.stringify({ __meta: meta })];
    for (const item of logs) {
      try {
        lines.push(JSON.stringify(item));
      } catch {
        // ignore invalid entries
      }
    }
    const text = `${lines.join('\n')}\n`;
    const safeDate = exportedAt.replace(/[:.]/g, '-');
    downloadText(`bot-side-panel-debug_${safeDate}.jsonl`, text);

    state.statusKind = 'success';
    state.statusText = `Exportado: ${logs.length} log(s).`;
  } finally {
    state.exporting = false;
    await loadStats();
  }
};

const onClear = async () => {
  if (disposed || state.loading || state.exporting || state.clearing) return;

  state.clearing = true;
  state.statusKind = 'info';
  state.statusText = 'Limpando logs...';
  render();

  try {
    const res = await callBG(MessageType.DEBUG_CLEAR);
    if (!res.ok) {
      state.statusKind = 'error';
      state.statusText = res.error?.message ?? 'Falha ao limpar.';
      return;
    }
    state.statusKind = 'success';
    state.statusText = 'Logs apagados.';
  } finally {
    state.clearing = false;
    await loadStats();
  }
};

const init = async () => {
  if (els.exportBtn) on(els.exportBtn, 'click', onExport);
  if (els.clearBtn) on(els.clearBtn, 'click', onClear);
  await loadStats();
};

export const screenDebug = {
  id: 'debug',
  title: 'Debug',
  // Only show when debug logging is enabled via feature flag.
  requiredFlags: ['DEBUG_SAVE_NETWORK_LOGS'],
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
