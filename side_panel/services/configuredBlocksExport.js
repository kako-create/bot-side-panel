import { buildBlockLink } from '../links.js';
import { hasMenuOptionOverLength } from '../../shared/menuWarning.js';

const CELL_CHUNK_SIZE = 32000;

export const SUPPORTED_CONFIGURED_BLOCK_TYPES = Object.freeze([
  'Menu',
  'Card',
  'Human',
  'BotTransfer',
  'Text',
  'Redirect',
  'Conditional',
  'Script',
]);

const normalizeType = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const TYPE_ALIASES = new Map([
  ['menu', 'Menu'],
  ['card', 'Card'],
  ['human', 'Human'],
  ['humano', 'Human'],
  ['bottransfer', 'BotTransfer'],
  ['text', 'Text'],
  ['texto', 'Text'],
  ['redirect', 'Redirect'],
  ['direcionador', 'Redirect'],
  ['conditional', 'Conditional'],
  ['condicional', 'Conditional'],
  ['script', 'Script'],
]);

const TYPE_PATHS = [
  'type',
  'blockType',
  'itemType',
  'componentType',
  'data.type',
  'config.type',
  'data.config.type',
];

const COMMON_ROOTS = ['', 'data', 'config'];

const withCommonRoots = (paths = []) =>
  Array.from(
    new Set(
      paths.flatMap((path) =>
        COMMON_ROOTS.map((root) => (root ? `${root}.${path}` : path)),
      ),
    ),
  );

const TAG_PATHS = withCommonRoots(['tags', 'tags.name', 'tags.label']);
const TYPING_TIME_PATHS = withCommonRoots([
  'timeTypping',
  'typingTime',
  'typing.time',
  'typing.seconds',
]);
const EVENT_ACTIVE_PATHS = withCommonRoots([
  'eventDescription.active',
  'switchEventDescription',
  'eventDescriptionActive',
]);
const EVENT_TEXT_PATHS = withCommonRoots([
  'eventDescription.description',
  'eventDescription.text',
  'eventDescriptionText',
]);

const CARD_PATHS = Object.freeze({
  image: withCommonRoots([
    'image',
    'imageUrl',
    'image.url',
    'imageUrlCard',
    'cardImage',
    'cardImageUrl',
    'cardImage.url',
    'urlImage',
    'hero.image',
    'hero.imageUrl',
  ]),
  title: withCommonRoots(['cardTitle', 'title', 'card.title', 'header', 'label']),
  description: withCommonRoots([
    'cardDescription',
    'description',
    'card.description',
    'text',
    'body',
  ]),
  singleUrlMode: withCommonRoots([
    'cardIsUrlButton',
    'isUrlButton',
    'singleButton.isUrl',
    'singleButton.urlMode',
    'singleButton.mode',
  ]),
  singleButtonLabel: withCommonRoots([
    'singleButtonLabel',
    'singleButton.label',
    'singleButton.text',
    'singleButton.title',
    'buttons.0.label',
    'buttons.0.text',
    'buttons.0.title',
  ]),
  singleButtonValue: withCommonRoots([
    'singleButtonValue',
    'singleButton.url',
    'singleButton.value',
    'singleButton.link',
    'buttonUrl',
    'url',
  ]),
  buttonLabels: withCommonRoots([
    'buttons.label',
    'buttons.text',
    'buttons.title',
    'buttons.description',
    'menuItems.description',
    'options.label',
    'options.text',
  ]),
  buttonValues: withCommonRoots([
    'buttons.value',
    'buttons.url',
    'buttons.link',
    'buttons.payload',
    'menuItems.value',
    'menuItems.redirectTo',
    'options.value',
    'options.payload',
  ]),
  captureAnswer: withCommonRoots(['captureAnswer', 'saveAnswer', 'storeAnswer']),
  idleOn: withCommonRoots(['idleTime.on', 'idleTime.enabled', 'idle.on']),
  idleTimer: withCommonRoots([
    'idleTime.timer',
    'idleTime.minutes',
    'idle.timer',
    'idle.minutes',
  ]),
  idleItem: withCommonRoots([
    'idleTime.item',
    'idleTime.itemId',
    'idleTime.destination',
    'idle.item',
    'idle.destination',
  ]),
});

