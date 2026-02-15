import {
  APPEARANCE_DARK,
  APPEARANCE_LIGHT,
  normalizeAppearance,
} from '../../config/userSettings.js';

import { getThemePreset } from './presets/index.js';
import { mapToCssVars } from './tokens/mapToCssVars.js';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

const BASE_MODE = Object.freeze({
  [APPEARANCE_LIGHT]: {
    colorBg: '#f7fafc',
    colorSurface: '#ffffff',
    colorSurface2: '#f2f5fa',
    colorText: '#182236',
    colorTextMuted: '#677b92',
    colorBorder: '#e1e8f1',
    colorDanger: '#c0392b',
    shadow: '0 10px 24px rgba(24, 34, 54, 0.1)',
  },
  [APPEARANCE_DARK]: {
    colorBg: '#0f1729',
    colorSurface: '#152036',
    colorSurface2: '#1c2a42',
    colorText: '#e8eef9',
    colorTextMuted: '#a2b3cc',
    colorBorder: '#2a3c56',
    colorDanger: '#ff7b7b',
    shadow: '0 14px 30px rgba(3, 8, 19, 0.56)',
  },
});

const resolveEffectiveMode = (appearance) => {
  const normalized = normalizeAppearance(appearance);
  if (normalized === APPEARANCE_LIGHT || normalized === APPEARANCE_DARK) return normalized;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return APPEARANCE_LIGHT;
  return window.matchMedia(SYSTEM_DARK_QUERY).matches ? APPEARANCE_DARK : APPEARANCE_LIGHT;
};

export const applyPanelTheme = (settings = {}) => {
  if (typeof document === 'undefined') return null;

  const appearance = normalizeAppearance(settings.appearance);
  const effectiveMode = resolveEffectiveMode(appearance);
  const preset = getThemePreset(settings.themeId);
  const base = BASE_MODE[effectiveMode] || BASE_MODE[APPEARANCE_LIGHT];
  const palette = preset?.palette || {};
  const rootStyle = document.documentElement.style;
  const body = document.body;

  mapToCssVars(rootStyle, {
    '--color-bg': base.colorBg,
    '--color-surface': base.colorSurface,
    '--color-surface-2': base.colorSurface2,
    '--color-text': base.colorText,
    '--color-text-muted': base.colorTextMuted,
    '--color-border': base.colorBorder,
    '--color-danger': base.colorDanger,
    '--shadow': base.shadow,

    '--color-primary': palette.primary,
    '--color-primary-hover': palette.primaryHover,
    '--color-primary-active': palette.primaryActive,
    '--color-accent': palette.accent,
    '--color-accent-hover': palette.accentHover,
    '--color-highlight': palette.highlight,
    '--theme-gradient': effectiveMode === APPEARANCE_DARK ? palette.gradientDark : palette.gradientLight,
    '--theme-pattern': effectiveMode === APPEARANCE_DARK ? palette.patternDark : palette.patternLight,
  });

  document.documentElement.style.colorScheme = effectiveMode;
  if (body) {
    body.setAttribute('data-appearance', effectiveMode);
    body.setAttribute('data-theme-id', preset.id);
  }

  return {
    appearance,
    effectiveMode,
    themeId: preset.id,
  };
};

