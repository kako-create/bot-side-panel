import {
  APPEARANCE_DARK,
  APPEARANCE_LIGHT,
  APPEARANCE_SYSTEM,
  DEFAULT_THEME_ID,
  normalizeAppearance,
  normalizeThemeId,
} from '../config/userSettings.js';

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

export const APPEARANCE_OPTIONS = Object.freeze([
  { value: APPEARANCE_LIGHT, label: 'Claro' },
  { value: APPEARANCE_DARK, label: 'Escuro' },
  { value: APPEARANCE_SYSTEM, label: 'Sistema' },
]);

export const THEME_PRESETS = Object.freeze([
  {
    id: 'ligo',
    label: 'Ligo',
    fun: false,
    swatch: ['#4d70ff', '#d8deed', '#2e54eb', '#b6c6ed'],
    palette: {
      primary: '#4d70ff',
      primaryHover: '#2e54eb',
      primaryActive: '#223fd8',
      accent: '#ed6b00',
      accentHover: '#e04e15',
      highlight: '#ffdf80',
      gradientLight: 'none',
      gradientDark: 'none',
      patternLight: 'none',
      patternDark: 'none',
    },
  },
  {
    id: 'ocean',
    label: 'Oceano',
    fun: false,
    swatch: ['#1f68d5', '#ccdff5', '#0f4ea8', '#9fc6ec'],
    palette: {
      primary: '#1f68d5',
      primaryHover: '#1455b4',
      primaryActive: '#0f448f',
      accent: '#06a8be',
      accentHover: '#088ca0',
      highlight: '#9be7f1',
      gradientLight: 'linear-gradient(180deg, rgba(23, 132, 223, 0.16) 0%, rgba(242, 247, 252, 1) 60%)',
      gradientDark: 'linear-gradient(180deg, rgba(12, 84, 163, 0.34) 0%, rgba(11, 20, 34, 1) 68%)',
      patternLight: 'radial-gradient(circle at 84% -8%, rgba(41, 183, 214, 0.20), transparent 42%)',
      patternDark: 'radial-gradient(circle at 84% -8%, rgba(39, 160, 198, 0.36), transparent 42%)',
    },
  },
  {
    id: 'mint',
    label: 'Mint',
    fun: false,
    swatch: ['#16a085', '#cfeee8', '#0f7f69', '#9fdccf'],
    palette: {
      primary: '#16a085',
      primaryHover: '#0f7f69',
      primaryActive: '#0a6b57',
      accent: '#2d8f47',
      accentHover: '#24713a',
      highlight: '#9be5c0',
      gradientLight: 'linear-gradient(180deg, rgba(20, 181, 148, 0.18) 0%, rgba(243, 251, 248, 1) 60%)',
      gradientDark: 'linear-gradient(180deg, rgba(16, 125, 104, 0.34) 0%, rgba(10, 23, 22, 1) 67%)',
      patternLight: 'radial-gradient(circle at 8% 95%, rgba(26, 179, 146, 0.20), transparent 42%)',
      patternDark: 'radial-gradient(circle at 8% 95%, rgba(23, 150, 126, 0.34), transparent 44%)',
    },
  },
  {
    id: 'sunset',
    label: 'Sunset',
    fun: false,
    swatch: ['#d87528', '#f3d7c5', '#b65d1b', '#f0b78f'],
    palette: {
      primary: '#d87528',
      primaryHover: '#b65d1b',
      primaryActive: '#954a15',
      accent: '#b64767',
      accentHover: '#923452',
      highlight: '#ffd49a',
      gradientLight: 'linear-gradient(180deg, rgba(226, 140, 73, 0.22) 0%, rgba(253, 244, 237, 1) 62%)',
      gradientDark: 'linear-gradient(180deg, rgba(144, 77, 38, 0.40) 0%, rgba(31, 19, 16, 1) 72%)',
      patternLight: 'radial-gradient(circle at 92% 95%, rgba(210, 104, 48, 0.26), transparent 46%)',
      patternDark: 'radial-gradient(circle at 92% 95%, rgba(204, 97, 41, 0.30), transparent 46%)',
    },
  },
  {
    id: 'rose',
    label: 'Rose',
    fun: false,
    swatch: ['#b24f84', '#efd6e3', '#8f3b6a', '#e5abc5'],
    palette: {
      primary: '#b24f84',
      primaryHover: '#8f3b6a',
      primaryActive: '#752f56',
      accent: '#7a4fc9',
      accentHover: '#6037a9',
      highlight: '#f6b8d2',
      gradientLight: 'linear-gradient(180deg, rgba(196, 90, 146, 0.20) 0%, rgba(251, 242, 246, 1) 62%)',
      gradientDark: 'linear-gradient(180deg, rgba(123, 57, 98, 0.42) 0%, rgba(24, 13, 24, 1) 72%)',
      patternLight: 'radial-gradient(circle at 6% 8%, rgba(198, 104, 156, 0.26), transparent 42%)',
      patternDark: 'radial-gradient(circle at 6% 8%, rgba(183, 85, 141, 0.38), transparent 42%)',
    },
  },
  {
    id: 'matrix',
    label: 'Matrix',
    fun: true,
    swatch: ['#3cb66f', '#c3ebd1', '#1f7e45', '#95d9ad'],
    palette: {
      primary: '#2e9f5d',
      primaryHover: '#237f4a',
      primaryActive: '#1b633a',
      accent: '#69c948',
      accentHover: '#56ad39',
      highlight: '#b5f1a0',
      gradientLight: 'linear-gradient(180deg, rgba(64, 168, 98, 0.18) 0%, rgba(241, 252, 245, 1) 58%)',
      gradientDark: 'linear-gradient(180deg, rgba(34, 118, 63, 0.44) 0%, rgba(6, 19, 10, 1) 72%)',
      patternLight:
        'repeating-linear-gradient(90deg, rgba(37, 148, 76, 0.07) 0 2px, transparent 2px 18px), repeating-linear-gradient(180deg, rgba(37, 148, 76, 0.05) 0 1px, transparent 1px 18px)',
      patternDark:
        'repeating-linear-gradient(90deg, rgba(62, 180, 97, 0.14) 0 2px, transparent 2px 18px), repeating-linear-gradient(180deg, rgba(62, 180, 97, 0.10) 0 1px, transparent 1px 18px)',
    },
  },
  {
    id: 'confete',
    label: 'Confete',
    fun: true,
    swatch: ['#4d7aff', '#ff6fa5', '#ffd54a', '#5fe19d'],
    palette: {
      primary: '#4d7aff',
      primaryHover: '#345fe0',
      primaryActive: '#294cb9',
      accent: '#ff6fa5',
      accentHover: '#de4a84',
      highlight: '#ffd54a',
      gradientLight:
        'linear-gradient(145deg, rgba(77, 122, 255, 0.24) 0%, rgba(255, 111, 165, 0.20) 44%, rgba(255, 213, 74, 0.22) 100%)',
      gradientDark:
        'linear-gradient(145deg, rgba(77, 122, 255, 0.38) 0%, rgba(255, 111, 165, 0.28) 42%, rgba(255, 213, 74, 0.24) 100%)',
      patternLight:
        'radial-gradient(circle at 12% 20%, rgba(77, 122, 255, 0.30) 0 10px, transparent 11px), radial-gradient(circle at 82% 16%, rgba(255, 111, 165, 0.30) 0 9px, transparent 10px), radial-gradient(circle at 72% 82%, rgba(255, 213, 74, 0.32) 0 8px, transparent 9px), radial-gradient(circle at 24% 78%, rgba(95, 225, 157, 0.28) 0 7px, transparent 8px), radial-gradient(circle at 92% 72%, rgba(142, 112, 255, 0.26) 0 6px, transparent 7px)',
      patternDark:
        'radial-gradient(circle at 12% 20%, rgba(98, 138, 255, 0.36) 0 9px, transparent 10px), radial-gradient(circle at 82% 16%, rgba(255, 123, 175, 0.34) 0 8px, transparent 9px), radial-gradient(circle at 72% 82%, rgba(255, 216, 93, 0.32) 0 7px, transparent 8px), radial-gradient(circle at 24% 78%, rgba(113, 233, 173, 0.30) 0 6px, transparent 7px), radial-gradient(circle at 92% 72%, rgba(162, 132, 255, 0.30) 0 5px, transparent 6px)',
    },
  },
]);