const HUMAN_PATHS = Object.freeze({
  queue: withCommonRoots([
    'humanAttendance',
    'humanAttendanceId',
    'humanAttendanceName',
    'queue',
    'queue.id',
    'queue.name',
    'queueId',
    'queueName',
    'selectedQueue',
    'human.queue',
    'attendance.queue',
  ]),
  preTransferText: withCommonRoots([
    'description',
    'preTransferText',
    'preTransferMessage',
    'messageBeforeTransfer',
    'phraseTransfer',
    'transferText',
  ]),
  showAgentName: withCommonRoots(['showAgentName', 'showAgent', 'displayAgentName']),
  respectSchedule: withCommonRoots([
    'respectSchedule',
    'checkSchedule',
    'scheduleValidation',
    'validateSchedule',
  ]),
  checkAgent: withCommonRoots([
    'checkAgent',
    'checkOnlineAgent',
    'checkAgentsOnline',
    'validateAgentOnline',
  ]),
  escapeCheckpoint: withCommonRoots([
    'checkpointEscape',
    'redirectToCheckpoint',
    'escape.checkpoint',
    'escape.redirectToCheckpoint',
  ]),
  escapeBlock: withCommonRoots([
    'humanEscape',
    'escape.item',
    'escape.itemId',
    'escape.destination',
    'escape.destinationId',
    'redirectTo',
    'redirectToItem',
    'redirectTo.id',
    'redirectTo.item',
    'redirectTo.itemId',
  ]),
});

const TEXT_PATHS = Object.freeze({
  description: ['description', 'text', 'label'],
  validationType: [
    'validationType',
    'validation.type',
    'validationType.value',
    'validation.type.value',
    'validation',
    'data.validationType',
    'data.validation.type',
    'data.validationType.value',
    'data.validation.type.value',
    'config.validationType',
    'config.validation.type',
  ],
  buttonsType: [
    'buttons.type',
    'buttons.mode',
    'buttons.display',
    'buttons.type.value',
    'buttons.display.value',
    'data.buttons.type',
    'data.buttons.mode',
    'data.buttons.display',
    'config.buttons.type',
    'validationType',
    'validation.type',
    'data.validationType',
    'data.validation.type',
    'config.validationType',
    'config.validation.type',
  ],
  buttonsVariable: [
    'buttons.variable',
    'buttons.variableName',
    'buttonsVariable',
    'data.buttons.variable',
    'data.buttons.variableName',
    'config.buttons.variable',
  ],
});

const REDIRECT_DESTINATION_PATHS = [
  'redirectTo',
  'redirectToItem',
  'redirectTo.id',
  'redirectTo.item',
  'redirectTo.itemId',
  'redirectToItemId',
];

const CONDITIONAL_PATHS = Object.freeze({
  type: ['conditions.type', 'conditions.context', 'conditionType'],
  operator: ['conditions.operator', 'conditions.rule', 'operator'],
  value: ['conditions.value', 'value'],
  destination: [
    'conditions.destination',
    'destination',
    'conditions.destinationId',
    'destinationId',
  ],
});

const SCRIPT_PATHS = Object.freeze({
  code: ['scriptCode', 'script', 'code', 'data.scriptCode', 'config.scriptCode'],
  errorMessage: [
    'errorMessageFinal',
    'escape.errorMessageFinal',
    'escape.message',
    'escape.text',
  ],
  destination: [
    'escapeDestination',
    'escape.destination',
    'escape.destinationId',
    'escape.item',
    'escape.itemId',
    'redirectTo',
    'redirectToItem',
    'redirectTo.id',
    'redirectTo.item',
    'redirectToItemId',
  ],
});

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const hasOwn = (source, key) =>
  Object.prototype.hasOwnProperty.call(source ?? {}, key);

const parseStructuredString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || !['[', '{'].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const getNestedValue = (source, path) => {
  if (source === null || source === undefined) return undefined;
  const parts = Array.isArray(path) ? path : String(path ?? '').split('.').filter(Boolean);
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current?.[part];
  }
  return current;
};

const readPathValues = (value, pathParts) => {
  if (value === null || value === undefined) return [];
  if (pathParts.length === 0) return [value];
  const [head, ...rest] = pathParts;

  if (Array.isArray(value)) {
    if (/^\d+$/.test(head)) {
      const indexed = value[Number(head)];
      return readPathValues(indexed, rest);
    }
    return value.flatMap((entry) => readPathValues(entry, pathParts));
  }
  if (typeof value !== 'object') return [];
  return readPathValues(value[head], rest);
};

const hasMeaningfulValue = (value, seen = new WeakSet()) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'bigint') {
    return true;
  }
  if (typeof value !== 'object') return true;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry, seen));
  if (value instanceof Date) return true;
  return Object.values(value).some((entry) => hasMeaningfulValue(entry, seen));
};

const pickFirstDefined = (source, paths = []) => {
  let fallback;
  let hasFallback = false;
  for (const path of paths) {
    const parts = Array.isArray(path) ? path : String(path ?? '').split('.').filter(Boolean);
    const values = readPathValues(source, parts).filter(
      (value) => value !== undefined && value !== null,
    );
    if (values.length === 0) continue;
    const candidate = values.length === 1 ? values[0] : values;
    if (!hasFallback) {
      fallback = candidate;
      hasFallback = true;
    }
    if (hasMeaningfulValue(candidate)) return candidate;
  }
  return hasFallback ? fallback : undefined;
};

