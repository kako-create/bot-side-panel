const MENU_OPTION_TEXT_KEYS = ['description', 'text', 'label', 'title'];

const MENU_OPTION_PATHS = [
  ['menuItems'],
  ['data', 'menuItems'],
  ['config', 'menuItems'],
  ['options'],
  ['data', 'options'],
  ['config', 'options'],
  ['menuItems', 'description'],
  ['data', 'menuItems', 'description'],
  ['config', 'menuItems', 'description'],
];

const normalizeType = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const readPathValues = (value, pathParts) => {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(pathParts) || pathParts.length === 0) return [value];
  const [head, ...rest] = pathParts;
  if (Array.isArray(value)) {
    return value.flatMap((entry) => readPathValues(entry, pathParts));
  }
  if (typeof value !== 'object') return [];
  return readPathValues(value[head], rest);
};

const collectMenuOptionTexts = (raw) => {
  if (raw === null || raw === undefined) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((entry) => collectMenuOptionTexts(entry));
  }
  if (typeof raw === 'object') {
    return MENU_OPTION_TEXT_KEYS.flatMap((key) => collectMenuOptionTexts(raw[key]));
  }
  return [String(raw)];
};

const toPayload = (recordOrPayload) => {
  if (!recordOrPayload || typeof recordOrPayload !== 'object') return recordOrPayload;
  const isRecordLike =
    'itemId' in recordOrPayload ||
    'groupId' in recordOrPayload ||
    'titleFold' in recordOrPayload ||
    'typeFold' in recordOrPayload;
  if (isRecordLike && recordOrPayload.payload && typeof recordOrPayload.payload === 'object') {
    return recordOrPayload.payload;
  }
  return recordOrPayload;
};

export const isMenuType = (value) => {
  const normalized = normalizeType(value);
  if (!normalized) return false;
  if (normalized === 'menu') return true;
  return normalized.startsWith('menu ');
};

export const hasMenuOptionOverLength = (recordOrPayload, minLength = 20) => {
  const payload = toPayload(recordOrPayload);
  if (!payload || typeof payload !== 'object') return false;

  const candidates = MENU_OPTION_PATHS.flatMap((pathParts) => readPathValues(payload, pathParts));
  const texts = candidates
    .flatMap((value) => collectMenuOptionTexts(value))
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  return texts.some((text) => text.length > minLength);
};

export const shouldShowMenuWarning = (recordOrPayload, minLength = 20) => {
  const payload = toPayload(recordOrPayload);
  const type = recordOrPayload?.type ?? payload?.type ?? '';
  if (!isMenuType(type)) return false;
  return hasMenuOptionOverLength(payload, minLength);
};
