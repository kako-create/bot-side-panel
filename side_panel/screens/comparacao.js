import { callBG, MessageType } from '../../services/messaging.js';
import { getFullItemById, searchFullItems } from '../../data/db.js';
import { normalizeText } from '../../shared/utils.js';
import { buildBlockLink } from '../links.js';
import { createBlockGridPreviewCard } from '../components/blockComparePreview.js';
import { createPropsDiffPanel } from '../components/propsDiffPanel.js';

const TEMPLATE_ID = 'tpl-screen-comparacao';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';

const createInitialState = () => ({
  records: [],
  loading: false,
  comparing: false,
  error: null,
  appBaseUrl: null,
  leftId: '',
  rightId: '',
  propertyFilter: '',
  comparison: null,
  detailsOpenAll: false,
  openDetailGroups: {},
  openChangedRows: {},
});

let rootEl = null;
let state = createInitialState();
let els = {};
let disposed = false;
let cleanupFns = [];

const on = (target, event, handler, options) => {
  if (!target) return;
  target.addEventListener(event, handler, options);
  cleanupFns.push(() => target.removeEventListener(event, handler, options));
};

const setText = (el, value) => {
  if (!el) return;
  el.textContent = value ?? '';
};

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  return {
    left: q('#cmp-left'),
    right: q('#cmp-right'),
    refresh: q('#cmp-refresh'),
    run: q('#cmp-run'),
    propertySection: q('#cmp-property-section'),
    propertyFilter: q('#cmp-property-filter'),
    propertyClear: q('#cmp-property-clear'),
    propertySummary: q('#cmp-property-summary'),
    detailsToggle: q('#cmp-groups-toggle'),
    validation: q('#cmp-validation'),
    pair: q('#cmp-pair'),
    summary: q('#cmp-summary'),
    details: q('#cmp-details'),
  };
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const formatDuration = (ms) => {
  const value = Number(ms) || 0;
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(2)} s`;
};

const modeLabel = (mode) => {
  if (mode === MODE_URA) return 'URA';
  if (mode === MODE_BOT) return 'BOT';
  return '?';
};

const normalizeMode = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const compareByRecentSync = (a, b) => {
  const dateA = new Date(a?.lastItemsSyncAt || 0).getTime();
  const dateB = new Date(b?.lastItemsSyncAt || 0).getTime();
  return dateB - dateA;
};

const getRecordById = (botId) =>
  (Array.isArray(state.records) ? state.records : []).find((item) => item.botId === botId) ?? null;

const getValidation = () => {
  if (state.loading) return { ready: false, message: 'Carregando registros sincronizados...' };
  if (state.comparing) return { ready: false, message: 'Comparação em andamento...' };

  const records = Array.isArray(state.records) ? state.records : [];
  if (records.length === 0) {
    return { ready: false, message: 'Nenhum registro com sync completa encontrado no armazenamento.' };
  }
  if (!state.leftId || !state.rightId) {
    return { ready: false, message: 'Selecione dois registros para comparar.' };
  }
  if (state.leftId === state.rightId) {
    return { ready: false, message: 'Selecione registros diferentes.' };
  }

  const left = getRecordById(state.leftId);
  const right = getRecordById(state.rightId);
  if (!left || !right) {
    return { ready: false, message: 'Seleção inválida. Atualize a lista de registros.' };
  }
  if (!left.mode || !right.mode) {
    return {
      ready: false,
      message: 'Modo indefinido em um dos registros. Execute "Sinc. Busca avançada" para identificar BOT/URA.',
    };
  }
  if (left.mode !== right.mode) {
    return {
      ready: false,
      message: 'Comparação inválida: BOT e URA têm estruturas diferentes e não podem ser comparados entre si.',
    };
  }
  return { ready: true, message: `Pronto para comparar (${modeLabel(left.mode)}).` };
};

const updatePairLabel = () => {
  const left = getRecordById(state.leftId);
  const right = getRecordById(state.rightId);
  if (!left || !right) {
    setText(els.pair, '-');
    return;
  }
  const leftLabel = left.botTitle || left.botId;
  const rightLabel = right.botTitle || right.botId;
  setText(els.pair, `${leftLabel}  x  ${rightLabel}`);
};

const buildSelectLabel = (record) => {
  const title = record?.botTitle || record?.botId || '-';
  const id = record?.botId || '-';
  const mode = modeLabel(record?.mode);
  const sync = formatDate(record?.lastItemsSyncAt);
  return `${title} (${id}) | ${mode} | Full: ${sync}`;
};

const fillSelect = (selectEl, selectedId) => {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Selecione um registro';
  selectEl.appendChild(first);

  const records = Array.isArray(state.records) ? state.records : [];
  for (const record of records) {
    const option = document.createElement('option');
    option.value = record.botId;
    option.textContent = buildSelectLabel(record);
    selectEl.appendChild(option);
  }
  selectEl.value = selectedId || '';
};

const renderSelectors = () => {
  fillSelect(els.left, state.leftId);
  fillSelect(els.right, state.rightId);
};

const updateControls = () => {
  const validation = getValidation();
  if (els.run) {
    els.run.disabled = !validation.ready || state.comparing;
    els.run.textContent = state.comparing ? 'Comparando...' : 'Comparar registros';
  }
  if (els.refresh) {
    els.refresh.disabled = state.loading || state.comparing;
    els.refresh.textContent = state.loading ? 'Atualizando...' : 'Atualizar lista';
  }
  if (els.validation) {
    const message = state.error ? `Erro: ${state.error}` : validation.message;
    setText(els.validation, message);
  }
  if (els.detailsToggle) {
    const hasComparison = Boolean(state.comparison);
    els.detailsToggle.disabled = !hasComparison;
    els.detailsToggle.textContent = state.detailsOpenAll ? 'Fechar grupos' : 'Abrir grupos';
  }
  updatePairLabel();
};

const ID_LIKE_RE = /\b[a-f0-9]{24}\b/gi;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const CHANGED_SAMPLE_LIMIT = 0; // 0 = sem limite (lista tudo)
const MERGE_DIFF_LIMIT = 80;

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
      groupId: String(record?.groupId ?? ''),
      payload,
      signature: JSON.stringify({ type: typeKey, title: titleKey, payload }),
      matchKey: `${typeKey}::${titleKey || '(sem-titulo)'}`,
      scriptSignature: scriptValues.length ? JSON.stringify(scriptValues) : '',
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

const collectMergeDiff = (leftValue, rightValue, path = '', out = []) => {
  if (out.length >= MERGE_DIFF_LIMIT) return out;
  const leftIsArray = Array.isArray(leftValue);
  const rightIsArray = Array.isArray(rightValue);
  if (leftIsArray || rightIsArray) {
    if (!(leftIsArray && rightIsArray)) {
      pushMergeDiff(out, path, leftValue, rightValue);
      return out;
    }
    const maxLen = Math.max(leftValue.length, rightValue.length);
    for (let idx = 0; idx < maxLen; idx += 1) {
      if (out.length >= MERGE_DIFF_LIMIT) break;
      const childPath = `${path}[${idx}]`;
      const leftExists = idx < leftValue.length;
      const rightExists = idx < rightValue.length;
      if (!leftExists || !rightExists) {
        pushMergeDiff(out, childPath, leftExists ? leftValue[idx] : undefined, rightExists ? rightValue[idx] : undefined);
        continue;
      }
      collectMergeDiff(leftValue[idx], rightValue[idx], childPath, out);
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
        if (out.length >= MERGE_DIFF_LIMIT) return;
        const childPath = path ? `${path}.${key}` : key;
        const hasLeft = Object.prototype.hasOwnProperty.call(leftValue, key);
        const hasRight = Object.prototype.hasOwnProperty.call(rightValue, key);
        if (!hasLeft || !hasRight) {
          pushMergeDiff(out, childPath, hasLeft ? leftValue[key] : undefined, hasRight ? rightValue[key] : undefined);
          return;
        }
        collectMergeDiff(leftValue[key], rightValue[key], childPath, out);
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

const compareItems = (leftItems, rightItems) => {
  const sampleLimit = CHANGED_SAMPLE_LIMIT > 0 ? CHANGED_SAMPLE_LIMIT : Number.POSITIVE_INFINITY;
  const leftByKey = groupByMatchKey(leftItems);
  const rightByKey = groupByMatchKey(rightItems);
  const keys = Array.from(new Set([...leftByKey.keys(), ...rightByKey.keys()])).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );

  let changedCount = 0;
  let onlyLeftCount = 0;
  let onlyRightCount = 0;
  const changedSamples = [];
  const onlyLeftSamples = [];
  const onlyRightSamples = [];

  keys.forEach((key) => {
    const leftList = leftByKey.get(key) || [];
    const rightList = rightByKey.get(key) || [];
    const pairCount = Math.min(leftList.length, rightList.length);

    for (let idx = 0; idx < pairCount; idx += 1) {
      const left = leftList[idx];
      const right = rightList[idx];
      if (left.signature === right.signature) continue;
      changedCount += 1;
      if (changedSamples.length >= sampleLimit) continue;
      const mergeDiff = collectMergeDiff(left.payload, right.payload, '', []);
      changedSamples.push({
        type: left.typeRaw || right.typeRaw || 'Sem tipo',
        title: left.titleRaw || right.titleRaw || 'Sem título',
        keys: diffTopLevelKeys(left.payload, right.payload),
        scriptChanged: left.scriptSignature !== right.scriptSignature,
        leftItemId: left.itemId,
        rightItemId: right.itemId,
        leftGroupId: left.groupId,
        rightGroupId: right.groupId,
        mergeDiff: mergeDiff.slice(0, MERGE_DIFF_LIMIT),
      });
    }

    if (leftList.length > pairCount) {
      const diff = leftList.length - pairCount;
      onlyLeftCount += diff;
      leftList.slice(pairCount, pairCount + Math.max(0, sampleLimit - onlyLeftSamples.length)).forEach((item) => {
        onlyLeftSamples.push({
          type: item.typeRaw || 'Sem tipo',
          title: item.titleRaw || 'Sem título',
        });
      });
    }
    if (rightList.length > pairCount) {
      const diff = rightList.length - pairCount;
      onlyRightCount += diff;
      rightList.slice(pairCount, pairCount + Math.max(0, sampleLimit - onlyRightSamples.length)).forEach((item) => {
        onlyRightSamples.push({
          type: item.typeRaw || 'Sem tipo',
          title: item.titleRaw || 'Sem título',
        });
      });
    }
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

const compareRecords = async (leftRecord, rightRecord) => {
  const startedAt = Date.now();
  const [leftRaw, rightRaw] = await Promise.all([
    searchFullItems(leftRecord.botId, { limit: 0 }),
    searchFullItems(rightRecord.botId, { limit: 0 }),
  ]);

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

  const itemDiff = compareItems(leftItems, rightItems);
  const typeRows = buildTypeRows(leftItems, rightItems);
  const typeDiffCount = typeRows.filter((row) => row.diff !== 0).length;

  return {
    startedAt,
    durationMs: Date.now() - startedAt,
    left: leftRecord,
    right: rightRecord,
    mode: normalizeMode(leftRecord.mode) || normalizeMode(rightRecord.mode) || null,
    totalLeft: leftItems.length,
    totalRight: rightItems.length,
    commonBySignature,
    typeDiffCount,
    scriptsLeft: Array.from(leftScriptMap.values()).reduce((acc, value) => acc + value, 0),
    scriptsRight: Array.from(rightScriptMap.values()).reduce((acc, value) => acc + value, 0),
    commonScripts,
    ...itemDiff,
    typeRows,
  };
};

const createMetric = (label, value) => {
  const row = document.createElement('div');
  row.className = 'metric';
  const name = document.createElement('span');
  name.textContent = label;
  const strong = document.createElement('strong');
  strong.textContent = String(value ?? '-');
  row.appendChild(name);
  row.appendChild(strong);
  return row;
};

const renderSummary = () => {
  if (!els.summary) return;
  els.summary.innerHTML = '';
  if (!state.comparison) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Execute uma comparação para visualizar o resumo.';
    els.summary.appendChild(empty);
    return;
  }

  const cmp = state.comparison;
  const metrics = [
    ['Modo', modeLabel(cmp.mode)],
    ['Blocos A', cmp.totalLeft],
    ['Blocos B', cmp.totalRight],
    ['Blocos iguais', cmp.commonBySignature],
    ['Blocos alterados', cmp.changedCount],
    ['Só no A', cmp.onlyLeftCount],
    ['Só no B', cmp.onlyRightCount],
    ['Tipos com delta', cmp.typeDiffCount],
    ['Scripts A', cmp.scriptsLeft],
    ['Scripts B', cmp.scriptsRight],
    ['Scripts iguais', cmp.commonScripts],
    ['Tempo', formatDuration(cmp.durationMs)],
  ];
  metrics.forEach(([label, value]) => {
    els.summary.appendChild(createMetric(label, value));
  });
};

const appendGroup = ({ groupKey, title, count, rows, renderRow }) => {
  if (!els.details) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'search-group';

  const header = document.createElement('div');
  header.className = 'search-group-header';
  const left = document.createElement('span');
  left.textContent = title;
  const right = document.createElement('span');
  right.className = 'tag-group-meta';
  right.textContent = String(count);
  header.appendChild(left);
  header.appendChild(right);

  const content = document.createElement('div');
  content.className = 'search-group-content';
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Sem ocorrências.';
    content.appendChild(empty);
  } else {
    rows.forEach((row, index) => {
      content.appendChild(renderRow(row, index));
    });
  }

  const key = String(groupKey || title);
  const isOpen = state.detailsOpenAll || Boolean(state.openDetailGroups[key]);
  if (!isOpen) {
    content.setAttribute('hidden', 'true');
  }
  header.addEventListener('click', () => {
    if (state.detailsOpenAll) return;
    const currentlyOpen = !content.hasAttribute('hidden');
    if (currentlyOpen) {
      content.setAttribute('hidden', 'true');
      delete state.openDetailGroups[key];
    } else {
      content.removeAttribute('hidden');
      state.openDetailGroups[key] = true;
    }
  });

  wrapper.appendChild(header);
  wrapper.appendChild(content);
  els.details.appendChild(wrapper);
};

const createCompareLine = ({ title, description }) => {
  const row = document.createElement('div');
  row.className = 'compare-line';
  const left = document.createElement('div');
  left.className = 'compare-line__title';
  left.textContent = title;
  const right = document.createElement('div');
  right.className = 'compare-line__desc';
  right.textContent = description;
  row.appendChild(left);
  row.appendChild(right);
  return row;
};

const getChangedRows = () => (Array.isArray(state.comparison?.changedSamples) ? state.comparison.changedSamples : []);

const buildPropertyFilterOptions = (rows) => {
  const set = new Set();
  rows.forEach((row) => {
    const keys = Array.isArray(row?.keys) ? row.keys : [];
    keys.forEach((key) => {
      const value = String(key ?? '').trim();
      if (value) set.add(value);
    });
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
};

const getFilteredChangedRows = () => {
  const rows = getChangedRows();
  const selected = String(state.propertyFilter ?? '').trim();
  if (!selected) return rows;
  return rows.filter((row) => (Array.isArray(row?.keys) ? row.keys : []).includes(selected));
};

const formatChangedKeysSummary = (keys, limit = 6) => {
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [];
  if (!list.length) return 'Mudança estrutural';
  if (list.length <= limit) return `Campos: ${list.join(', ')}`;
  return `Campos: ${list.slice(0, limit).join(', ')} +${list.length - limit}`;
};

const renderPropertyFilter = () => {
  const hasComparison = Boolean(state.comparison);
  if (els.propertySection) {
    els.propertySection.hidden = !hasComparison;
  }
  if (!hasComparison) {
    if (els.propertyFilter) {
      els.propertyFilter.innerHTML = '<option value="">Todas as propriedades</option>';
      els.propertyFilter.value = '';
      els.propertyFilter.disabled = true;
    }
    if (els.propertyClear) els.propertyClear.disabled = true;
    if (els.propertySummary) {
      setText(els.propertySummary, 'Execute uma comparação para listar as propriedades.');
    }
    return;
  }

  const allChanged = getChangedRows();
  const options = buildPropertyFilterOptions(allChanged);
  const selected = options.includes(state.propertyFilter) ? state.propertyFilter : '';
  if (selected !== state.propertyFilter) {
    state.propertyFilter = selected;
  }

  if (els.propertyFilter) {
    els.propertyFilter.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    allOption.textContent = 'Todas as propriedades';
    els.propertyFilter.appendChild(allOption);
    options.forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = key;
      els.propertyFilter.appendChild(option);
    });
    els.propertyFilter.value = selected;
    els.propertyFilter.disabled = options.length === 0;
  }

  const filteredRows = getFilteredChangedRows();
  if (els.propertySummary) {
    if (!allChanged.length) {
      setText(els.propertySummary, 'Nenhum bloco alterado encontrado nessa comparação.');
    } else if (!options.length) {
      setText(els.propertySummary, 'Não há propriedades de topo para filtrar nos blocos alterados.');
    } else if (selected) {
      setText(
        els.propertySummary,
        `Filtro ativo: "${selected}" (${filteredRows.length}/${allChanged.length} blocos alterados).`,
      );
    } else {
      setText(els.propertySummary, `Propriedades diferentes encontradas: ${options.length}.`);
    }
  }
  if (els.propertyClear) {
    els.propertyClear.disabled = !selected;
  }
};

const createOpenBlockButton = ({ label, record, mode, itemId, groupId }) => {
  const button = document.createElement('button');
  button.className = 'item-link';
  button.type = 'button';
  button.textContent = label;
  const botId = record?.botId ?? '';
  const resolvedMode = normalizeMode(mode) || normalizeMode(record?.mode);
  const resolvedItemId = itemId ?? '';
  const resolvedGroupId = groupId ?? '';
  if (!botId || !resolvedMode || !resolvedItemId) {
    button.disabled = true;
    button.title = 'Link indisponível para esse bloco';
    return button;
  }
  button.title = `Abrir ${record?.botTitle || record?.botId || 'registro'}`;
  button.addEventListener('click', async (event) => {
    event.stopPropagation();
    let appBaseUrl = state.appBaseUrl ?? null;
    try {
      const context = await callBG(MessageType.GET_CONTEXT);
      if (context.ok) {
        appBaseUrl = context.data?.context?.appBaseUrl ?? null;
        state.appBaseUrl = appBaseUrl;
      }
    } catch {
      // ignorar e usar a ultima base URL conhecida
    }
    const url = buildBlockLink({
      botId,
      mode: resolvedMode,
      itemId: resolvedItemId,
      groupId: resolvedGroupId,
      appBaseUrl,
    });
    if (!url) return;
    callBG(MessageType.OPEN_URL_CURRENT_TAB, { url }).catch(() => undefined);
  });
  return button;
};

const createMergeDiffRow = (diff) => {
  const row = document.createElement('div');
  row.className = 'compare-diff-row';

  const path = document.createElement('div');
  path.className = 'compare-diff-path';
  path.textContent = diff.path || '(raiz)';
  row.appendChild(path);

  const left = document.createElement('div');
  left.className = 'compare-diff-side';
  left.textContent = `A: ${diff.leftPreview}`;
  row.appendChild(left);

  const right = document.createElement('div');
  right.className = 'compare-diff-side';
  right.textContent = `B: ${diff.rightPreview}`;
  row.appendChild(right);

  return row;
};

const createChangedLine = (row, index, cmp) => {
  const wrapper = document.createElement('div');
  wrapper.className = 'compare-line compare-line--expandable';
  const rowKey = `changed:${row.leftItemId || 'none'}:${row.rightItemId || 'none'}:${index}`;
  const open = Boolean(state.openChangedRows[rowKey]);

  const head = document.createElement('div');
  head.className = 'compare-line__head';

  const info = document.createElement('div');
  info.className = 'compare-line__head-info';
  const title = document.createElement('div');
  title.className = 'compare-line__title';
  title.textContent = `${row.type} • ${row.title}`;
  info.appendChild(title);

  const description = document.createElement('div');
  description.className = 'compare-line__desc';
  const fragments = [];
  fragments.push(formatChangedKeysSummary(row.keys));
  if (row.scriptChanged) fragments.push('Script alterado');
  fragments.push(`${Array.isArray(row.mergeDiff) ? row.mergeDiff.length : 0} diferenças`);
  description.textContent = fragments.join(' | ');
  info.appendChild(description);
  head.appendChild(info);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn--ghost btn--sm';
  toggle.textContent = open ? 'Ocultar merge' : 'Ver merge';
  head.appendChild(toggle);

  const details = document.createElement('div');
  details.className = 'compare-line__details';
  if (!open) details.setAttribute('hidden', 'true');

  const top = document.createElement('div');
  top.className = 'compare-line__actions actions-group';
  top.appendChild(
    createOpenBlockButton({
      label: 'Abrir bloco A',
      record: cmp.left,
      mode: cmp.mode,
      itemId: row.leftItemId,
      groupId: row.leftGroupId,
    }),
  );
  top.appendChild(
    createOpenBlockButton({
      label: 'Abrir bloco B',
      record: cmp.right,
      mode: cmp.mode,
      itemId: row.rightItemId,
      groupId: row.rightGroupId,
    }),
  );
  details.appendChild(top);

  const idLine = document.createElement('div');
  idLine.className = 'muted compare-line__ids';
  idLine.textContent = `A: ${row.leftItemId || '-'} | B: ${row.rightItemId || '-'}`;
  details.appendChild(idLine);

  const layout = document.createElement('div');
  layout.className = 'block-diff-layout';
  details.appendChild(layout);

  const blockWrap = document.createElement('div');
  blockWrap.className = 'block-diff-layout__block';
  layout.appendChild(blockWrap);

  const propsWrap = document.createElement('div');
  propsWrap.className = 'block-diff-layout__props';
  layout.appendChild(propsWrap);

  // Apenas propriedades alteradas, com valores A/B.
  const diffs = Array.isArray(row.mergeDiff) ? row.mergeDiff : [];
  propsWrap.appendChild(
    createPropsDiffPanel({
      diffs,
      mode: cmp?.mode,
      leftLabel: 'A',
      rightLabel: 'B',
    }),
  );

  let visualLoaded = false;
  let visualLoading = false;

  const renderVisualStatus = (text) => {
    blockWrap.innerHTML = '';
    const line = document.createElement('div');
    line.className = 'muted';
    line.textContent = text || '';
    blockWrap.appendChild(line);
  };

  const ensureVisualLoaded = async () => {
    if (visualLoaded || visualLoading) return;

    const leftBotId = String(cmp?.left?.botId ?? '').trim();
    const leftItemId = String(row.leftItemId ?? '').trim();
    if (!leftBotId || !leftItemId) {
      renderVisualStatus('Pré-visualização indisponível para esse bloco.');
      visualLoaded = true;
      return;
    }

    visualLoading = true;
    renderVisualStatus('Carregando pré-visualização do bloco A...');

    try {
      const leftItem = await getFullItemById(leftBotId, leftItemId);
      blockWrap.innerHTML = '';
      blockWrap.appendChild(
        createBlockGridPreviewCard({
          item: leftItem,
          label: 'A',
          mode: cmp?.mode,
          changedKeys: row.keys,
        }),
      );
      visualLoaded = true;
    } catch {
      renderVisualStatus('Falha ao carregar a pré-visualização do bloco A.');
      visualLoaded = true;
    } finally {
      visualLoading = false;
    }
  };

  const toggleOpen = () => {
    const isOpen = !details.hasAttribute('hidden');
    if (isOpen) {
      details.setAttribute('hidden', 'true');
      delete state.openChangedRows[rowKey];
      toggle.textContent = 'Ver merge';
      return;
    }
    details.removeAttribute('hidden');
    state.openChangedRows[rowKey] = true;
    toggle.textContent = 'Ocultar merge';
    ensureVisualLoaded();
  };

  head.addEventListener('click', () => toggleOpen());
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleOpen();
  });

  if (open) {
    ensureVisualLoaded();
  }

  wrapper.appendChild(head);
  wrapper.appendChild(details);
  return wrapper;
};

const renderDetails = () => {
  if (!els.details) return;
  els.details.innerHTML = '';

  if (!state.comparison) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Sem comparação executada.';
    els.details.appendChild(empty);
    return;
  }

  const cmp = state.comparison;
  const changedRows = getFilteredChangedRows();
  const changedTitle = state.propertyFilter ? `Blocos alterados (${state.propertyFilter})` : 'Blocos alterados';
  const typeRows = cmp.typeRows.filter((row) => row.diff !== 0).slice(0, 30);
  appendGroup({
    groupKey: 'type_diff',
    title: 'Diferença por tipo',
    count: cmp.typeDiffCount,
    rows: typeRows,
    renderRow: (row) =>
      createCompareLine({
        title: row.type,
        description: `A: ${row.left} | B: ${row.right} | Delta: ${row.diff > 0 ? '+' : ''}${row.diff}`,
      }),
  });

  appendGroup({
    groupKey: 'changed',
    title: changedTitle,
    count: changedRows.length,
    rows: changedRows,
    renderRow: (row, index) => createChangedLine(row, index, cmp),
  });

  appendGroup({
    groupKey: 'only_left',
    title: 'Somente no registro A',
    count: cmp.onlyLeftCount,
    rows: cmp.onlyLeftSamples,
    renderRow: (row) =>
      createCompareLine({
        title: `${row.type} • ${row.title}`,
        description: 'Presente apenas no A',
      }),
  });

  appendGroup({
    groupKey: 'only_right',
    title: 'Somente no registro B',
    count: cmp.onlyRightCount,
    rows: cmp.onlyRightSamples,
    renderRow: (row) =>
      createCompareLine({
        title: `${row.type} • ${row.title}`,
        description: 'Presente apenas no B',
      }),
  });
};

const render = () => {
  renderSelectors();
  updateControls();
  renderPropertyFilter();
  renderSummary();
  renderDetails();
};

const loadContext = async () => {
  try {
    const response = await callBG(MessageType.GET_CONTEXT);
    if (!response.ok) return;
    state.appBaseUrl = response.data?.context?.appBaseUrl ?? null;
  } catch {
    // ignorar
  }
};

const loadRecords = async () => {
  if (disposed) return;
  state.loading = true;
  state.error = null;
  render();

  try {
    const response = await callBG(MessageType.LIST_BOTS);
    if (!response.ok) {
      state.records = [];
      state.error = response.error?.message ?? 'Falha ao listar registros.';
      return;
    }

    const list = Array.isArray(response.data?.bots) ? response.data.bots : [];
    const fullSynced = list.filter((meta) => Boolean(meta?.lastItemsSyncAt));
    const enriched = fullSynced.map((meta) => ({ ...meta, mode: normalizeMode(meta?.mode) }));
    if (disposed) return;
    enriched.sort(compareByRecentSync);
    state.records = enriched;

    if (state.leftId && !state.records.find((item) => item.botId === state.leftId)) {
      state.leftId = '';
    }
    if (state.rightId && !state.records.find((item) => item.botId === state.rightId)) {
      state.rightId = '';
    }
  } catch (error) {
    state.records = [];
    state.error = String(error?.message ?? error);
  } finally {
    state.loading = false;
  }
};

const runComparison = async () => {
  const validation = getValidation();
  if (!validation.ready) {
    updateControls();
    return;
  }
  const left = getRecordById(state.leftId);
  const right = getRecordById(state.rightId);
  if (!left || !right) return;

  state.comparing = true;
  state.error = null;
  render();

  try {
    const result = await compareRecords(left, right);
    if (disposed) return;
    state.comparison = result;
    state.propertyFilter = '';
    state.detailsOpenAll = false;
    state.openDetailGroups = {};
    state.openChangedRows = {};
  } catch (error) {
    if (disposed) return;
    state.comparison = null;
    state.error = String(error?.message ?? error);
  } finally {
    state.comparing = false;
    render();
  }
};

const bindEvents = () => {
  if (els.left) {
    on(els.left, 'change', (event) => {
      state.leftId = String(event?.target?.value ?? '');
      state.comparison = null;
      state.propertyFilter = '';
      state.error = null;
      state.detailsOpenAll = false;
      state.openDetailGroups = {};
      state.openChangedRows = {};
      render();
    });
  }
  if (els.right) {
    on(els.right, 'change', (event) => {
      state.rightId = String(event?.target?.value ?? '');
      state.comparison = null;
      state.propertyFilter = '';
      state.error = null;
      state.detailsOpenAll = false;
      state.openDetailGroups = {};
      state.openChangedRows = {};
      render();
    });
  }
  if (els.propertyFilter) {
    on(els.propertyFilter, 'change', (event) => {
      state.propertyFilter = String(event?.target?.value ?? '');
      state.openChangedRows = {};
      render();
    });
  }
  if (els.propertyClear) {
    on(els.propertyClear, 'click', () => {
      state.propertyFilter = '';
      state.openChangedRows = {};
      render();
    });
  }
  if (els.run) on(els.run, 'click', () => runComparison());
  if (els.detailsToggle) {
    on(els.detailsToggle, 'click', () => {
      state.detailsOpenAll = !state.detailsOpenAll;
      state.openDetailGroups = {};
      render();
    });
  }
  if (els.refresh)
    on(els.refresh, 'click', async () => {
      state.comparison = null;
      state.propertyFilter = '';
      state.detailsOpenAll = false;
      state.openDetailGroups = {};
      state.openChangedRows = {};
      await loadRecords();
      render();
    });
};

const init = async () => {
  bindEvents();
  await loadContext();
  await loadRecords();
  render();
};

export const screenComparacao = {
  id: 'comparacao',
  title: 'Comparação',
  mount: async ({ root }) => {
    disposed = false;
    cleanupFns = [];
    state = createInitialState();
    rootEl = root;

    const template = document.getElementById(TEMPLATE_ID);
    if (!template) {
      throw new Error(`Template "${TEMPLATE_ID}" não encontrado em panel.html`);
    }

    root.innerHTML = '';
    root.appendChild(template.content.cloneNode(true));
    els = initEls();
    await init();

    return () => {
      disposed = true;
      const fns = cleanupFns.slice();
      cleanupFns = [];
      fns.reverse().forEach((fn) => {
        try {
          fn();
        } catch {
          // ignorar
        }
      });
      if (rootEl) rootEl.innerHTML = '';
      els = {};
      rootEl = null;
      state = createInitialState();
    };
  },
};
