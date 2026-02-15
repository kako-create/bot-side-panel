import { DEFAULT_THEME_ID, normalizeThemeId } from '../../../config/userSettings.js';

import ligo from './ligo.preset.js';
import ocean from './ocean.preset.js';
import lago from './lago.preset.js';
import mint from './mint.preset.js';
import sunset from './sunset.preset.js';
import rose from './rose.preset.js';
import matrix from './matrix.preset.js';
import confete from './confete.preset.js';

export { DEFAULT_THEME_ID };

export const THEME_PRESETS = Object.freeze([ligo, ocean, lago, mint, sunset, rose, matrix, confete]);

export const THEME_PRESET_BY_ID = new Map(THEME_PRESETS.map((preset) => [preset.id, preset]));

export const getThemePreset = (themeId) =>
  THEME_PRESET_BY_ID.get(normalizeThemeId(themeId)) ||
  THEME_PRESET_BY_ID.get(DEFAULT_THEME_ID) ||
  THEME_PRESETS[0];
