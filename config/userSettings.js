import { AUTO_SYNC_ENABLED, AUTO_SYNC_FULL_ITEMS } from './flags.js';

export const USER_SETTINGS_KEY = 'bot_sp_user_settings_v1';

export const APPEARANCE_LIGHT = 'light';
export const APPEARANCE_DARK = 'dark';
export const APPEARANCE_SYSTEM = 'system';
export const DEFAULT_THEME_ID = 'ligo';

export const DEFAULT_USER_SETTINGS = Object.freeze({
  appearance: APPEARANCE_LIGHT,
  themeId: DEFAULT_THEME_ID,
  autoSyncEnabled: AUTO_SYNC_ENABLED,
  autoSyncFullItems: AUTO_SYNC_FULL_ITEMS,
  updatedAt: null,
});

const asBoolean = (value, fallback) => (typeof value === 'boolean' ? value : Boolean(fallback));

export const normalizeAppearance = (value) => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === APPEARANCE_LIGHT || raw === APPEARANCE_DARK || raw === APPEARANCE_SYSTEM) return raw;
  return DEFAULT_USER_SETTINGS.appearance;
};

export const normalizeThemeId = (value) => {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === 'classic') return 'ligo';
  if (!raw) return DEFAULT_USER_SETTINGS.themeId;
  if (!/^[a-z0-9_-]{1,40}$/.test(raw)) return DEFAULT_USER_SETTINGS.themeId;
  return raw;
};

const normalizeUpdatedAt = (value) => {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  return new Date(timestamp).toISOString();
};

export const sanitizeUserSettings = (value) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    appearance: normalizeAppearance(source.appearance),
    themeId: normalizeThemeId(source.themeId),
    autoSyncEnabled: asBoolean(source.autoSyncEnabled, DEFAULT_USER_SETTINGS.autoSyncEnabled),
    autoSyncFullItems: asBoolean(source.autoSyncFullItems, DEFAULT_USER_SETTINGS.autoSyncFullItems),
    updatedAt: normalizeUpdatedAt(source.updatedAt),
  };
};

export const mergeUserSettings = (current, patch) => {
  const base = sanitizeUserSettings(current);
  const delta = patch && typeof patch === 'object' ? patch : {};
  return sanitizeUserSettings({ ...base, ...delta, updatedAt: base.updatedAt });
};