const firstNonBlank = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (String(value).trim()) return value;
  }
  return '';
};

const resolveCanonicalTypeValue = (value) => TYPE_ALIASES.get(normalizeType(value)) ?? null;

const getDirectType = (source) =>
  pickFirstDefined(source, ['type', 'blockType', 'itemType', 'componentType']);

const getRecordPayload = (record) => {
  if (!isPlainObject(record)) return {};
  const nested = record.payload;
  if (!isPlainObject(nested)) return record;

  const looksLikeStoredRecord =
    hasOwn(record, 'titleFold') ||
    hasOwn(record, 'typeFold') ||
    hasOwn(record, 'itemId') ||
    hasOwn(record, 'groupId') ||
    hasOwn(record, 'botId');
  const outerType = resolveCanonicalTypeValue(getDirectType(record));
  const nestedType = resolveCanonicalTypeValue(getDirectType(nested));
  return looksLikeStoredRecord || outerType || nestedType ? nested : record;
};

const resolveConfiguredBlockType = (record) => {
  if (!isPlainObject(record)) return null;

  const directOuterType = getDirectType(record);
  if (directOuterType !== undefined && String(directOuterType).trim()) {
    return resolveCanonicalTypeValue(directOuterType);
  }

  const payload = getRecordPayload(record);
  const directPayloadType = getDirectType(payload);
  if (directPayloadType !== undefined && String(directPayloadType).trim()) {
    return resolveCanonicalTypeValue(directPayloadType);
  }

  for (const path of TYPE_PATHS.slice(4)) {
    const canonical = resolveCanonicalTypeValue(pickFirstDefined(payload, [path]));
    if (canonical) return canonical;
  }
  return null;
};

const getRecordSources = (record) => {
  const payload = getRecordPayload(record);
  return payload === record ? [record] : [payload, record];
};

const pickRecordValue = (record, paths = []) => {
  for (const source of getRecordSources(record)) {
    const value = pickFirstDefined(source, paths);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const isSensitiveKey = (key) => {
  const normalized = String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    normalized.includes('password') ||
    normalized.includes('passwd') ||
    normalized === 'pwd' ||
    normalized.includes('senha') ||
    normalized.includes('secret') ||
    normalized.includes('privatekey') ||
    normalized.includes('accesskey') ||
    normalized.includes('apikey') ||
    normalized === 'auth' ||
    normalized === 'authentication' ||
    normalized.includes('authorization') ||
    normalized.includes('token') ||
    normalized.includes('accesstoken') ||
    normalized.includes('refreshtoken') ||
    normalized === 'cookie' ||
    normalized === 'setcookie' ||
    normalized.includes('credential')
  );
};

const SENSITIVE_DESCRIPTOR_NAME_KEYS = new Set([
  'key',
  'name',
  'label',
  'header',
  'field',
]);

const SENSITIVE_DESCRIPTOR_VALUE_KEYS = new Set([
  'value',
  'content',
  'result',
  'text',
  'data',
]);

const isSensitiveDescriptorName = (value) => {
  const normalized = String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    isSensitiveKey(normalized) ||
    normalized.endsWith('auth') ||
    normalized.includes('signature') ||
    normalized.includes('sessionid')
  );
};

const getSensitiveDescriptorValueKeys = (source) => {
  if (!isPlainObject(source)) return new Set();
  const hasSensitiveName = Object.entries(source).some(([key, value]) =>
    SENSITIVE_DESCRIPTOR_NAME_KEYS.has(normalizeType(key)) &&
    isSensitiveDescriptorName(value));
  return hasSensitiveName ? SENSITIVE_DESCRIPTOR_VALUE_KEYS : new Set();
};

const hasConfiguredValue = (value) => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
};

const redactSensitive = (value, seen = new WeakMap()) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (seen.has(value)) return '[Circular]';

  if (Array.isArray(value)) {
    const output = [];
    seen.set(value, output);
    value.forEach((entry) => output.push(redactSensitive(entry, seen)));
    return output;
  }

  const output = {};
  seen.set(value, output);
  const sensitiveDescriptorValueKeys = getSensitiveDescriptorValueKeys(value);
  Object.entries(value).forEach(([key, nestedValue]) => {
    const normalizedKey = normalizeType(key);
    output[key] = isSensitiveKey(key) || sensitiveDescriptorValueKeys.has(normalizedKey)
      ? hasConfiguredValue(nestedValue)
        ? '[REDACTED]'
        : '[NÃO CONFIGURADO]'
      : redactSensitive(nestedValue, seen);
  });
  return output;
};

const stringifyValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? String(value) : value.toISOString();
  }

  const seen = new WeakSet();
  try {
    return JSON.stringify(
      value,
      (_key, nestedValue) => {
        if (typeof nestedValue === 'bigint') return String(nestedValue);
        if (nestedValue && typeof nestedValue === 'object') {
          if (seen.has(nestedValue)) return '[Circular]';
          seen.add(nestedValue);
        }
        return nestedValue;
      },
      2,
    );
  } catch {
    return String(value);
  }
};

