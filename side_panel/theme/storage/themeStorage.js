import { DEFAULT_USER_SETTINGS } from '../../../config/userSettings.js';
import { getCurrentSettings, updateSettings } from '../../runtimeSettings.js';

export const getThemeSettings = () => {
  const current = getCurrentSettings();
  return {
    appearance: current.appearance,
    themeId: current.themeId,
  };
};

export const setThemeSettings = async (patch = {}) => {
  const next = {};
  if (patch && typeof patch === 'object') {
    if ('appearance' in patch) next.appearance = patch.appearance;
    if ('themeId' in patch) next.themeId = patch.themeId;
  }
  return updateSettings(next);
};

export const resetThemeSettings = async () =>
  updateSettings({ appearance: DEFAULT_USER_SETTINGS.appearance, themeId: DEFAULT_USER_SETTINGS.themeId });

