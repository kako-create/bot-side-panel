import { loadActiveScreenId, saveActiveScreenId } from './router.js';
import { screens, getScreenById } from './screens/index.js';
import { APPEARANCE_SYSTEM } from '../config/userSettings.js';
import { getCurrentSettings, loadSettings } from './runtimeSettings.js';
import { applyPanelTheme, watchSystemTheme } from './themeManager.js';

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
  await loadSettings();
  applyPanelTheme(getCurrentSettings());

  watchSystemTheme(() => {
    const settings = getCurrentSettings();
    if (settings.appearance === APPEARANCE_SYSTEM) {
      applyPanelTheme(settings);
    }
  });
  window.addEventListener('bot-sp:settings-changed', (event) => {
    applyPanelTheme(event?.detail?.settings ?? getCurrentSettings());
  });

  const screenSelect = document.getElementById('screen-select');
  const screenButton = document.getElementById('screen-button');
  const screenLabel = document.getElementById('screen-label');
  const screenMenu = document.getElementById('screen-menu');
  const appTitle = document.getElementById('app-title');
  const root = document.getElementById('screen-root');
  if (!screenSelect || !screenButton || !screenLabel || !screenMenu || !appTitle || !root) return;

  let activeScreenId = null;
  /** @type {null | (() => void)} */
  let activeUnmount = null;

  const closeMenu = () => {
    screenMenu.hidden = true;
    screenButton.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    screenMenu.hidden = false;
    screenButton.setAttribute('aria-expanded', 'true');
  };

  const renderMenu = () => {
    screenMenu.innerHTML = '';
    for (const screen of screens) {
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
  const initial = getScreenById(saved)?.id ?? screens[0]?.id ?? null;
  activeScreenId = initial;
  renderMenu();
  if (initial) await setActive(initial);
};