const toCellValue = (value) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  return stringifyValue(value);
};

const normalizeDate = (value, fallback = null) => {
  const resolved = value ?? fallback;
  if (resolved === undefined || resolved === null || resolved === '') return '';
  const date = resolved instanceof Date ? resolved : new Date(resolved);
  if (Number.isNaN(date.getTime())) return String(resolved);
  return date.toISOString();
};

const getGroupLabel = (groupsById, groupId) => {
  if (!groupId) return '';
  let value;
  if (groupsById instanceof Map) {
    value = groupsById.get(groupId) ?? groupsById.get(String(groupId));
  } else if (Array.isArray(groupsById)) {
    value = groupsById.find((entry) =>
      String(entry?.groupId ?? entry?.id ?? entry?._id ?? '') === String(groupId));
  } else if (isPlainObject(groupsById)) {
    value = groupsById[groupId] ?? groupsById[String(groupId)];
  }

  if (isPlainObject(value)) {
    return String(value.title ?? value.label ?? value.name ?? groupId).trim();
  }
  return String(value ?? '').trim();
};

const appendHeader = (model) => {
  model.headerRows.push(model.rows.length);
  model.rows.push(['Descrição', 'Valor']);
};

const appendBlankRow = (model) => {
  model.rows.push(['', '']);
};

const appendField = (model, label, rawValue, { link = null } = {}) => {
  const value = toCellValue(rawValue);
  if (typeof value !== 'string' || value.length <= CELL_CHUNK_SIZE) {
    const rowIndex = model.rows.length;
    model.rows.push([String(label ?? ''), value]);
    if (link) model.links.push({ row: rowIndex, column: 1, target: link });
    return rowIndex;
  }

  let offset = 0;
  let chunkIndex = 0;
  let firstRowIndex = -1;
  while (offset < value.length) {
    let end = Math.min(offset + CELL_CHUNK_SIZE, value.length);
    if (end < value.length) {
      const lastCodeUnit = value.charCodeAt(end - 1);
      const nextCodeUnit = value.charCodeAt(end);
      const splitsSurrogatePair =
        lastCodeUnit >= 0xd800 &&
        lastCodeUnit <= 0xdbff &&
        nextCodeUnit >= 0xdc00 &&
        nextCodeUnit <= 0xdfff;
      if (splitsSurrogatePair) end -= 1;
    }

    const rowIndex = model.rows.length;
    const chunkLabel = chunkIndex === 0
      ? String(label ?? '')
      : `${String(label ?? '')} (continuação ${chunkIndex + 1})`;
    model.rows.push([chunkLabel, value.slice(offset, end)]);
    if (chunkIndex === 0 && link) {
      model.links.push({ row: rowIndex, column: 1, target: link });
    }
    if (firstRowIndex < 0) firstRowIndex = rowIndex;
    offset = end;
    chunkIndex += 1;
  }
  return firstRowIndex;
};

const appendFromPaths = (model, label, payload, paths) => {
  const value = pickFirstDefined(payload, paths);
  return appendField(
    model,
    label,
    value !== null && typeof value === 'object' ? redactSensitive(value) : value,
  );
};

const getFirstExactValue = (source, paths = []) => {
  let fallback;
  let hasFallback = false;
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value === undefined || value === null) continue;
    const parsed = parseStructuredString(value);
    if (!hasFallback) {
      fallback = parsed;
      hasFallback = true;
    }
    if (hasMeaningfulValue(parsed)) return parsed;
  }
  return hasFallback ? fallback : undefined;
};

const appendExpandedValue = (model, label, rawValue) => {
  const value = parseStructuredString(rawValue);
  if (value === undefined || value === null) {
    appendField(model, label, '');
    return;
  }

  const seen = new WeakSet();
  let appended = 0;
  const visit = (candidate, segments) => {
    if (candidate !== null && typeof candidate === 'object') {
      if (seen.has(candidate)) {
        appendField(model, [label, ...segments].join(' — '), '[Circular]');
        appended += 1;
        return;
      }
      seen.add(candidate);
    }

    if (Array.isArray(candidate)) {
      if (candidate.length === 0) {
        appendField(model, [label, ...segments].join(' — '), '[]');
        appended += 1;
        return;
      }
      candidate.forEach((entry, index) => visit(entry, [...segments, String(index + 1)]));
      return;
    }

    if (isPlainObject(candidate)) {
      const entries = Object.entries(candidate);
      if (entries.length === 0) {
        appendField(model, [label, ...segments].join(' — '), '{}');
        appended += 1;
        return;
      }
      const sensitiveDescriptorValueKeys = getSensitiveDescriptorValueKeys(candidate);
      entries.forEach(([key, nestedValue]) => {
        const normalizedKey = normalizeType(key);
        if (isSensitiveKey(key) || sensitiveDescriptorValueKeys.has(normalizedKey)) {
          appendField(
            model,
            [label, ...segments, key].join(' — '),
            hasConfiguredValue(nestedValue) ? '[REDACTED]' : '[NÃO CONFIGURADO]',
          );
          appended += 1;
          return;
        }
        visit(nestedValue, [...segments, key]);
      });
      return;
    }

    appendField(model, [label, ...segments].join(' — '), candidate);
    appended += 1;
  };

  visit(value, []);
  if (appended === 0) appendField(model, label, '');
};

