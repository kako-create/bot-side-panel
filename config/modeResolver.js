export const MODE_BOT = 'bot';
export const MODE_URA = 'ura';
export const DEFAULT_MODE = MODE_BOT;

const BOT_PATH_RE = /\/bots\/([a-f0-9]{24})(?:\/|$)/i;
const BOT_PATH_LEGACY_RE = /\/bot\/([a-f0-9]{24})(?:\/|$)/i;
const URA_PATH_RE = /\/ivr\/([a-f0-9]{24})(?:\/|$)/i;

const getOriginFromUrl = (url) => {
  try {
    return new URL(String(url ?? '')).origin;
  } catch {
    return null;
  }
};

export const resolveContextFromUrl = (url) => {
  const value = String(url ?? '');
  const appBaseUrl = getOriginFromUrl(value);
  let match = value.match(URA_PATH_RE);
  if (match) return { mode: MODE_URA, botId: match[1], appBaseUrl };
  match = value.match(BOT_PATH_RE);
  if (match) return { mode: MODE_BOT, botId: match[1], appBaseUrl };
  match = value.match(BOT_PATH_LEGACY_RE);
  if (match) return { mode: MODE_BOT, botId: match[1], legacy: true, appBaseUrl };
  return { mode: null, botId: null, appBaseUrl };
};

export const normalizeMode = (mode) =>
  mode === MODE_URA || mode === MODE_BOT ? mode : DEFAULT_MODE;
