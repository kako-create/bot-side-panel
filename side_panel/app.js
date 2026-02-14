import { loadActiveScreenId, saveActiveScreenId } from './router.js';
import { screens, getScreenById } from './screens/index.js';
import { APPEARANCE_SYSTEM } from '../config/userSettings.js';
import * as featureFlags from '../config/flags.js';
import { callBG, MessageType } from '../services/messaging.js';
import { getCurrentSettings, loadSettings } from './runtimeSettings.js';
import { applyPanelTheme, watchSystemTheme } from './themes/themeManager.js';
import { setConfettiRainEnabled } from './themes/confettiRain.js';
import { setMatrixRainEnabled } from './themes/matrixRain.js';

const renderError = (root, message) => {
  if (!root) return;
  root.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'card surface';
  const title = document.createElement('h2');
  title.className = 'text-section-title';
  title.textContent = 'Erro';
  const body = document.createElement('p');
  body.className = 'muted';
  body.textContent = message || 'Falha ao carregar a tela.';
  card.appendChild(title);
  card.appendChild(body);
  root.appendChild(card);
};

export const initApp = async () => {
  const applyThemeAndEffects = (settings) => {
    const applied = applyPanelTheme(settings);
    const isMatrixTheme = applied?.themeId === 'matrix';
    const isConfettiTheme = applied?.themeId === 'confete';
    setMatrixRainEnabled(isMatrixTheme, applied);
    setConfettiRainEnabled(isConfettiTheme, applied);
  };

  await loadSettings();
  applyThemeAndEffects(getCurrentSettings());

  watchSystemTheme(() => {
    const settings = getCurrentSettings();
    if (settings.appearance === APPEARANCE_SYSTEM) {
      applyThemeAndEffects(settings);
    }
  });
  window.addEventListener('bot-sp:settings-changed', (event) => {
    applyThemeAndEffects(event?.detail?.settings ?? getCurrentSettings());
  });

  const screenSelect = document.getElementById('screen-select');
  const screenButton = document.getElementById('screen-button');
  const screenLabel = document.getElementById('screen-label');
  const screenMenu = document.getElementById('screen-menu');
  const appTitle = document.getElementById('app-title');
  const root = document.getElementById('screen-root');
  if (!screenSelect || !screenButton || !screenLabel || !screenMenu || !appTitle || !root) return;

  const normalizeModeValue = (mode) => {
    const raw = String(mode ?? '').trim().toLowerCase();
    if (raw === 'bot' || raw === 'ura') return raw;
    return null;
  };

  const isScreenEnabledForMode = (screen, mode) => {
    const requiredFlags = screen?.requiredFlags;
    if (Array.isArray(requiredFlags) && requiredFlags.length > 0) {
      for (const flagName of requiredFlags) {
        if (!featureFlags?.[flagName]) return false;
      }
    }

    const modes = screen?.modes;
    if (!Array.isArray(modes) || modes.length === 0) return true;
    if (!mode) return true;
    return modes.includes(mode);
  };

  let activeScreenId = null;
  /** @type {null | (() => void)} */
  let activeUnmount = null;
  let currentMode = 'bot';
  let visibleScreens = screens.slice();

  const closeMenu = () => {
    screenMenu.hidden = true;
    screenButton.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    screenMenu.hidden = false;
    screenButton.setAttribute('aria-expanded', 'true');
  };

  const computeVisibleScreens = (mode) => {
    const list = (screens || []).filter((screen) => isScreenEnabledForMode(screen, mode));
    if (list.length > 0) return list;
    // Fallback: if mode filtering yields an empty list, still respect feature flags.
    const fallback = (screens || []).filter((screen) => isScreenEnabledForMode(screen, null));
    return fallback.length > 0 ? fallback : screens.slice();
  };

  const renderMenu = () => {
    screenMenu.innerHTML = '';
    for (const screen of visibleScreens) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'type-select__option';
      option.dataset.value = screen.id;

      if (screen.id === activeScreenId) {
        option.classList.add('type-select__option--active');
        option.setAttribute('aria-current', 'page');
      }

      const text = document.createElement('span');
      text.className = 'type-select__label';
      text.textContent = screen.title;
      option.appendChild(text);

      option.addEventListener('click', () => {
        closeMenu();
        setActive(screen.id);
      });

      screenMenu.appendChild(option);
    }
  };

  const setActive = async (screenId) => {
    const screen = getScreenById(screenId);
    if (!screen) return;
    if (!isScreenEnabledForMode(screen, currentMode)) {
      const fallback = visibleScreens[0]?.id ?? null;
      if (fallback && fallback !== screenId) {
        await setActive(fallback);
      }
      return;
    }
    if (screenId === activeScreenId && typeof activeUnmount === 'function') return;

    try {
      if (typeof activeUnmount === 'function') {
        try {
          activeUnmount();
        } catch {
          // ignore
        }
      }
      activeUnmount = null;
      root.innerHTML = '';

      activeScreenId = screenId;
      appTitle.textContent = screen.title;
      screenLabel.textContent = screen.title;
      renderMenu();
      await saveActiveScreenId(screenId);

      const maybeUnmount = await screen.mount({ root });
      if (typeof maybeUnmount === 'function') activeUnmount = maybeUnmount;
    } catch (error) {
      renderError(root, error?.message ?? String(error));
    }
  };

  const refreshContextForMenu = async () => {
    try {
      const res = await callBG(MessageType.GET_CONTEXT);
      const nextMode = normalizeModeValue(res?.data?.context?.mode) || null;
      if (!nextMode) return;
      if (nextMode === currentMode) return;

      currentMode = nextMode;
      visibleScreens = computeVisibleScreens(currentMode);
      renderMenu();

      // If current screen is no longer enabled, move to the first available.
      const active = activeScreenId ? getScreenById(activeScreenId) : null;
      if (active && !isScreenEnabledForMode(active, currentMode)) {
        const fallback = visibleScreens[0]?.id ?? null;
        if (fallback) await setActive(fallback);
      }
    } catch {
      // ignore
    }
  };

  const onNavigate = (event) => {
    const nextScreenId = event?.detail?.screenId;
    if (!nextScreenId) return;
    closeMenu();
    setActive(nextScreenId);
  };
  window.addEventListener('bot-sp:navigate', onNavigate);

  screenButton.setAttribute('aria-expanded', 'false');
  screenButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (screenMenu.hidden) openMenu();
    else closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (!screenSelect.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  const saved = await loadActiveScreenId();
  await refreshContextForMenu();
  visibleScreens = computeVisibleScreens(currentMode);
  const savedScreen = saved ? getScreenById(saved) : null;
  const initial =
    (savedScreen && isScreenEnabledForMode(savedScreen, currentMode) ? savedScreen.id : null) ??
    visibleScreens[0]?.id ??
    null;
  activeScreenId = initial;
  renderMenu();
  if (initial) await setActive(initial);

  setInterval(() => refreshContextForMenu(), 2000);
};