const THEME_PRESET_BY_ID = new Map(THEME_PRESETS.map((preset) => [preset.id, preset]));

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

export const getThemePreset = (themeId) =>
  THEME_PRESET_BY_ID.get(normalizeThemeId(themeId)) ||
  THEME_PRESET_BY_ID.get(DEFAULT_THEME_ID) ||
  THEME_PRESETS[0];

const setCssVar = (rootStyle, name, value) => {
  if (!value) return;
  rootStyle.setProperty(name, String(value));
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

  setCssVar(rootStyle, '--color-bg', base.colorBg);
  setCssVar(rootStyle, '--color-surface', base.colorSurface);
  setCssVar(rootStyle, '--color-surface-2', base.colorSurface2);
  setCssVar(rootStyle, '--color-text', base.colorText);
  setCssVar(rootStyle, '--color-text-muted', base.colorTextMuted);
  setCssVar(rootStyle, '--color-border', base.colorBorder);
  setCssVar(rootStyle, '--color-danger', base.colorDanger);
  setCssVar(rootStyle, '--shadow', base.shadow);

  setCssVar(rootStyle, '--color-primary', palette.primary);
  setCssVar(rootStyle, '--color-primary-hover', palette.primaryHover);
  setCssVar(rootStyle, '--color-primary-active', palette.primaryActive);
  setCssVar(rootStyle, '--color-accent', palette.accent);
  setCssVar(rootStyle, '--color-accent-hover', palette.accentHover);
  setCssVar(rootStyle, '--color-highlight', palette.highlight);
  setCssVar(
    rootStyle,
    '--theme-gradient',
    effectiveMode === APPEARANCE_DARK ? palette.gradientDark : palette.gradientLight,
  );
  setCssVar(
    rootStyle,
    '--theme-pattern',
    effectiveMode === APPEARANCE_DARK ? palette.patternDark : palette.patternLight,
  );

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