const appendExpandedFromPaths = (model, label, payload, paths) =>
  appendExpandedValue(model, label, getFirstExactValue(payload, paths));

const createBlockLink = ({ botId, mode, appBaseUrl, data }) => {
  try {
    return buildBlockLink({
      botId,
      mode,
      appBaseUrl,
      itemId: data.itemId,
      groupId: data.groupId,
      flowExchangeId: data.flowExchangeId,
      searchValue: data.title || data.itemId,
    });
  } catch {
    return null;
  }
};

const extractReferences = (payload) => {
  const references = new Map();
  const pattern = /\$\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}|\{\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}\}|\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}/g;
  const seen = new WeakSet();

  const visit = (value, location) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      pattern.lastIndex = 0;
      let match = pattern.exec(value);
      while (match) {
        const name = String(match[1] ?? match[2] ?? match[3] ?? '').trim();
        const token = String(match[0] ?? '').trim();
        if (name) {
          if (!references.has(token)) {
            references.set(token, { name, token, locations: new Set() });
          }
          references.get(token).locations.add(location || '(raiz)');
        }
        match = pattern.exec(value);
      }
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${location}[${index}]`));
      return;
    }
    const sensitiveDescriptorValueKeys = getSensitiveDescriptorValueKeys(value);
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (isSensitiveKey(key)) return;
      if (sensitiveDescriptorValueKeys.has(normalizeType(key))) return;
      visit(nestedValue, location ? `${location}.${key}` : key);
    });
  };

  visit(payload, '');
  return Array.from(references.values(), ({ name, token, locations }) => ({
    name,
    token,
    locations: Array.from(locations),
  }));
};

const toValueList = (value) => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => toValueList(entry));
  return [value];
};

const appendNamedVariables = (model, label, value) => {
  const values = toValueList(value).filter((entry) => String(entry ?? '').trim());
  if (values.length === 0) return;
  values.forEach((entry, index) => {
    appendField(model, values.length === 1 ? label : `${label} ${index + 1}`, entry);
  });
};

const getConfiguredBlockData = (record) => {
  const payload = getRecordPayload(record);
  const type = resolveConfiguredBlockType(record);
  const itemId = firstNonBlank(
    record?.itemId,
    record?.displayId,
    record?._id,
    record?.id,
    pickFirstDefined(payload, ['_id', 'id', 'itemId']),
  );
  const title = firstNonBlank(
    record?.title,
    pickFirstDefined(payload, ['title', 'name', 'label']),
  );
  const groupId = firstNonBlank(
    record?.groupId,
    pickFirstDefined(payload, ['groupId', 'subflowId', 'group._id', 'group.id']),
  );

  return {
    payload,
    type,
    itemId,
    title,
    groupId,
    groupTitle: firstNonBlank(
      record?.groupTitle,
      pickFirstDefined(payload, ['groupTitle', 'group.title', 'group.name']),
    ),
    flowExchangeId: firstNonBlank(
      record?.flowExchangeId,
      pickFirstDefined(payload, ['flowExchangeId', 'exchangeId']),
    ),
  };
};

const appendSharedFields = (model, payload, type) => {
  if (['Menu', 'Card', 'Text'].includes(type) || hasOwn(payload, 'useIA')) {
    appendFromPaths(model, 'IA', payload, ['useIA']);
  }
  appendFromPaths(model, 'Acesso rápido', payload, ['quickAccess']);
  appendFromPaths(model, 'Checkpoint', payload, ['checkpoint']);
  appendFromPaths(model, 'Tags', payload, TAG_PATHS);
  if (type !== 'Conditional') {
    appendFromPaths(model, 'Tempo de digitação (segundos)', payload, TYPING_TIME_PATHS);
  }
};

const appendIdleFields = (model, payload, paths = null) => {
  if (paths) {
    appendFromPaths(model, 'Ociosidade ativa', payload, paths.idleOn);
    appendFromPaths(model, 'Ociosidade — Minutos', payload, paths.idleTimer);
    appendFromPaths(model, 'Ociosidade — Bloco de destino', payload, paths.idleItem);
    return;
  }
  appendFromPaths(model, 'Ociosidade ativa', payload, ['idleTime.on']);
  appendFromPaths(model, 'Ociosidade — Minutos', payload, ['idleTime.timer']);
  appendFromPaths(model, 'Ociosidade — Bloco de destino', payload, ['idleTime.item']);
};

const appendTriggerFields = (model, payload) => {
  appendFromPaths(model, 'Ignorar gatilho — Tempo', payload, ['ignoreTriggers.time']);
  appendFromPaths(model, 'Ignorar gatilho — Texto', payload, ['ignoreTriggers.message']);
  appendFromPaths(model, 'Ignorar gatilho — Áudio', payload, ['ignoreTriggers.audio']);
  appendFromPaths(model, 'Ignorar gatilho — Outras mídias', payload, ['ignoreTriggers.media']);
};

const appendEventFields = (model, payload) => {
  appendFromPaths(model, 'Descrição de evento ativa', payload, EVENT_ACTIVE_PATHS);
  appendFromPaths(model, 'Descrição do evento', payload, EVENT_TEXT_PATHS);
};

const appendMenuFields = (model, payload) => {
  appendFromPaths(model, 'Título do menu', payload, ['title']);
  appendFromPaths(model, 'Descrição / mensagem', payload, ['description']);
  appendFromPaths(model, 'Variável da resposta', payload, ['variable']);
  appendFromPaths(model, 'Validação', payload, ['validation']);
  appendFromPaths(model, 'Tipo de validação', payload, ['validationType']);
  appendFromPaths(model, 'Opções numéricas', payload, ['menuOptions.NumberOp']);
  appendFromPaths(model, 'Opções sugeridas', payload, ['menuOptions.SuggestionOp']);
  appendExpandedFromPaths(model, 'Itens do menu', payload, withCommonRoots(['menuItems']));
  appendExpandedFromPaths(model, 'Opções alternativas', payload, withCommonRoots(['options']));
  appendField(
    model,
    'Existe opção com mais de 20 caracteres',
    hasMenuOptionOverLength(payload, 20),
  );
  appendFromPaths(model, 'Armazenar opção escolhida', payload, ['captureAnswer']);
  appendFromPaths(model, 'Mensagem de erro de validação', payload, ['errorMessage']);
  appendFromPaths(model, 'Mensagem de finalização', payload, ['errorMessageFinal']);
  appendFromPaths(model, 'Quantidade máxima de tentativas', payload, ['maxTries']);
  appendIdleFields(model, payload);
  appendTriggerFields(model, payload);
  appendFromPaths(model, 'Rota de fuga', payload, ['conditionEscape']);
  appendFromPaths(model, 'Ativar último checkpoint', payload, [
    'redirectToCheckpoint',
    'checkpoint',
  ]);
  appendEventFields(model, payload);
  appendNamedVariables(model, 'Variável de saída', pickFirstDefined(payload, ['variable']));
};

const appendCardFields = (model, payload) => {
  appendFromPaths(model, 'URL / configuração da imagem', payload, CARD_PATHS.image);
  appendFromPaths(model, 'Título do card', payload, CARD_PATHS.title);
  appendFromPaths(model, 'Descrição do card', payload, CARD_PATHS.description);
  appendFromPaths(model, 'Botão único de URL', payload, CARD_PATHS.singleUrlMode);
  appendFromPaths(model, 'Texto do botão único', payload, CARD_PATHS.singleButtonLabel);
  appendFromPaths(model, 'Valor / URL do botão único', payload, CARD_PATHS.singleButtonValue);
  appendFromPaths(model, 'Textos dos botões', payload, CARD_PATHS.buttonLabels);
  appendFromPaths(model, 'Valores dos botões', payload, CARD_PATHS.buttonValues);
  appendExpandedFromPaths(model, 'Botão único', payload, withCommonRoots(['singleButton']));
  appendExpandedFromPaths(model, 'Botões', payload, withCommonRoots(['buttons']));
  appendExpandedFromPaths(model, 'Itens do menu', payload, withCommonRoots(['menuItems']));
  appendExpandedFromPaths(model, 'Opções', payload, withCommonRoots(['options']));
  appendFromPaths(model, 'Armazenar resposta', payload, CARD_PATHS.captureAnswer);
  appendIdleFields(model, payload, CARD_PATHS);
  appendEventFields(model, payload);
};

const appendHumanFields = (model, payload) => {
  appendFromPaths(model, 'Fila de atendimento', payload, HUMAN_PATHS.queue);
  appendFromPaths(model, 'Frase de pré-transferência', payload, HUMAN_PATHS.preTransferText);
  appendFromPaths(model, 'Exibir nome do agente', payload, HUMAN_PATHS.showAgentName);
  appendFromPaths(model, 'Respeitar dia e horário', payload, HUMAN_PATHS.respectSchedule);
  appendFromPaths(model, 'Checar atendentes online', payload, HUMAN_PATHS.checkAgent);
  appendFromPaths(model, 'Ativar último checkpoint no escape', payload, HUMAN_PATHS.escapeCheckpoint);
  appendFromPaths(model, 'Bloco de escape', payload, HUMAN_PATHS.escapeBlock);
  appendEventFields(model, payload);
};

const appendTextFields = (model, payload) => {
  appendFromPaths(model, 'Mensagem', payload, TEXT_PATHS.description);
  appendFromPaths(model, 'Armazenar resposta', payload, ['captureAnswer']);
  appendFromPaths(model, 'Variável da resposta', payload, ['variable']);
  appendFromPaths(model, 'Tipo de validação', payload, TEXT_PATHS.validationType);
  appendFromPaths(model, 'Validação / regex', payload, ['validation']);
  appendFromPaths(model, 'Resposta privada', payload, ['isPrivateResponse']);
  appendFromPaths(model, 'Mensagem de erro de validação', payload, ['errorMessage']);
  appendFromPaths(model, 'Mensagem de finalização', payload, ['errorMessageFinal']);
  appendFromPaths(model, 'Quantidade máxima de tentativas', payload, ['maxTries']);
  appendFromPaths(model, 'Modo de exibição dos botões', payload, TEXT_PATHS.buttonsType);
  appendFromPaths(model, 'Variável dos botões', payload, TEXT_PATHS.buttonsVariable);
  appendExpandedFromPaths(model, 'Configuração dos botões', payload, [
    'buttons',
    'data.buttons',
    'config.buttons',
  ]);
  appendIdleFields(model, payload);
  appendTriggerFields(model, payload);
  appendFromPaths(model, 'Rota de fuga', payload, ['conditionEscape']);
  appendFromPaths(model, 'Ativar último checkpoint', payload, [
    'redirectToCheckpoint',
    'checkpoint',
  ]);
  appendFromPaths(model, 'Texto alternativo', payload, ['alternativeText']);
  appendExpandedFromPaths(model, 'Textos alternativos', payload, ['alternativeTexts']);
  appendEventFields(model, payload);
  appendNamedVariables(model, 'Variável de saída', pickFirstDefined(payload, ['variable']));
  appendNamedVariables(
    model,
    'Variável usada nos botões',
    pickFirstDefined(payload, TEXT_PATHS.buttonsVariable),
  );
};

const appendRedirectFields = (model, payload) => {
  appendFromPaths(model, 'Ativar último checkpoint', payload, [
    'redirectToCheckpoint',
    'checkpoint',
  ]);
  appendFromPaths(model, 'Bloco de destino', payload, REDIRECT_DESTINATION_PATHS);
  appendEventFields(model, payload);
};

const getConditionEntries = (payload) => {
  const raw = parseStructuredString(getNestedValue(payload, 'conditions'));
  if (Array.isArray(raw)) return raw;
  if (isPlainObject(raw)) return [raw];
  return [];
};

const appendConditionalFields = (model, payload) => {
  appendFromPaths(model, 'Tipo / contexto da condicional', payload, CONDITIONAL_PATHS.type);
  appendFromPaths(model, 'Operador', payload, CONDITIONAL_PATHS.operator);
  appendFromPaths(model, 'Valor', payload, CONDITIONAL_PATHS.value);
  appendFromPaths(model, 'Bloco de destino', payload, CONDITIONAL_PATHS.destination);
  appendExpandedFromPaths(model, 'Condições', payload, ['conditions']);
  appendFromPaths(model, 'Ativar último checkpoint', payload, [
    'redirectToCheckpoint',
    'checkpoint',
  ]);
  appendFromPaths(model, 'Mensagem de finalização', payload, ['errorMessageFinal']);
  appendEventFields(model, payload);

  const topLevelType = pickFirstDefined(payload, ['conditionType']);
  getConditionEntries(payload).forEach((condition, index) => {
    if (!isPlainObject(condition)) return;
    const conditionType = firstNonBlank(condition.type, topLevelType);
    const normalizedConditionType = normalizeType(conditionType);
    if (normalizedConditionType !== 'variable' && normalizedConditionType !== 'variavel') return;
    const context = firstNonBlank(condition.context, condition.variable, condition.variableName);
    if (!context || ['variable', 'variavel'].includes(normalizeType(context))) return;
    appendNamedVariables(model, `Variável usada na condição ${index + 1}`, context);
  });
};

const appendScriptFields = (model, payload) => {
  appendFromPaths(model, 'Código do script', payload, SCRIPT_PATHS.code);
  appendFromPaths(model, 'Ativar último checkpoint', payload, [
    'redirectToCheckpoint',
    'checkpoint',
  ]);
  appendFromPaths(model, 'Mensagem de finalização', payload, SCRIPT_PATHS.errorMessage);
  appendFromPaths(model, 'Bloco de destino do escape', payload, SCRIPT_PATHS.destination);
  appendEventFields(model, payload);
};

/** Identifica exclusivamente os tipos BOT configuráveis suportados. */
export const isConfiguredBlockRecord = (record) => Boolean(resolveConfiguredBlockType(record));

/** Filtra registros suportados sem alterar sua ordem nem seus objetos. */
export const getConfiguredBlockRecords = (records) =>
  (Array.isArray(records) ? records : []).filter((record) => isConfiguredBlockRecord(record));

/**
 * Constrói o modelo vertical da futura aba "Blocos" sem acessar DOM ou SheetJS.
 */
export const buildConfiguredBlockExportRows = ({
  records = [],
  botId = '',
  botTitle = '',
  mode = 'bot',
  appBaseUrl = null,
  exportedAt = null,
  searchedAt = null,
  lastItemsSyncAt = null,
  criteria = null,
  truncated = false,
  groupsById = new Map(),
} = {}) => {
  const configuredRecords = getConfiguredBlockRecords(records);
  const exportDate = normalizeDate(exportedAt, new Date());
  const countsByType = Object.fromEntries(
    SUPPORTED_CONFIGURED_BLOCK_TYPES.map((type) => [type, 0]),
  );
  configuredRecords.forEach((record) => {
    const type = resolveConfiguredBlockType(record);
    if (type) countsByType[type] += 1;
  });

  const model = {
    rows: [],
    links: [],
    headerRows: [],
    configuredBlockCount: configuredRecords.length,
    countsByType,
    exportedAt: exportDate,
  };

  appendHeader(model);
  appendField(model, 'Exportação', 'Blocos configurados');
  appendField(model, 'Bot ID', botId);
  appendField(model, 'Bot', botTitle);
  appendField(model, 'Modo', mode);
  appendField(model, 'Exportado em', exportDate);
  appendField(model, 'Consulta executada em', normalizeDate(searchedAt));
  appendField(model, 'Última sincronização completa', normalizeDate(lastItemsSyncAt));
  appendField(model, 'Critérios da consulta', redactSensitive(criteria ?? ''));
  appendField(model, 'Resultado truncado', Boolean(truncated));
  appendField(model, 'Total de blocos configurados', configuredRecords.length);
  SUPPORTED_CONFIGURED_BLOCK_TYPES.forEach((type) => {
    appendField(model, `Total ${type}`, countsByType[type]);
  });
  appendField(
    model,
    'Aviso de segurança',
    'O arquivo pode conter dados pessoais, URLs privadas, regras e código. Chaves sensíveis estruturadas são redigidas; scripts são preservados integralmente.',
  );
  appendBlankRow(model);

  configuredRecords.forEach((record, index) => {
    const data = getConfiguredBlockData(record);
    const payload = data.payload;
    const resolvedBotId = firstNonBlank(
      botId,
      pickRecordValue(record, ['botId', 'bot._id', 'bot.id']),
    );
    const groupLabel = firstNonBlank(
      getGroupLabel(groupsById, data.groupId),
      data.groupTitle,
      data.groupId,
    );
    const blockLink = createBlockLink({
      botId: resolvedBotId,
      mode,
      appBaseUrl,
      data,
    });

    appendHeader(model);
    appendField(model, 'Bloco configurado', `${index + 1} de ${configuredRecords.length}`);
    appendField(model, 'Bot ID', resolvedBotId);
    appendField(model, 'ID do bloco', data.itemId);
    appendField(model, 'Nome do bloco', data.title);
    appendField(model, 'Tipo', data.type);
    appendField(model, 'Grupo', groupLabel);
    appendField(model, 'ID do grupo', data.groupId);
    appendField(model, 'Link do bloco', blockLink ?? '', { link: blockLink });
    appendSharedFields(model, payload, data.type);

    if (data.type === 'Menu') appendMenuFields(model, payload);
    if (data.type === 'Card') appendCardFields(model, payload);
    if (data.type === 'Human' || data.type === 'BotTransfer') {
      appendHumanFields(model, payload);
    }
    if (data.type === 'Text') appendTextFields(model, payload);
    if (data.type === 'Redirect') appendRedirectFields(model, payload);
    if (data.type === 'Conditional') appendConditionalFields(model, payload);
    if (data.type === 'Script') appendScriptFields(model, payload);

    const references = extractReferences(payload);
    if (references.length > 0) {
      references.forEach((reference, referenceIndex) => {
        appendField(
          model,
          `Referência usada ${referenceIndex + 1}`,
          `${reference.token} — ${reference.locations.join(', ')}`,
        );
      });
    } else {
      appendField(model, 'Referências usadas', '');
    }

    appendField(model, 'Configuração do bloco (JSON)', redactSensitive(payload));
    appendBlankRow(model);
  });

  return model;
};
