import { normalizeText } from '../../shared/utils.js';

const ID_LIKE_RE = /\b[a-f0-9]{24}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const DEFAULT_MERGE_DIFF_LIMIT = 80;

const sanitizeString = (value) =>
  String(value ?? '')
    .replace(ID_LIKE_RE, '<id>')
    .replace(UUID_RE, '<id>');

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const shouldIgnoreKey = (key) => {
  const raw = String(key ?? '');
  if (!raw) return false;
  if (/^_?id$/i.test(raw)) return true;
  if (/^__v$/i.test(raw)) return true;
  if (/(^|[_-])(id|ids)$/i.test(raw)) return true;
  if (/[a-z0-9](Id|Ids)$/.test(raw)) return true;

  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  const known = new Set([
    'itemid',
    'groupid',
    'botid',
    'flowid',
    'parentid',
    'childid',
    'destinationid',
    'sourceid',
    'redirecttoid',
    'updatedat',
    'positiononscreen',
  ]);
  return known.has(compact);
};

const sanitizePayload = (value) => {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map((item) => sanitizePayload(item));
  if (isPlainObject(value)) {
    const out = {};
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    keys.forEach((key) => {
      if (shouldIgnoreKey(key)) return;
      out[key] = sanitizePayload(value[key]);
    });
    return out;
  }
  if (typeof value === 'string') return sanitizeString(value);
  return value;
};

const collectScriptValues = (value, path = [], out = []) => {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => collectScriptValues(item, path, out));
    return out;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, child]) => {
      collectScriptValues(child, [...path, key], out);
    });
    return out;
  }
  const lastKey = path[path.length - 1] || '';
  if (!/(script|code)/i.test(lastKey)) return out;
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  const normalized = sanitizeString(raw).trim().replace(/\s+/g, ' ');
  if (normalized) out.push(normalized);
  return out;
};

const buildComparableItems = (records) =>
  (Array.isArray(records) ? records : []).map((record) => {
    const typeRaw = String(record?.type ?? '').trim() || 'Sem tipo';
    const titleRaw = String(record?.title ?? '').trim();
    const typeKey = normalizeText(typeRaw);
    const titleKey = normalizeText(titleRaw);
    const payload = sanitizePayload(record?.payload ?? {});
    const scriptValues = collectScriptValues(payload, [], []).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return {
      typeRaw,
      titleRaw,
      typeKey,
      titleKey,
      itemId: String(record?.itemId ?? ''),
      displayId: String(record?.displayId ?? record?.itemId ?? ''),
      groupId: String(record?.groupId ?? ''),
      flowExchangeId: String(record?.flowExchangeId ?? ''),
      reviewKind: String(record?.reviewKind ?? 'block'),
      payload,
      signature: JSON.stringify({ type: typeKey, title: titleKey, payload }),
      matchKey: `${typeKey}::${titleKey || '(sem-titulo)'}`,
      scriptSignature: scriptValues.length ? JSON.stringify(scriptValues) : '',
      source: record ?? null,
    };
  });

