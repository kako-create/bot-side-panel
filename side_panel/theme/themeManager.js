import { APPEARANCE_DARK, APPEARANCE_LIGHT, APPEARANCE_SYSTEM } from '../../config/userSettings.js';

export { THEME_PRESETS, getThemePreset } from './presets/index.js';
export { applyPanelTheme } from './applyPanelTheme.js';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export const APPEARANCE_OPTIONS = Object.freeze([
  { value: APPEARANCE_LIGHT, label: 'Claro' },
  { value: APPEARANCE_DARK, label: 'Escuro' },
  { value: APPEARANCE_SYSTEM, label: 'Sistema' },
]);

export const watchSystemTheme = (onChange) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const media = window.matchMedia(SYSTEM_DARK_QUERY);
  const handler = () => {
    if (typeof onChange === 'function') onChange();
  };

  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }

  if (typeof media.addListener === 'function') {
    media.addListener(handler);
    return () => media.removeListener(handler);
  }

  return () => {};
};

