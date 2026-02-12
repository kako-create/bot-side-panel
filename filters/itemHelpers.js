export const normalizeText = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const readPathValues = (value, pathParts) => {
  if (value === null || value === undefined) return [];
  if (pathParts.length === 0) return [value];
  const [head, ...rest] = pathParts;
  if (Array.isArray(value)) {
    return value.flatMap((item) => readPathValues(item, pathParts));
  }
  if (typeof value !== 'object') return [];
  return readPathValues(value[head], rest);
};

export const getItemFieldValue = (item, path) => {
  const parts = String(path ?? '').split('.').filter(Boolean);
  if (parts.length === 0) return '';
  const values = readPathValues(item, parts);
  return normalizeText(values);
};