const countByKey = (items, keySelector) => {
  const map = new Map();
  items.forEach((item) => {
    const key = keySelector(item);
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
};

const getCommonCountFromMultisets = (leftMap, rightMap) => {
  let count = 0;
  const keys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  keys.forEach((key) => {
    count += Math.min(leftMap.get(key) || 0, rightMap.get(key) || 0);
  });
  return count;
};

const buildTypeRows = (leftItems, rightItems) => {
  const leftMap = countByKey(leftItems, (item) => item.typeRaw);
  const rightMap = countByKey(rightItems, (item) => item.typeRaw);
  const keys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const rows = Array.from(keys).map((type) => {
    const left = leftMap.get(type) || 0;
    const right = rightMap.get(type) || 0;
    return { type, left, right, diff: right - left };
  });
  rows.sort((a, b) => {
    const diffA = Math.abs(a.diff);
    const diffB = Math.abs(b.diff);
    if (diffA !== diffB) return diffB - diffA;
    return String(a.type).localeCompare(String(b.type), 'pt-BR');
  });
  return rows;
};

const groupByMatchKey = (items) => {
  const map = new Map();
  items.forEach((item) => {
    if (!map.has(item.matchKey)) map.set(item.matchKey, []);
    map.get(item.matchKey).push(item);
  });
  map.forEach((list) => {
    list.sort((a, b) => a.signature.localeCompare(b.signature));
  });
  return map;
};

const valueFingerprint = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const valuePreview = (value) => {
  if (value === undefined) return '<ausente>';
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else {
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
  }
  const compact = sanitizeString(raw).replace(/\s+/g, ' ').trim() || '""';
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 179)}…`;
};

const pushMergeDiff = (out, path, leftValue, rightValue) => {
  out.push({
    path: path || '(raiz)',
    leftPreview: valuePreview(leftValue),
    rightPreview: valuePreview(rightValue),
  });
};

const collectMergeDiff = (leftValue, rightValue, path = '', out = [], limit = DEFAULT_MERGE_DIFF_LIMIT) => {
  if (out.length >= limit) return out;

  const leftIsArray = Array.isArray(leftValue);
  const rightIsArray = Array.isArray(rightValue);
  if (leftIsArray || rightIsArray) {
    if (!(leftIsArray && rightIsArray)) {
      pushMergeDiff(out, path, leftValue, rightValue);
      return out;
    }
    const maxLen = Math.max(leftValue.length, rightValue.length);
    for (let idx = 0; idx < maxLen; idx += 1) {
      if (out.length >= limit) break;
      const childPath = `${path}[${idx}]`;
      const leftExists = idx < leftValue.length;
      const rightExists = idx < rightValue.length;
      if (!leftExists || !rightExists) {
        pushMergeDiff(out, childPath, leftExists ? leftValue[idx] : undefined, rightExists ? rightValue[idx] : undefined);
        continue;
      }
      collectMergeDiff(leftValue[idx], rightValue[idx], childPath, out, limit);
    }
    return out;
  }

  const leftIsObj = isPlainObject(leftValue);
  const rightIsObj = isPlainObject(rightValue);
  if (leftIsObj || rightIsObj) {
    if (!(leftIsObj && rightIsObj)) {
      pushMergeDiff(out, path, leftValue, rightValue);
      return out;
    }
    const keys = new Set([...Object.keys(leftValue), ...Object.keys(rightValue)]);
    Array.from(keys)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
      .forEach((key) => {
        if (out.length >= limit) return;
        const childPath = path ? `${path}.${key}` : key;
        const hasLeft = Object.prototype.hasOwnProperty.call(leftValue, key);
        const hasRight = Object.prototype.hasOwnProperty.call(rightValue, key);
        if (!hasLeft || !hasRight) {
          pushMergeDiff(out, childPath, hasLeft ? leftValue[key] : undefined, hasRight ? rightValue[key] : undefined);
          return;
        }
        collectMergeDiff(leftValue[key], rightValue[key], childPath, out, limit);
      });
    return out;
  }

  if (valueFingerprint(leftValue) !== valueFingerprint(rightValue)) {
    pushMergeDiff(out, path, leftValue, rightValue);
  }
  return out;
};

const diffTopLevelKeys = (leftPayload, rightPayload) => {
  if (!isPlainObject(leftPayload) || !isPlainObject(rightPayload)) return [];
  const keys = new Set([...Object.keys(leftPayload), ...Object.keys(rightPayload)]);
  const out = [];
  Array.from(keys)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .forEach((key) => {
      const leftValue = JSON.stringify(leftPayload[key]);
      const rightValue = JSON.stringify(rightPayload[key]);
      if (leftValue !== rightValue) out.push(key);
    });
  return out;
};

const compareItemsById = (leftItems, rightItems, { sampleLimit = 0, mergeDiffLimit = DEFAULT_MERGE_DIFF_LIMIT } = {}) => {
  const maxSamples = sampleLimit > 0 ? sampleLimit : Number.POSITIVE_INFINITY;

  const leftById = new Map();
  const rightById = new Map();
  leftItems.forEach((item, index) => {
    const key = item.itemId || `${item.matchKey}::left:${index}`;
    leftById.set(key, item);
  });
  rightItems.forEach((item, index) => {
    const key = item.itemId || `${item.matchKey}::right:${index}`;
    rightById.set(key, item);
  });

  const keys = Array.from(new Set([...leftById.keys(), ...rightById.keys()])).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  let changedCount = 0;
  let onlyLeftCount = 0;
  let onlyRightCount = 0;
  const changedSamples = [];
  const onlyLeftSamples = [];
  const onlyRightSamples = [];

  keys.forEach((key) => {
    const left = leftById.get(key) ?? null;
    const right = rightById.get(key) ?? null;

    if (left && right) {
      if (left.signature === right.signature) return;
      changedCount += 1;
      if (changedSamples.length >= maxSamples) return;
      const mergeDiff = collectMergeDiff(left.payload, right.payload, '', [], mergeDiffLimit);
      changedSamples.push({
        itemId: left.itemId || right.itemId || '',
        displayId: left.displayId || right.displayId || left.itemId || right.itemId || '',
        type: left.typeRaw || right.typeRaw || 'Sem tipo',
        title: left.titleRaw || right.titleRaw || 'Sem título',
        reviewKind: right.reviewKind || left.reviewKind || 'block',
        keys: diffTopLevelKeys(left.payload, right.payload),
        scriptChanged: left.scriptSignature !== right.scriptSignature,
        leftItemId: left.itemId,
        leftDisplayId: left.displayId || left.itemId || '',
        rightItemId: right.itemId,
        rightDisplayId: right.displayId || right.itemId || '',
        leftGroupId: left.groupId,
        rightGroupId: right.groupId,
        leftFlowExchangeId: left.flowExchangeId,
        rightFlowExchangeId: right.flowExchangeId,
        mergeDiff: mergeDiff.slice(0, mergeDiffLimit),
        leftItem: left.source ?? null,
        rightItem: right.source ?? null,
      });
      return;
    }

    if (left) {
      onlyLeftCount += 1;
      if (onlyLeftSamples.length >= maxSamples) return;
      onlyLeftSamples.push({
        itemId: left.itemId,
        displayId: left.displayId || left.itemId || '',
        type: left.typeRaw || 'Sem tipo',
        title: left.titleRaw || 'Sem título',
        reviewKind: left.reviewKind || 'block',
        groupId: left.groupId,
        item: left.source ?? null,
      });
      return;
    }

    if (!right) return;
    onlyRightCount += 1;
    if (onlyRightSamples.length >= maxSamples) return;
    onlyRightSamples.push({
      itemId: right.itemId,
      displayId: right.displayId || right.itemId || '',
      type: right.typeRaw || 'Sem tipo',
      title: right.titleRaw || 'Sem título',
      reviewKind: right.reviewKind || 'block',
      groupId: right.groupId,
      item: right.source ?? null,
    });
  });

  return {
    changedCount,
    onlyLeftCount,
    onlyRightCount,
    changedSamples,
    onlyLeftSamples,
    onlyRightSamples,
  };
};

export const compareFullItemCollections = (
  leftRaw,
  rightRaw,
  { sampleLimit = 0, mergeDiffLimit = DEFAULT_MERGE_DIFF_LIMIT } = {},
) => {
  const startedAt = Date.now();
  const leftItems = buildComparableItems(leftRaw);
  const rightItems = buildComparableItems(rightRaw);

  const leftSignatureMap = countByKey(leftItems, (item) => item.signature);
  const rightSignatureMap = countByKey(rightItems, (item) => item.signature);
  const commonBySignature = getCommonCountFromMultisets(leftSignatureMap, rightSignatureMap);

  const leftScriptMap = countByKey(
    leftItems.filter((item) => Boolean(item.scriptSignature)),
    (item) => item.scriptSignature,
  );
  const rightScriptMap = countByKey(
    rightItems.filter((item) => Boolean(item.scriptSignature)),
    (item) => item.scriptSignature,
  );
  const commonScripts = getCommonCountFromMultisets(leftScriptMap, rightScriptMap);

  const itemDiff = compareItemsById(leftItems, rightItems, { sampleLimit, mergeDiffLimit });
  const typeRows = buildTypeRows(leftItems, rightItems);
  const typeDiffCount = typeRows.filter((row) => row.diff !== 0).length;

  return {
    startedAt,
    durationMs: Date.now() - startedAt,
    totalLeft: leftItems.length,
    totalRight: rightItems.length,
    commonBySignature,
    typeDiffCount,
    typeRows,
    scriptsLeft: Array.from(leftScriptMap.values()).reduce((acc, value) => acc + value, 0),
    scriptsRight: Array.from(rightScriptMap.values()).reduce((acc, value) => acc + value, 0),
    commonScripts,
    ...itemDiff,
  };
};
