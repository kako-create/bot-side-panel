import { callBG, MessageType } from '../services/messaging.js';
import { DEFAULT_USER_SETTINGS, sanitizeUserSettings } from '../config/userSettings.js';

let currentSettings = sanitizeUserSettings(DEFAULT_USER_SETTINGS);

const dispatchSettingsChanged = (source = 'runtime') => {
  try {
    window.dispatchEvent(
      new CustomEvent('bot-sp:settings-changed', {
        detail: {
          source,
          settings: { ...currentSettings },
        },
      }),
    );
  } catch {
    // ignore
  }
};

const setCurrentSettings = (value, source = 'runtime') => {
  currentSettings = sanitizeUserSettings(value);
  dispatchSettingsChanged(source);
  return { ...currentSettings };
};

export const getCurrentSettings = () => ({ ...currentSettings });

export const loadSettings = async () => {
  try {
    const response = await callBG(MessageType.GET_SETTINGS);
    if (!response.ok) return getCurrentSettings();
    const next = response.data?.settings ?? DEFAULT_USER_SETTINGS;
    return setCurrentSettings(next, 'load');
  } catch {
    return getCurrentSettings();
  }
};

export const updateSettings = async (patch) => {
  const response = await callBG(MessageType.UPDATE_SETTINGS, { settings: patch ?? {} });
  if (response.ok && response.data?.settings) {
    setCurrentSettings(response.data.settings, 'update');
  }
  return response;
};

export const resetSettings = async () => {
  const response = await callBG(MessageType.RESET_SETTINGS);
  if (response.ok && response.data?.settings) {
    setCurrentSettings(response.data.settings, 'reset');
  }
  return response;
};

