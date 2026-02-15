import { getTypeIconUrl } from '../icons.js';
import { getTypeLabel as getBotTypeLabel } from '../../modes/bot/typeLabels.js';
import { getTypeLabel as getUraTypeLabel } from '../../modes/ura/typeLabels.js';

const MODE_URA = 'ura';

const MAX_FIELDS = 5;
const MAX_TEXT_CHARS = 340;
const MAX_CODE_LINES = 8;

const normalizeMode = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === MODE_URA) return MODE_URA;
  return 'bot';
};

const normalizeKeys = (keys) => {
  const list = Array.isArray(keys) ? keys : [];
  const set = new Set();
  list.forEach((key) => {
    const value = String(key ?? '').trim();
    if (value) set.add(value);
  });
  return set;
};

const getIconsBasePath = (mode) => (normalizeMode(mode) === MODE_URA ? 'assets/svgs/ura' : 'assets/svgs/bot');

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const asText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => (typeof item === 'string' ? item : item == null ? '' : JSON.stringify(item)))
      .filter(Boolean);
    return parts.join('\n');
  }
  if (isPlainObject(value)) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const truncateText = (raw, maxChars = MAX_TEXT_CHARS) => {
  const value = String(raw ?? '').replace(/\r/g, '').trim();
  if (!value) return '';
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars - 1)}…`;
};

const truncateCode = (raw, maxLines = MAX_CODE_LINES) => {
  const value = String(raw ?? '').replace(/\r/g, '').trim();
  if (!value) return '';
  const lines = value.split('\n');
  if (lines.length <= maxLines) return value;
  return `${lines.slice(0, maxLines).join('\n')}\n…`;
};

const resolveFieldCandidates = (payload) => {
  if (!payload || typeof payload !== 'object') return [];

  const out = [];
  const pushIf = (key, label, value, { kind = 'text' } = {}) => {
    const text = asText(value);
    if (!String(text ?? '').trim()) return;
    out.push({ key, label, value: text, kind });
  };

  pushIf('description', 'Descrição', payload.description);
  pushIf('message', 'Mensagem', payload.message);
  pushIf('question', 'Pergunta', payload.question);
  pushIf('variable', 'Variável', payload.variable);
  pushIf('redirectTo', 'Destino', payload.redirectTo);
  pushIf('urlEndpoint', 'Endpoint', payload.urlEndpoint);
  pushIf('jsonPayload', 'Payload', payload.jsonPayload, { kind: 'code' });
  pushIf('scriptCode', 'Script', payload.scriptCode, { kind: 'code' });

  // Payloads aninhados comuns.
  pushIf('leia.question', 'Leia', payload.leia?.question);
  pushIf('chatgpt.prompt', 'Prompt', payload.chatgpt?.prompt, { kind: 'code' });

  return out.slice(0, MAX_FIELDS);
};

const createEl = (tag, className) => {
  const el = document.createElement(tag);
  if (className) el.className = className;
  return el;
};

const createField = ({ label, value, kind, changed }) => {
  const row = createEl('div', `block-preview__field${changed ? ' block-preview__field--changed' : ''}`);
  const name = createEl('div', 'block-preview__field-label');
  name.textContent = label;
  row.appendChild(name);

  const val = createEl('pre', `block-preview__field-value${kind === 'code' ? ' block-preview__field-value--code' : ''}`);
  val.textContent = kind === 'code' ? truncateCode(value) : truncateText(value);
  row.appendChild(val);
  return row;
};

const getModeTypeLabel = (mode, type) => (normalizeMode(mode) === MODE_URA ? getUraTypeLabel(type) : getBotTypeLabel(type));

const getNodeAccent = (mode, type) => {
  const normalizedMode = normalizeMode(mode);
  const raw = String(type ?? '').trim().toLowerCase();
  if (!raw) return normalizedMode === MODE_URA ? '#A638B8' : '#4d70ff';

  // Cards de API na plataforma sao roxos.
  if (raw.includes('apiv2') || raw.includes('api v2') || raw === 'api') return '#A638B8';

  // Alternativas simples por modo.
  return normalizedMode === MODE_URA ? '#6B5CF2' : '#4d70ff';
};

const createKebabIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 192 512');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('builder-node__kebab');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute(
    'd',
    'M96 184c39.8 0 72 32.2 72 72s-32.2 72-72 72-72-32.2-72-72 32.2-72 72-72zM24 80c0 39.8 32.2 72 72 72s72-32.2 72-72S135.8 8 96 8 24 40.2 24 80zm0 352c0 39.8 32.2 72 72 72s72-32.2 72-72-32.2-72-72-72-72 32.2-72 72z',
  );
  svg.appendChild(path);
  return svg;
};

const createEditIcon = () => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('builder-node__edit-icon');

  const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path1.setAttribute('fill', 'none');
  path1.setAttribute('d', 'M0 0h24v24H0z');
  svg.appendChild(path1);

  const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path2.setAttribute(
    'd',
    'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z',
  );
  svg.appendChild(path2);
  return svg;
};

const createBuilderNodePreview = ({ item, label, mode, changedKeys } = {}) => {
  const normalizedMode = normalizeMode(mode);
  const changed = normalizeKeys(changedKeys);

  const stage = createEl('div', `builder-stage builder-stage--${normalizedMode}`);
  const badge = createEl('div', 'builder-stage__badge');
  badge.textContent = String(label ?? '').trim() || '?';
  stage.appendChild(badge);

  if (!item) {
    const empty = createEl('div', 'muted');
    empty.textContent = 'Bloco indisponível no cache.';
    stage.appendChild(empty);
    return stage;
  }

  const payload = item.payload ?? {};
  const type = String(item.type ?? payload.type ?? '').trim();
  const typeLabel = getModeTypeLabel(normalizedMode, type);
  const title = String(item.title ?? payload.title ?? '').trim() || 'Sem título';

  const accent = getNodeAccent(normalizedMode, type);
  const node = createEl('div', `builder-node builder-node--${normalizedMode}`);
  node.style.setProperty('--node-accent', accent);

  const header = createEl('div', 'builder-node__header');

  const headerLeft = createEl('div', 'builder-node__header-left');
  const iconWrap = createEl('div', 'builder-node__icon-wrap');
  const iconUrl = type ? getTypeIconUrl(type, getIconsBasePath(normalizedMode)) : null;
  if (iconUrl) {
    const icon = document.createElement('img');
    icon.className = 'builder-node__icon';
    icon.alt = type;
    icon.src = iconUrl;
    icon.addEventListener('error', () => icon.remove());
    iconWrap.appendChild(icon);
  } else {
    const fallback = createEl('div', 'builder-node__icon-fallback');
    fallback.textContent = typeLabel ? String(typeLabel).slice(0, 1).toUpperCase() : '?';
    iconWrap.appendChild(fallback);
  }
  headerLeft.appendChild(iconWrap);

  const titles = createEl('div', 'builder-node__titles');
  const caption = createEl('div', 'builder-node__caption');
  caption.textContent = String(typeLabel ?? type ?? '').trim() || 'Bloco';
  titles.appendChild(caption);
  const name = createEl('div', 'builder-node__name');
  name.textContent = title;
  titles.appendChild(name);
  headerLeft.appendChild(titles);
  header.appendChild(headerLeft);

  const menu = createEl('button', 'builder-node__menu');
  menu.type = 'button';
  menu.disabled = true;
  menu.appendChild(createKebabIcon());
  header.appendChild(menu);
  node.appendChild(header);

  const endpointValue = payload.urlEndpoint ?? payload.endpoint ?? payload.url ?? payload.urlEndpoint ?? null;
  if (endpointValue) {
    const endpoint = createEl('div', `builder-node__endpoint${changed.has('urlEndpoint') ? ' builder-node__endpoint--changed' : ''}`);
    const arrow = createEl('div', 'builder-node__endpoint-arrow');
    arrow.textContent = '↗';
    endpoint.appendChild(arrow);

    const endpointText = createEl('div', 'builder-node__endpoint-text');
    endpointText.textContent = truncateText(String(endpointValue), 120);
    endpoint.appendChild(endpointText);
    node.appendChild(endpoint);
  }

  if (payload.jsonPayload) {
    const action = createEl(
      'button',
      `builder-node__action${changed.has('jsonPayload') ? ' builder-node__action--changed' : ''}`,
    );
    action.type = 'button';
    action.disabled = true;

    const icon = createEl('span', 'builder-node__action-icon');
    icon.appendChild(createEditIcon());
    action.appendChild(icon);

    const text = createEl('span', 'builder-node__action-text');
    text.textContent = 'Editar JSON payload';
    action.appendChild(text);
    node.appendChild(action);
  }

  stage.appendChild(node);
  return stage;
};

const createFallbackPreviewCard = ({ item, label, mode, changedKeys } = {}) => {
  const changed = normalizeKeys(changedKeys);
  const wrapper = createEl('section', 'block-preview');

  const header = createEl('div', 'block-preview__header');
  const badge = createEl('span', 'block-preview__badge');
  badge.textContent = String(label ?? '').trim() || '?';
  header.appendChild(badge);

  const titleWrap = createEl('div', 'block-preview__title-wrap');
  const top = createEl('div', 'block-preview__title-row');

  const iconUrl = item?.type ? getTypeIconUrl(item.type, getIconsBasePath(mode)) : null;
  if (iconUrl) {
    const icon = document.createElement('img');
    icon.className = 'block-preview__icon';
    icon.alt = item.type || '';
    icon.src = iconUrl;
    icon.addEventListener('error', () => icon.remove());
    top.appendChild(icon);
  }

  const title = createEl('div', 'block-preview__title');
  title.textContent = item?.title || item?.payload?.title || 'Sem título';
  top.appendChild(title);
  titleWrap.appendChild(top);

  const meta = createEl('div', 'block-preview__meta');
  const type = String(item?.type ?? '').trim() || '-';
  const id = String(item?.itemId ?? '').trim() || '-';
  meta.textContent = `${type}  •  ${id}`;
  titleWrap.appendChild(meta);

  header.appendChild(titleWrap);
  wrapper.appendChild(header);

  const body = createEl('div', 'block-preview__body');
  if (!item) {
    const empty = createEl('div', 'muted');
    empty.textContent = 'Bloco indisponível no cache.';
    body.appendChild(empty);
    wrapper.appendChild(body);
    return wrapper;
  }

  const payload = item.payload ?? {};
  const fields = resolveFieldCandidates(payload);
  if (!fields.length) {
    const empty = createEl('div', 'muted');
    const keysCount = payload && typeof payload === 'object' ? Object.keys(payload).length : 0;
    empty.textContent = keysCount ? `Sem campos textuais (payload com ${keysCount} chave(s)).` : 'Sem payload.';
    body.appendChild(empty);
    wrapper.appendChild(body);
    return wrapper;
  }

  const list = createEl('div', 'block-preview__fields');
  fields.forEach((field) => {
    list.appendChild(
      createField({
        label: field.label,
        value: field.value,
        kind: field.kind,
        changed: changed.has(field.key) || changed.has(field.key.split('.').shift()),
      }),
    );
  });
  body.appendChild(list);
  wrapper.appendChild(body);
  return wrapper;
};

export const createBlockComparePreview = ({
  leftItem,
  rightItem,
  mode,
  changedKeys,
  leftLabel = 'A',
  rightLabel = 'B',
} = {}) => {
  const wrapper = createEl('div', 'block-compare');
  wrapper.appendChild(createBuilderNodePreview({ item: leftItem, label: leftLabel, mode, changedKeys }));
  wrapper.appendChild(createBuilderNodePreview({ item: rightItem, label: rightLabel, mode, changedKeys }));
  return wrapper;
};

// Preview visual no estilo "grid" (especifico por modo).
export const createBlockGridPreviewCard = (args = {}) => createBuilderNodePreview(args);

// Export legado (mantido para reuso em outras paginas). Para visual "tipo plataforma", prefira `createBlockComparePreview`.
export const createBlockPreviewCard = (args = {}) => createFallbackPreviewCard(args);
