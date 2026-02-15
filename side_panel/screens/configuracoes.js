import { sanitizeUserSettings, DEFAULT_USER_SETTINGS } from '../../config/userSettings.js';
import { getCurrentSettings, loadSettings, updateSettings, resetSettings } from '../runtimeSettings.js';
import { APPEARANCE_OPTIONS, THEME_PRESETS } from '../theme/themeManager.js';
import { PANEL_EVENTS } from '../panelEvents.js';

const TEMPLATE_ID = 'tpl-screen-configuracoes';

const createInitialState = () => ({
  settings: sanitizeUserSettings(DEFAULT_USER_SETTINGS),
  loading: false,
  saving: false,
  error: null,
  statusText: 'As alterações são salvas automaticamente.',
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
    appearanceOptions: q('#settings-appearance-options'),
    themeGrid: q('#settings-theme-grid'),
    autoSyncEnabled: q('#settings-auto-sync-enabled'),
    autoSyncFullItems: q('#settings-auto-sync-full-items'),
    autoSyncFullItemsHint: q('#settings-auto-sync-full-items-hint'),
    feedback: q('#settings-feedback'),
    resetBtn: q('#settings-reset'),
  };
};

const updateFeedback = () => {
  if (!els.feedback) return;
  els.feedback.classList.remove('settings-feedback--error', 'settings-feedback--success', 'settings-feedback--info');
  els.feedback.classList.add(`settings-feedback--${state.statusKind || 'info'}`);
  setText(els.feedback, state.statusText);
};

const buildAppearanceButton = (option) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'settings-mode-btn';
  button.textContent = option.label;
  button.dataset.value = option.value;

  if (state.settings.appearance === option.value) {
    button.classList.add('settings-mode-btn--active');
    button.setAttribute('aria-pressed', 'true');
  } else {
    button.setAttribute('aria-pressed', 'false');
  }
  button.disabled = Boolean(state.loading || state.saving);
  button.addEventListener('click', () => {
    if (state.settings.appearance === option.value) return;
    savePatch({ appearance: option.value });
  });
  return button;
};

const buildThemeCard = (preset) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'settings-theme-card';
  card.dataset.themeId = preset.id;
  card.disabled = Boolean(state.loading || state.saving);

  if (state.settings.themeId === preset.id) {
    card.classList.add('settings-theme-card--active');
    card.setAttribute('aria-pressed', 'true');
  } else {
    card.setAttribute('aria-pressed', 'false');
  }

  const preview = document.createElement('div');
  preview.className = 'settings-theme-preview';
  if (Array.isArray(preset.swatch) && preset.swatch.length >= 4) {
    preview.style.background = `conic-gradient(${preset.swatch[0]} 0 25%, ${preset.swatch[1]} 25% 50%, ${preset.swatch[2]} 50% 75%, ${preset.swatch[3]} 75% 100%)`;
  }
  card.appendChild(preview);

  if (preset.fun) {
    const badge = document.createElement('span');
    badge.className = 'settings-theme-badge';
    badge.textContent = 'Fun';
    card.appendChild(badge);
  }

  const label = document.createElement('span');
  label.className = 'settings-theme-label';
  label.textContent = preset.label;
  card.appendChild(label);

  card.addEventListener('click', () => {
    if (state.settings.themeId === preset.id) return;
    savePatch({ themeId: preset.id });
  });

  return card;
};

const renderAppearanceOptions = () => {
  if (!els.appearanceOptions) return;
  els.appearanceOptions.innerHTML = '';
  APPEARANCE_OPTIONS.forEach((option) => {
    els.appearanceOptions.appendChild(buildAppearanceButton(option));
  });
};

const renderThemeGrid = () => {
  if (!els.themeGrid) return;
  els.themeGrid.innerHTML = '';
  THEME_PRESETS.forEach((preset) => {
    els.themeGrid.appendChild(buildThemeCard(preset));
  });
};

