import { botMode } from '../modes/bot/mode.js';
import { uraMode } from '../modes/ura/mode.js';

export const DEFAULT_MODE_ID = botMode.id;

export const MODES = Object.freeze({
  [botMode.id]: botMode,
  [uraMode.id]: uraMode,
});

export const getModeConfig = (modeId) => MODES[modeId] ?? MODES[DEFAULT_MODE_ID];
