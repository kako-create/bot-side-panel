const MODE_URA = 'ura';

const normalizeMode = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === MODE_URA) return MODE_URA;
  return 'bot';
};

const titleize = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const withSpaces = raw
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  if (!withSpaces) return raw;
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
};

const extractRoot = (path) => {
  const raw = String(path ?? '').trim();
  if (!raw || raw === '(raiz)') return { root: '(raiz)', rest: '' };
  // root ends at first "." or "[".
  const dot = raw.indexOf('.');
  const bracket = raw.indexOf('[');
  const idx = dot === -1 ? bracket : bracket === -1 ? dot : Math.min(dot, bracket);
  if (idx === -1) return { root: raw, rest: '' };
  return { root: raw.slice(0, idx), rest: raw.slice(idx) };
};

const prettifyRest = (rest) => {
  const raw = String(rest ?? '').trim();
  if (!raw) return '';
  const withoutLeadingDot = raw.startsWith('.') ? raw.slice(1) : raw;
  // Replace "[0]" to "1" for friendlier display.
  const normalized = withoutLeadingDot.replace(/\[(\d+)\]/g, (_, idx) => ` ${Number(idx) + 1} `);
  return normalized.replace(/\s+/g, ' ').trim();
};

const LABELS_URA = Object.freeze({
  urlEndpoint: 'URL endpoint',
  jsonPayload: 'JSON payload',
  scriptCode: 'Script',
  headers: 'Header personalizado',
  header: 'Header personalizado',
  apiV2Variables: 'Variaveis',
  variables: 'Variaveis',
  tags: 'Tags',
  method: 'Metodo HTTP',
  httpMethod: 'Metodo HTTP',
});

const LABELS_BOT = Object.freeze({
  urlEndpoint: 'URL endpoint',
  jsonPayload: 'JSON payload',
  scriptCode: 'Script',
  headers: 'Header personalizado',
  header: 'Header personalizado',
  apiV2Variables: 'Variaveis',
  variables: 'Variaveis',
  tags: 'Tags',
  method: 'Metodo HTTP',
  httpMethod: 'Metodo HTTP',
});

const getLabelMap = (mode) => (normalizeMode(mode) === MODE_URA ? LABELS_URA : LABELS_BOT);

const resolveRootLabel = (mode, rootKey) => {
  const map = getLabelMap(mode);
  const key = String(rootKey ?? '').trim();
  if (!key) return '';
  return map[key] || titleize(key);
};

const createEl = (tag, className) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
};

const createValueRow = ({ badge, value }) => {
  const row = createEl('div', 'props-diff__value-row');
  const chip = createEl('span', 'props-diff__badge');
  chip.textContent = String(badge ?? '').trim() || '?';
  row.appendChild(chip);

  const text = createEl('pre', 'props-diff__value');
  text.textContent = value ?? '';
  row.appendChild(text);
  return row;
};

const groupDiffs = (diffs) => {
  const list = Array.isArray(diffs) ? diffs : [];
  const map = new Map();
  for (const diff of list) {
    const { root, rest } = extractRoot(diff?.path);
    const key = String(root || '(raiz)');
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...diff, __root: root, __rest: rest });
  }
  // Stable order: by root label-ish, then by path.
  const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return keys.map((key) => {
    const entries = map.get(key) || [];
    entries.sort((a, b) => String(a?.path ?? '').localeCompare(String(b?.path ?? ''), 'pt-BR'));
    return { rootKey: key, entries };
  });
};

export const createPropsDiffPanel = ({ diffs, mode, leftLabel = 'A', rightLabel = 'B', title } = {}) => {
  const wrapper = createEl('section', 'props-diff');
  const list = Array.isArray(diffs) ? diffs : [];

  const header = createEl('div', 'props-diff__header');
  const headerTitle = createEl('div', 'props-diff__title');
  headerTitle.textContent = title || 'Propriedades alteradas';
  header.appendChild(headerTitle);

  const meta = createEl('div', 'props-diff__meta');
  meta.textContent = String(list.length);
  header.appendChild(meta);
  wrapper.appendChild(header);

  if (!list.length) {
    const empty = createEl('div', 'muted');
    empty.textContent = 'Nenhuma propriedade alterada encontrada.';
    wrapper.appendChild(empty);
    return wrapper;
  }

  const groups = groupDiffs(list);
  const body = createEl('div', 'props-diff__body');
  for (const group of groups) {
    const section = createEl('div', 'props-diff__group');

    const groupHeader = createEl('div', 'props-diff__group-title');
    groupHeader.textContent = resolveRootLabel(mode, group.rootKey) || String(group.rootKey || '');
    section.appendChild(groupHeader);

    for (const entry of group.entries) {
      const item = createEl('div', 'props-diff__item');

      const restLabel = prettifyRest(entry.__rest);
      if (restLabel) {
        const sub = createEl('div', 'props-diff__item-subtitle');
        sub.textContent = restLabel;
        item.appendChild(sub);
      }

      const values = createEl('div', 'props-diff__values');
      values.appendChild(createValueRow({ badge: leftLabel, value: entry?.leftPreview ?? '' }));
      values.appendChild(createValueRow({ badge: rightLabel, value: entry?.rightPreview ?? '' }));
      item.appendChild(values);
      section.appendChild(item);
    }

    body.appendChild(section);
  }
  wrapper.appendChild(body);
  return wrapper;
};