const renderAutoSyncControls = () => {
  const settings = state.settings;
  const controlsDisabled = Boolean(state.loading || state.saving);
  const autoSyncEnabled = Boolean(settings.autoSyncEnabled);
  const fullItemsEnabled = Boolean(settings.autoSyncFullItems);

  if (els.autoSyncEnabled) {
    els.autoSyncEnabled.checked = autoSyncEnabled;
    els.autoSyncEnabled.disabled = controlsDisabled;
  }

  if (els.autoSyncFullItems) {
    els.autoSyncFullItems.checked = fullItemsEnabled;
    els.autoSyncFullItems.disabled = controlsDisabled || !autoSyncEnabled;
  }

  if (els.autoSyncFullItemsHint) {
    setText(
      els.autoSyncFullItemsHint,
      autoSyncEnabled
        ? 'Quando ativo, o auto sync executa também a busca avançada.'
        : 'Ative o auto sync para habilitar a busca avançada automática.',
    );
  }
};

const render = () => {
  renderAppearanceOptions();
  renderThemeGrid();
  renderAutoSyncControls();
  updateFeedback();
  if (els.resetBtn) {
    els.resetBtn.disabled = Boolean(state.loading || state.saving);
  }
};

async function savePatch(patch) {
  if (disposed || state.loading || state.saving) return;

  state.saving = true;
  state.error = null;
  state.statusKind = 'info';
  state.statusText = 'Salvando configuração...';
  render();

  try {
    const response = await updateSettings(patch);
    if (!response.ok) {
      const message = response.error?.message ?? 'Falha ao salvar.';
      state.error = message;
      state.statusKind = 'error';
      state.statusText = `Erro: ${message}`;
      return;
    }
    state.settings = sanitizeUserSettings(response.data?.settings ?? getCurrentSettings());
    state.statusKind = 'success';
    state.statusText = 'Configuração salva.';
  } catch (error) {
    const message = String(error?.message ?? error);
    state.error = message;
    state.statusKind = 'error';
    state.statusText = `Erro: ${message}`;
  } finally {
    state.saving = false;
    render();
  }
}

const onAutoSyncEnabledChange = () => {
  if (!els.autoSyncEnabled) return;
  savePatch({ autoSyncEnabled: Boolean(els.autoSyncEnabled.checked) });
};

const onAutoSyncFullItemsChange = () => {
  if (!els.autoSyncFullItems) return;
  savePatch({ autoSyncFullItems: Boolean(els.autoSyncFullItems.checked) });
};

const onResetClick = async () => {
  if (disposed || state.loading || state.saving) return;

  state.saving = true;
  state.error = null;
  state.statusKind = 'info';
  state.statusText = 'Restaurando padrão...';
  render();

  try {
    const response = await resetSettings();
    if (!response.ok) {
      const message = response.error?.message ?? 'Falha ao restaurar.';
      state.error = message;
      state.statusKind = 'error';
      state.statusText = `Erro: ${message}`;
      return;
    }
    state.settings = sanitizeUserSettings(response.data?.settings ?? getCurrentSettings());
    state.statusKind = 'success';
    state.statusText = 'Configurações restauradas para o padrão.';
  } catch (error) {
    const message = String(error?.message ?? error);
    state.error = message;
    state.statusKind = 'error';
    state.statusText = `Erro: ${message}`;
  } finally {
    state.saving = false;
    render();
  }
};

const bindEvents = () => {
  if (els.autoSyncEnabled) on(els.autoSyncEnabled, 'change', onAutoSyncEnabledChange);
  if (els.autoSyncFullItems) on(els.autoSyncFullItems, 'change', onAutoSyncFullItemsChange);
  if (els.resetBtn) on(els.resetBtn, 'click', onResetClick);

  const settingsChanged = (event) => {
    const next = event?.detail?.settings;
    if (!next || state.saving) return;
    state.settings = sanitizeUserSettings(next);
    render();
  };
  on(window, PANEL_EVENTS.SETTINGS_CHANGED, settingsChanged);
};

const init = async () => {
  state.loading = true;
  render();

  bindEvents();

  try {
    const loaded = await loadSettings();
    if (disposed) return;
    state.settings = sanitizeUserSettings(loaded);
    state.error = null;
    state.statusKind = 'info';
    state.statusText = 'As alterações são salvas automaticamente.';
  } catch (error) {
    state.error = String(error?.message ?? error);
    state.statusKind = 'error';
    state.statusText = `Erro ao carregar configurações: ${state.error}`;
  } finally {
    state.loading = false;
  }
  render();
};

export const screenConfiguracoes = {
  id: 'configuracoes',
  title: 'Configurações',
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
