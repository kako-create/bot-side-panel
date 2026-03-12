import { callBG, MessageType } from '../../services/messaging.js';
import {
  getMeta,
  listBotTags,
  listBotVariables,
  listTechReviewSnapshots,
  listTechReviewSnapshotItems,
  saveTechReviewSnapshot,
  searchFullItems,
} from '../../data/db.js';
import { buildBlockLink } from '../links.js';
import { createBlockComparePreview } from '../components/blockComparePreview.js';
import { createPropsDiffPanel } from '../components/propsDiffPanel.js';
import { compareFullItemCollections } from '../services/fullItemsCompare.js';

const TEMPLATE_ID = 'tpl-screen-review-tecnica';
const TARGET_CURRENT = 'current';
const TARGET_SNAPSHOT = 'snapshot';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';
const REVIEW_KIND_BLOCK = 'block';
const REVIEW_KIND_VARIABLE = 'variable';
const REVIEW_KIND_TAG = 'tag';
const REVIEW_SHEET_NAME = 'Review Tecnica';
const API_SHEET_NAME = 'API';
const SCRIPT_SHEET_NAME = 'Script';

const createInitialState = () => ({
  botId: null,
  mode: null,
  appBaseUrl: null,
  hasAuth: false,
  meta: null,
  syncStatus: null,
  loading: false,
  snapshotting: false,
  comparing: false,
  exporting: false,
  statusText: '',
  statusKind: 'info',
  snapshots: [],
  baseSnapshotId: '',
  targetType: TARGET_CURRENT,
  targetSnapshotId: '',
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
    bot: q('#review-tech-bot'),
    mode: q('#review-tech-mode'),
    auth: q('#review-tech-auth'),
    sync: q('#review-tech-sync'),
    snapshotCount: q('#review-tech-snapshot-count'),
    latestSnapshot: q('#review-tech-latest-snapshot'),
    captureBtn: q('#review-tech-capture'),
    feedback: q('#review-tech-feedback'),
    baseSnapshot: q('#review-tech-base-snapshot'),
    targetType: q('#review-tech-target-type'),
    targetSnapshotField: q('#review-tech-target-snapshot-field'),
    targetSnapshot: q('#review-tech-target-snapshot'),
    validation: q('#review-tech-validation'),
    compareBtn: q('#review-tech-compare'),
    exportBtn: q('#review-tech-export'),
    propertySection: q('#review-tech-property-section'),
    propertyFilter: q('#review-tech-property-filter'),
    propertyClear: q('#review-tech-property-clear'),
    propertySummary: q('#review-tech-property-summary'),
    groupsToggle: q('#review-tech-groups-toggle'),
    baseLabel: q('#review-tech-result-base'),
    targetLabel: q('#review-tech-result-target'),
    summary: q('#review-tech-summary'),
    details: q('#review-tech-details'),
  };
};

const normalizeMode = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const modeLabel = (mode) => {
  if (mode === MODE_URA) return 'URA';
  if (mode === MODE_BOT) return 'BOT';
  return '-';
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

const formatSyncStatus = (status) => {
  if (!status) return '-';
  if (status.phase === 'error') return `Erro: ${status.lastError ?? 'desconhecido'}`;
  if (!status.running) return 'OK';
  if (status.phase === 'summary') return `Summary ${status.summaryCount ?? 0}`;
  if (status.phase === 'full') return `Full ${status.completedGroups ?? 0}/${status.totalGroups ?? 0}`;
  return String(status.phase || '-');
};

const sanitizeFileName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'bot';

const downloadBinaryFile = (filename, data, mimeType) => {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const getXlsx = () => globalThis.XLSX ?? null;

const createSheet = (rows) => {
  const xlsx = getXlsx();
  if (!xlsx) throw new Error('SheetJS não está disponível no painel.');
  return xlsx.utils.aoa_to_sheet(Array.isArray(rows) ? rows : []);
};

const appendSheet = (workbook, sheet) => {
  const xlsx = getXlsx();
  if (!xlsx) throw new Error('SheetJS não está disponível no painel.');

  const descriptor = sheet ?? {};
  const worksheet = createSheet(descriptor.rows);
  xlsx.utils.book_append_sheet(workbook, worksheet, descriptor.name);
  if (typeof descriptor.afterAppend === 'function') {
    descriptor.afterAppend({ workbook, worksheet, xlsx });
  }
  return worksheet;
};

const downloadWorkbook = (filename, sheets) => {
  const xlsx = getXlsx();
  if (!xlsx) throw new Error('SheetJS não está disponível no painel.');

  const workbook = xlsx.utils.book_new();
  (Array.isArray(sheets) ? sheets : []).forEach((sheet) => {
    if (!sheet?.name) return;
    appendSheet(workbook, sheet);
  });

  const data = xlsx.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  });

  downloadBinaryFile(
    filename,
    data,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
};

const estimateBytes = (value) => {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
};

const createReviewVariableRecord = (variable) => ({
  itemId: `var:${String(variable?.varId ?? '').trim() || crypto.randomUUID()}`,
  displayId: String(variable?.varId ?? '').trim() || '',
  title: String(variable?.label ?? '').trim() || 'Sem nome',
  type: 'Variável',
  groupId: `variables:${String(variable?.group ?? '').trim() || 'default'}`,
  reviewKind: REVIEW_KIND_VARIABLE,
  payload: {
    label: variable?.label ?? null,
    group: variable?.group ?? null,
    groupLabel: variable?.groupLabel ?? null,
    payload: variable?.payload ?? null,
  },
});

const createReviewTagRecord = (tag) => ({
  itemId: `tag:${String(tag?.tagId ?? '').trim() || crypto.randomUUID()}`,
  displayId: String(tag?.tagId ?? '').trim() || '',
  title: String(tag?.label ?? '').trim() || 'Sem nome',
  type: 'TAG',
  groupId: 'tags',
  reviewKind: REVIEW_KIND_TAG,
  payload: {
    label: tag?.label ?? null,
    payload: tag?.payload ?? null,
  },
});

const createReviewBlockRecord = (item) => ({
  ...item,
  displayId: String(item?.itemId ?? '').trim() || '',
  reviewKind: REVIEW_KIND_BLOCK,
});

const buildReviewRecords = ({ items = [], variables = [], tags = [] } = {}) => [
  ...(Array.isArray(items) ? items : []).map((item) => createReviewBlockRecord(item)),
  ...(Array.isArray(variables) ? variables : []).map((variable) => createReviewVariableRecord(variable)),
  ...(Array.isArray(tags) ? tags : []).map((tag) => createReviewTagRecord(tag)),
];

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const getNestedValue = (source, path) => {
  const parts = Array.isArray(path) ? path : String(path ?? '').split('.');
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current?.[part];
  }
  return current;
};

const pickFirstNestedValue = (source, paths = []) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return null;
};

const asCellText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const stringifyHeaderEntry = (entry) => {
  if (entry === null || entry === undefined) return '';
  if (typeof entry === 'string') return entry.trim();
  if (typeof entry === 'number' || typeof entry === 'boolean') return String(entry);
  if (!isPlainObject(entry)) return asCellText(entry);

  const key = String(
    entry.key ?? entry.name ?? entry.label ?? entry.header ?? entry.field ?? entry.id ?? '',
  ).trim();
  const value = entry.value ?? entry.content ?? entry.result ?? entry.text ?? entry.data ?? null;
  const valueText = asCellText(value);
  if (key && valueText) return `${key}: ${valueText}`;
  if (key) return key;
  return valueText;
};

const flattenHeaders = (value) => {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    return value
      .map((entry) => stringifyHeaderEntry(entry))
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  if (isPlainObject(value)) {
    return Object.entries(value)
      .map(([key, headerValue]) => {
        const text = asCellText(headerValue);
        return text ? `${key}: ${text}` : key;
      })
      .filter(Boolean)
      .join('\n')
      .trim();
  }
  return asCellText(value);
};

const getBlockRecordPayload = (record) => {
  if (!record || record.reviewKind !== REVIEW_KIND_BLOCK) return null;
  return isPlainObject(record.payload) ? record.payload : null;
};

const getBlockRecordType = (record) =>
  String(record?.type ?? record?.payload?.type ?? '')
    .trim()
    .toLowerCase();

const isApiBlockRecord = (record) => /api/.test(getBlockRecordType(record));

const isScriptBlockRecord = (record) => /script/.test(getBlockRecordType(record));

const extractApiExportData = (record) => {
  if (!isApiBlockRecord(record)) return null;
  const payload = getBlockRecordPayload(record);
  if (!payload) return null;

  const endpoint = asCellText(
    pickFirstNestedValue(payload, ['urlEndpoint', 'endpoint', 'url', 'apiUrl', 'request.url']),
  );
  const method = asCellText(
    pickFirstNestedValue(payload, ['methodType', 'method', 'httpMethod', 'request.method']),
  );
  const headers = flattenHeaders(
    pickFirstNestedValue(payload, ['headers', 'customHeaders', 'request.headers']),
  );

  if (!endpoint && !method && !headers) return null;

  return [
    record.displayId ?? record.itemId ?? '',
    record.title ?? '',
    endpoint,
    method,
    headers,
  ];
};

const extractScriptExportData = (record) => {
  if (!isScriptBlockRecord(record)) return null;
  const payload = getBlockRecordPayload(record);
  if (!payload) return null;

  const script = asCellText(
    pickFirstNestedValue(payload, ['scriptCode', 'script', 'code', 'data.scriptCode', 'config.scriptCode']),
  )
    .replace(/\r/g, '')
    .trim();

  if (!script) return null;

  const nonEmptyLines = script
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (nonEmptyLines.length <= 1) return null;

  return [
    record.displayId ?? record.itemId ?? '',
    record.title ?? '',
    script,
  ];
};

const buildReviewExportKey = (scope, index, row, description) => {
  const id = String(
    row?.displayId ?? row?.leftDisplayId ?? row?.rightDisplayId ?? row?.itemId ?? row?.leftItemId ?? row?.rightItemId ?? '',
  ).trim();
  const title = String(row?.title ?? '').trim();
  return `${scope}:${index}:${id}:${title}:${description}`;
};

const buildReviewExportEntries = ({ changedRows = [], removedRows = [], includedRows = [] } = {}) => {
  const entries = [];

  changedRows.forEach((row, index) => {
    entries.push({
      key: buildReviewExportKey('changed', index, row, 'alterado'),
      cells: [
        row.type ?? '',
        row.displayId ?? row.leftDisplayId ?? row.rightDisplayId ?? row.itemId ?? row.leftItemId ?? row.rightItemId ?? '',
        row.title ?? '',
        'alterado',
      ],
      detailRecord: row?.rightItem ?? null,
    });
  });

  removedRows.forEach((row, index) => {
    entries.push({
      key: buildReviewExportKey('removed', index, row, 'removido'),
      cells: [
        row.type ?? '',
        row.displayId ?? row.itemId ?? '',
        row.title ?? '',
        'removido',
      ],
      detailRecord: null,
    });
  });

  includedRows.forEach((row, index) => {
    entries.push({
      key: buildReviewExportKey('included', index, row, 'incluido'),
      cells: [
        row.type ?? '',
        row.displayId ?? row.itemId ?? '',
        row.title ?? '',
        'incluido',
      ],
      detailRecord: row?.item ?? null,
    });
  });

  entries.sort((a, b) => {
    const idDiff = String(a.cells[1] ?? '').localeCompare(String(b.cells[1] ?? ''), 'pt-BR');
    if (idDiff !== 0) return idDiff;
    const descDiff = String(a.cells[3] ?? '').localeCompare(String(b.cells[3] ?? ''), 'pt-BR');
    if (descDiff !== 0) return descDiff;
    return String(a.cells[2] ?? '').localeCompare(String(b.cells[2] ?? ''), 'pt-BR');
  });

  return entries;
};

const buildDetailExportEntries = (reviewEntries = []) => {
  const apiEntries = [];
  const scriptEntries = [];

  reviewEntries.forEach((entry) => {
    const record = entry?.detailRecord ?? null;
    const apiCells = extractApiExportData(record);
    if (apiCells) {
      apiEntries.push({
        reviewKey: entry.key,
        cells: apiCells,
      });
    }

    const scriptCells = extractScriptExportData(record);
    if (scriptCells) {
      scriptEntries.push({
        reviewKey: entry.key,
        cells: scriptCells,
      });
    }
  });

  apiEntries.sort((a, b) => {
    const idDiff = String(a.cells[0] ?? '').localeCompare(String(b.cells[0] ?? ''), 'pt-BR');
    if (idDiff !== 0) return idDiff;
    return String(a.cells[1] ?? '').localeCompare(String(b.cells[1] ?? ''), 'pt-BR');
  });

  scriptEntries.sort((a, b) => {
    const idDiff = String(a.cells[0] ?? '').localeCompare(String(b.cells[0] ?? ''), 'pt-BR');
    if (idDiff !== 0) return idDiff;
    return String(a.cells[1] ?? '').localeCompare(String(b.cells[1] ?? ''), 'pt-BR');
  });

  return { apiEntries, scriptEntries };
};

const getSheetCellAddress = (rowIndex, colIndex) => {
  const xlsx = getXlsx();
  if (!xlsx) throw new Error('SheetJS não está disponível no painel.');
  return xlsx.utils.encode_cell({ r: rowIndex, c: colIndex });
};

const quoteSheetName = (name) => {
  const raw = String(name ?? '').trim() || 'Sheet1';
  if (/^[A-Za-z0-9_]+$/.test(raw)) return raw;
  return `'${raw.replace(/'/g, "''")}'`;
};

const buildInternalLinkTarget = (sheetName, cellAddress) => `#${quoteSheetName(sheetName)}!${cellAddress}`;

const normalizeLinkTooltip = (value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  if (raw.length <= 250) return raw;
  return `${raw.slice(0, 247)}...`;
};

const setWorksheetInternalLink = ({
  worksheet,
  rowIndex,
  colIndex,
  targetSheetName,
  targetCellAddress,
  tooltip = '',
}) => {
  if (!worksheet || !targetSheetName || !targetCellAddress) return;

  const cellAddress = getSheetCellAddress(rowIndex, colIndex);
  if (!worksheet[cellAddress]) {
    worksheet[cellAddress] = { t: 's', v: '' };
  }

  worksheet[cellAddress].l = {
    Target: buildInternalLinkTarget(targetSheetName, targetCellAddress),
  };

  const safeTooltip = normalizeLinkTooltip(tooltip);
  if (safeTooltip) {
    worksheet[cellAddress].l.Tooltip = safeTooltip;
  }
};

const isBusy = () => Boolean(state.loading || state.snapshotting || state.comparing || state.exporting);

const clearComparisonState = () => {
  state.propertyFilter = '';
  state.comparison = null;
  state.detailsOpenAll = false;
  state.openDetailGroups = {};
  state.openChangedRows = {};
};

const getSnapshotById = (snapshotId) =>
  (Array.isArray(state.snapshots) ? state.snapshots : []).find((item) => item.snapshotId === snapshotId) ?? null;

const buildSnapshotLabel = (snapshot) => {
  if (!snapshot) return '-';
  const botLabel = String(snapshot.botTitle ?? snapshot.botId ?? '').trim();
  const parts = [];
  if (botLabel) parts.push(botLabel);
  parts.push(formatDate(snapshot.createdAt));
  const count = Number(snapshot.itemsCount ?? 0);
  parts.push(`${count} bloco${count === 1 ? '' : 's'}`);
  const mode = modeLabel(normalizeMode(snapshot.mode));
  if (mode !== '-') parts.push(mode);
  return parts.join(' | ');
};

const getLatestSnapshot = () => (Array.isArray(state.snapshots) ? state.snapshots[0] ?? null : null);

const getCurrentValidation = () => {
  if (state.loading) return { ready: false, message: 'Carregando snapshots...' };
  if (!state.botId) return { ready: false, message: 'Abra o BOT/URA no builder para usar a Review Técnica.' };
  if (state.comparing) return { ready: false, message: 'Comparação em andamento...' };
  if (!state.baseSnapshotId) return { ready: false, message: 'Selecione o snapshot base para gerar a comparação.' };

  const baseSnapshot = getSnapshotById(state.baseSnapshotId);
  if (!baseSnapshot) return { ready: false, message: 'Snapshot base inválido. Atualize a tela.' };

  if (state.targetType === TARGET_CURRENT) {
    if (!state.hasAuth) {
      return { ready: false, message: 'Token ausente para comparar com a base atual.' };
    }
    return { ready: true, message: 'Pronto para comparar com a base atual.' };
  }

  if (!state.targetSnapshotId) {
    return { ready: false, message: 'Selecione o snapshot de comparação.' };
  }
  if (state.baseSnapshotId === state.targetSnapshotId) {
    return { ready: false, message: 'Selecione snapshots diferentes.' };
  }
  if (!getSnapshotById(state.targetSnapshotId)) {
    return { ready: false, message: 'Snapshot de comparação inválido. Atualize a tela.' };
  }
  return { ready: true, message: 'Pronto para comparar os snapshots.' };
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
  if (!isOpen) content.setAttribute('hidden', 'true');

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

const formatBlockTitle = ({ type, title, itemId, displayId }) => {
  const typeLabel = String(type ?? '').trim() || 'Sem tipo';
  const titleLabel = String(title ?? '').trim() || 'Sem título';
  const idLabel = String(displayId ?? itemId ?? '').trim();
  if (!idLabel) return `${typeLabel} • ${titleLabel}`;
  return `${typeLabel} • ${titleLabel} (${idLabel})`;
};

const createOpenCurrentBlockButton = ({ itemId, groupId }) => {
  const button = document.createElement('button');
  button.className = 'item-link';
  button.type = 'button';
  button.textContent = 'Abrir bloco atual';

  const botId = String(state.botId ?? '').trim();
  const mode = normalizeMode(state.comparison?.mode) || normalizeMode(state.mode);
  const resolvedItemId = String(itemId ?? '').trim();
  const resolvedGroupId = String(groupId ?? '').trim();
  if (!botId || !mode || !resolvedItemId) {
    button.disabled = true;
    button.title = 'Link indisponível para esse bloco';
    return button;
  }

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
      // ignorar
    }

    const url = buildBlockLink({
      botId,
      mode,
      itemId: resolvedItemId,
      groupId: resolvedGroupId,
      appBaseUrl,
    });
    if (!url) return;
    callBG(MessageType.OPEN_URL_CURRENT_TAB, { url }).catch(() => undefined);
  });

  return button;
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
  title.textContent = formatBlockTitle({
    type: row.type,
    title: row.title,
    itemId: row.displayId ?? row.leftDisplayId ?? row.rightDisplayId ?? row.itemId ?? row.leftItemId ?? row.rightItemId,
  });
  info.appendChild(title);

  const description = document.createElement('div');
  description.className = 'compare-line__desc';
  const fragments = [
    formatChangedKeysSummary(row.keys),
    row.scriptChanged ? 'Script alterado' : null,
    `${Array.isArray(row.mergeDiff) ? row.mergeDiff.length : 0} diferenças`,
  ].filter(Boolean);
  description.textContent = fragments.join(' | ');
  info.appendChild(description);
  head.appendChild(info);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'btn btn--ghost btn--sm';
  toggle.textContent = open ? 'Ocultar detalhes' : 'Ver detalhes';
  head.appendChild(toggle);

  const details = document.createElement('div');
  details.className = 'compare-line__details';
  if (!open) details.setAttribute('hidden', 'true');

  if (cmp.target.kind === TARGET_CURRENT && row.rightItemId && row.reviewKind === REVIEW_KIND_BLOCK) {
    const actions = document.createElement('div');
    actions.className = 'compare-line__actions actions-group';
    actions.appendChild(
      createOpenCurrentBlockButton({
        itemId: row.rightItemId,
        groupId: row.rightGroupId,
      }),
    );
    details.appendChild(actions);
  }

  const idLine = document.createElement('div');
  idLine.className = 'muted compare-line__ids';
  idLine.textContent = `Base: ${row.leftDisplayId || row.leftItemId || '-'} | Comparação: ${row.rightDisplayId || row.rightItemId || '-'}`;
  details.appendChild(idLine);

  const layout = document.createElement('div');
  layout.className = 'block-diff-layout';
  details.appendChild(layout);

  const previewWrap = document.createElement('div');
  previewWrap.className = 'block-diff-layout__block';
  previewWrap.appendChild(
    createBlockComparePreview({
      leftItem: row.leftItem,
      rightItem: row.rightItem,
      mode: cmp.mode,
      changedKeys: row.keys,
      leftLabel: cmp.leftLabel,
      rightLabel: cmp.rightLabel,
    }),
  );
  layout.appendChild(previewWrap);

  const propsWrap = document.createElement('div');
  propsWrap.className = 'block-diff-layout__props';
  propsWrap.appendChild(
    createPropsDiffPanel({
      diffs: Array.isArray(row.mergeDiff) ? row.mergeDiff : [],
      mode: cmp.mode,
      leftLabel: cmp.leftLabel,
      rightLabel: cmp.rightLabel,
    }),
  );
  layout.appendChild(propsWrap);

  const toggleOpen = () => {
    const isOpen = !details.hasAttribute('hidden');
    if (isOpen) {
      details.setAttribute('hidden', 'true');
      delete state.openChangedRows[rowKey];
      toggle.textContent = 'Ver detalhes';
      return;
    }
    details.removeAttribute('hidden');
    state.openChangedRows[rowKey] = true;
    toggle.textContent = 'Ocultar detalhes';
  };

  head.addEventListener('click', () => toggleOpen());
  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleOpen();
  });

  wrapper.appendChild(head);
  wrapper.appendChild(details);
  return wrapper;
};

const updateFeedback = () => {
  if (!els.feedback) return;
  els.feedback.className = `settings-feedback settings-feedback--${state.statusKind || 'info'}`;
  els.feedback.hidden = !state.statusText;
  setText(els.feedback, state.statusText);
};

const updateStatusCard = () => {
  const title = state.meta?.botTitle;
  if (!state.botId) setText(els.bot, '-');
  else if (title) setText(els.bot, `${title} (${state.botId})`);
  else setText(els.bot, state.botId);

  setText(els.mode, modeLabel(normalizeMode(state.meta?.mode) || normalizeMode(state.mode)));
  setText(els.auth, state.hasAuth ? 'Disponível' : 'Ausente');
  setText(els.sync, `${formatDate(state.meta?.lastItemsSyncAt)} | ${formatSyncStatus(state.syncStatus)}`);
  setText(els.snapshotCount, String(Array.isArray(state.snapshots) ? state.snapshots.length : 0));
  setText(els.latestSnapshot, buildSnapshotLabel(getLatestSnapshot()));
};

const fillSnapshotSelect = (selectEl, selectedId, { emptyLabel, excludeId = '' } = {}) => {
  if (!selectEl) return;
  selectEl.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = emptyLabel;
  selectEl.appendChild(first);

  const snapshots = (Array.isArray(state.snapshots) ? state.snapshots : []).filter(
    (snapshot) => snapshot.snapshotId !== excludeId,
  );
  snapshots.forEach((snapshot) => {
    const option = document.createElement('option');
    option.value = snapshot.snapshotId;
    option.textContent = buildSnapshotLabel(snapshot);
    selectEl.appendChild(option);
  });

  selectEl.value = selectedId || '';
};

const renderSelectors = () => {
  fillSnapshotSelect(els.baseSnapshot, state.baseSnapshotId, {
    emptyLabel: 'Selecione o snapshot base',
  });
  fillSnapshotSelect(els.targetSnapshot, state.targetSnapshotId, {
    emptyLabel: 'Selecione o snapshot de comparação',
    excludeId: state.baseSnapshotId,
  });
};

const updateControls = () => {
  const validation = getCurrentValidation();
  const hasComparison = Boolean(state.comparison);
  const hasDifferences = Boolean(
    (getFilteredChangedRows().length || 0) +
      Number(state.comparison?.onlyLeftCount ?? 0) +
      Number(state.comparison?.onlyRightCount ?? 0),
  );

  if (els.captureBtn) {
    const ready = Boolean(state.botId) && Boolean(state.hasAuth) && !isBusy();
    els.captureBtn.disabled = !ready;
    els.captureBtn.textContent = state.snapshotting ? 'Capturando...' : 'Criar snapshot';
  }

  if (els.targetType) {
    els.targetType.disabled = isBusy();
    els.targetType.value = state.targetType;
  }

  if (els.targetSnapshotField) {
    els.targetSnapshotField.hidden = state.targetType !== TARGET_SNAPSHOT;
  }

  if (els.targetSnapshot) {
    els.targetSnapshot.disabled = state.targetType !== TARGET_SNAPSHOT || isBusy();
  }

  if (els.compareBtn) {
    els.compareBtn.disabled = !validation.ready || isBusy();
    els.compareBtn.textContent = state.comparing ? 'Comparando...' : 'Gerar comparação';
  }

  if (els.exportBtn) {
    els.exportBtn.disabled = !hasComparison || !hasDifferences || isBusy();
    els.exportBtn.textContent = state.exporting ? 'Exportando...' : 'Exportar Excel';
  }

  if (els.validation) setText(els.validation, validation.message);

  if (els.groupsToggle) {
    els.groupsToggle.disabled = !hasComparison;
    els.groupsToggle.textContent = state.detailsOpenAll ? 'Fechar grupos' : 'Abrir grupos';
  }
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
    if (els.propertySummary) setText(els.propertySummary, 'Execute uma comparação para listar as propriedades.');
    return;
  }

  const allChanged = getChangedRows();
  const options = buildPropertyFilterOptions(allChanged);
  const selected = options.includes(state.propertyFilter) ? state.propertyFilter : '';
  if (selected !== state.propertyFilter) state.propertyFilter = selected;

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
      setText(els.propertySummary, 'Nenhum item alterado encontrado nessa comparação.');
    } else if (!options.length) {
      setText(els.propertySummary, 'Não há propriedades de topo para filtrar nos itens alterados.');
    } else if (selected) {
      setText(
        els.propertySummary,
        `Filtro ativo: "${selected}" (${filteredRows.length}/${allChanged.length} itens alterados).`,
      );
    } else {
      setText(els.propertySummary, `Propriedades diferentes encontradas: ${options.length}.`);
    }
  }

  if (els.propertyClear) {
    els.propertyClear.disabled = !selected;
  }
};

const renderSummary = () => {
  if (els.summary) els.summary.innerHTML = '';

  if (!state.comparison) {
    setText(els.baseLabel, '-');
    setText(els.targetLabel, '-');
    if (els.summary) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Gere uma comparação para visualizar o resumo.';
      els.summary.appendChild(empty);
    }
    return;
  }

  const cmp = state.comparison;
  setText(els.baseLabel, cmp.base.label);
  setText(els.targetLabel, cmp.target.label);

  const metrics = [
    ['Alterados', cmp.changedCount],
    ['Removidos', cmp.onlyLeftCount],
    ['Incluídos', cmp.onlyRightCount],
    ['Base', cmp.totalLeft],
    ['Comparado', cmp.totalRight],
    ['Tempo', formatDuration(cmp.durationMs)],
  ];
  metrics.forEach(([label, value]) => {
    els.summary.appendChild(createMetric(label, value));
  });
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
  const changedTitle = state.propertyFilter ? `Itens alterados (${state.propertyFilter})` : 'Itens alterados';

  appendGroup({
    groupKey: 'changed',
    title: changedTitle,
    count: changedRows.length,
    rows: changedRows,
    renderRow: (row, index) => createChangedLine(row, index, cmp),
  });

  appendGroup({
    groupKey: 'only_left',
    title: 'Itens removidos',
    count: cmp.onlyLeftCount,
    rows: cmp.onlyLeftSamples,
    renderRow: (row) =>
      createCompareLine({
        title: formatBlockTitle(row),
        description: 'Removido da base comparada',
      }),
  });

  appendGroup({
    groupKey: 'only_right',
    title: 'Itens incluídos',
    count: cmp.onlyRightCount,
    rows: cmp.onlyRightSamples,
    renderRow: (row) =>
      createCompareLine({
        title: formatBlockTitle(row),
        description: 'Incluído na base comparada',
      }),
  });
};

const render = () => {
  updateStatusCard();
  renderSelectors();
  updateControls();
  updateFeedback();
  renderPropertyFilter();
  renderSummary();
  renderDetails();
};

const applySyncStatus = (nextStatus) => {
  const statusBotId = String(nextStatus?.botId ?? '').trim();
  const currentBotId = String(state.botId ?? '').trim();
  if (statusBotId && currentBotId && statusBotId !== currentBotId) return;
  state.syncStatus = nextStatus ?? null;
};

const loadLocalData = async () => {
  const botId = String(state.botId ?? '').trim();
  if (!botId) {
    state.meta = null;
    state.snapshots = [];
    state.baseSnapshotId = '';
    state.targetSnapshotId = '';
    clearComparisonState();
    return;
  }

  const [meta, snapshots] = await Promise.all([getMeta(botId), listTechReviewSnapshots(botId)]);
  state.meta = meta;
  state.snapshots = Array.isArray(snapshots) ? snapshots : [];

  if (state.baseSnapshotId && !getSnapshotById(state.baseSnapshotId)) {
    state.baseSnapshotId = '';
  }
  if (state.targetSnapshotId && !getSnapshotById(state.targetSnapshotId)) {
    state.targetSnapshotId = '';
  }
};

const loadContext = async () => {
  const response = await callBG(MessageType.GET_CONTEXT);
  if (!response.ok) return;

  const prevBotId = state.botId;
  state.botId = response.data?.context?.botId ?? null;
  state.mode = normalizeMode(response.data?.context?.mode) ?? null;
  state.appBaseUrl = response.data?.context?.appBaseUrl ?? null;
  state.hasAuth = Boolean(response.data?.hasAuth);

  if (state.botId !== prevBotId) {
    state.baseSnapshotId = '';
    state.targetSnapshotId = '';
    clearComparisonState();
  }

  await loadLocalData();
};

const loadStatus = async () => {
  const response = await callBG(MessageType.GET_STATUS);
  if (!response.ok) return;
  applySyncStatus(response.data?.status ?? null);
};

const runFullSync = async () => {
  const response = await callBG(MessageType.START_SYNC, {
    botId: state.botId,
    fullItems: true,
  });
  if (!response.ok) {
    throw new Error(response.error?.message ?? 'Falha na sincronização.');
  }
  applySyncStatus(response.data?.status ?? null);
};

const runVariablesSync = async () => {
  const response = await callBG(MessageType.SYNC_VARIABLES, { botId: state.botId });
  if (!response.ok) {
    throw new Error(response.error?.message ?? 'Falha ao sincronizar variáveis.');
  }
};

const runTagsSync = async () => {
  const response = await callBG(MessageType.SYNC_TAGS, { botId: state.botId });
  if (!response.ok) {
    throw new Error(response.error?.message ?? 'Falha ao sincronizar TAGs.');
  }
};

const loadCurrentReviewRecords = async () => {
  const [items, variables, tags] = await Promise.all([
    searchFullItems(state.botId, { limit: 0 }),
    listBotVariables(state.botId),
    listBotTags(state.botId),
  ]);
  return buildReviewRecords({ items, variables, tags });
};

const syncCurrentReviewSources = async () => {
  await runFullSync();
  await Promise.all([runVariablesSync(), runTagsSync()]);
};

const captureSnapshot = async () => {
  if (!state.botId || !state.hasAuth || isBusy()) return;

  state.snapshotting = true;
  state.statusKind = 'info';
  state.statusText = 'Sincronizando blocos, variáveis e TAGs para criar o snapshot...';
  render();

  try {
    await syncCurrentReviewSources();

    const [meta, items, variables, tags] = await Promise.all([
      getMeta(state.botId),
      searchFullItems(state.botId, { limit: 0 }),
      listBotVariables(state.botId),
      listBotTags(state.botId),
    ]);
    const reviewRecords = buildReviewRecords({ items, variables, tags });

    const snapshotId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await saveTechReviewSnapshot(state.botId, {
      snapshotId,
      meta: {
        createdAt,
        botTitle: meta?.botTitle ?? null,
        mode: normalizeMode(meta?.mode) || normalizeMode(state.mode),
        itemsCount: reviewRecords.length,
        bytes: estimateBytes(reviewRecords),
        blocksCount: Array.isArray(items) ? items.length : 0,
        variablesCount: Array.isArray(variables) ? variables.length : 0,
        tagsCount: Array.isArray(tags) ? tags.length : 0,
        sourceLastItemsSyncAt: meta?.lastItemsSyncAt ?? null,
        sourceLastSummarySyncAt: meta?.lastSummarySyncAt ?? null,
      },
      items: reviewRecords,
    });

    await loadLocalData();
    state.baseSnapshotId = snapshotId;
    clearComparisonState();
    state.statusKind = 'success';
    state.statusText = `Snapshot criado em ${formatDate(createdAt)}.`;
  } catch (error) {
    state.statusKind = 'error';
    state.statusText = String(error?.message ?? error);
  } finally {
    state.snapshotting = false;
    render();
  }
};

const buildTargetDescriptor = (snapshot) => ({
  kind: TARGET_SNAPSHOT,
  label: buildSnapshotLabel(snapshot),
  rightLabel: 'Snapshot comparação',
  mode: normalizeMode(snapshot?.mode) || null,
});

const runComparison = async () => {
  const validation = getCurrentValidation();
  if (!validation.ready || isBusy()) {
    render();
    return;
  }

  const baseSnapshot = getSnapshotById(state.baseSnapshotId);
  if (!baseSnapshot) return;

  state.comparing = true;
  state.statusKind = 'info';
  state.statusText =
    state.targetType === TARGET_CURRENT
      ? 'Sincronizando blocos, variáveis e TAGs da base atual para comparar...'
      : 'Carregando snapshots selecionados...';
  render();

  try {
    const baseItemsPromise = listTechReviewSnapshotItems(state.botId, baseSnapshot.snapshotId);

    let targetItems = [];
    let targetMode = normalizeMode(baseSnapshot.mode) || normalizeMode(state.mode);
    let targetInfo = {
      kind: TARGET_CURRENT,
      label: 'Base atual',
      rightLabel: 'Base atual',
      mode: targetMode,
    };

    if (state.targetType === TARGET_CURRENT) {
      await syncCurrentReviewSources();
      const [meta, baseItems, currentItems] = await Promise.all([
        getMeta(state.botId),
        baseItemsPromise,
        loadCurrentReviewRecords(),
      ]);
      state.meta = meta;
      targetItems = currentItems;
      targetMode = normalizeMode(meta?.mode) || targetMode;
      targetInfo = {
        kind: TARGET_CURRENT,
        label: `Base atual | Full: ${formatDate(meta?.lastItemsSyncAt)}`,
        rightLabel: 'Base atual',
        mode: targetMode,
      };

      const diff = compareFullItemCollections(baseItems, targetItems);
      clearComparisonState();
      state.comparison = {
        ...diff,
        mode: targetMode,
        leftLabel: 'Snapshot base',
        rightLabel: targetInfo.rightLabel,
        base: {
          snapshotId: baseSnapshot.snapshotId,
          label: buildSnapshotLabel(baseSnapshot),
          meta: baseSnapshot,
        },
        target: targetInfo,
      };
    } else {
      const targetSnapshot = getSnapshotById(state.targetSnapshotId);
      if (!targetSnapshot) throw new Error('Snapshot de comparação não encontrado.');

      const [baseItems, comparisonItems] = await Promise.all([
        baseItemsPromise,
        listTechReviewSnapshotItems(state.botId, targetSnapshot.snapshotId),
      ]);

      targetInfo = buildTargetDescriptor(targetSnapshot);
      targetMode = targetInfo.mode || targetMode;

      const diff = compareFullItemCollections(baseItems, comparisonItems);
      clearComparisonState();
      state.comparison = {
        ...diff,
        mode: targetMode,
        leftLabel: 'Snapshot base',
        rightLabel: targetInfo.rightLabel,
        base: {
          snapshotId: baseSnapshot.snapshotId,
          label: buildSnapshotLabel(baseSnapshot),
          meta: baseSnapshot,
        },
        target: targetInfo,
      };
    }

    state.statusKind = 'success';
    state.statusText =
      `Comparação concluída. Alterados: ${state.comparison.changedCount} | ` +
      `Removidos: ${state.comparison.onlyLeftCount} | ` +
      `Incluídos: ${state.comparison.onlyRightCount}.`;
  } catch (error) {
    clearComparisonState();
    state.statusKind = 'error';
    state.statusText = String(error?.message ?? error);
  } finally {
    state.comparing = false;
    await loadLocalData();
    render();
  }
};

const exportComparison = () => {
  if (!state.comparison || isBusy()) return;

  state.exporting = true;
  state.statusKind = 'info';
  state.statusText = 'Gerando Excel...';
  render();

  try {
    const cmp = state.comparison;
    const changedRows = getFilteredChangedRows();
    const reviewEntries = buildReviewExportEntries({
      changedRows,
      removedRows: cmp.onlyLeftSamples,
      includedRows: cmp.onlyRightSamples,
    });

    if (!reviewEntries.length) {
      state.statusKind = 'error';
      state.statusText = 'Não há diferenças para exportar.';
      return;
    }

    const { apiEntries, scriptEntries } = buildDetailExportEntries(reviewEntries);
    const reviewRowAddressByKey = new Map();
    const apiRowAddressByKey = new Map();
    const scriptRowAddressByKey = new Map();

    reviewEntries.forEach((entry, index) => {
      reviewRowAddressByKey.set(entry.key, getSheetCellAddress(index + 1, 1));
    });

    apiEntries.forEach((entry, index) => {
      apiRowAddressByKey.set(entry.reviewKey, getSheetCellAddress(index + 1, 0));
    });

    scriptEntries.forEach((entry, index) => {
      scriptRowAddressByKey.set(entry.reviewKey, getSheetCellAddress(index + 1, 0));
    });

    const safeBot = sanitizeFileName(state.meta?.botTitle || state.botId);
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    downloadWorkbook(`bot-side-panel-review-tecnica_${safeBot}_${safeDate}.xlsx`, [
      {
        name: REVIEW_SHEET_NAME,
        rows: [
          ['Tipo do bloco', 'ID do bloco', 'Nome do bloco', 'Descrição'],
          ...reviewEntries.map((entry) => entry.cells),
        ],
        afterAppend: ({ worksheet }) => {
          reviewEntries.forEach((entry, index) => {
            const apiTarget = apiRowAddressByKey.get(entry.key);
            const scriptTarget = scriptRowAddressByKey.get(entry.key);
            if (apiTarget) {
              setWorksheetInternalLink({
                worksheet,
                rowIndex: index + 1,
                colIndex: 1,
                targetSheetName: API_SHEET_NAME,
                targetCellAddress: apiTarget,
                tooltip: 'Abrir detalhes na aba API',
              });
              return;
            }
            if (scriptTarget) {
              setWorksheetInternalLink({
                worksheet,
                rowIndex: index + 1,
                colIndex: 1,
                targetSheetName: SCRIPT_SHEET_NAME,
                targetCellAddress: scriptTarget,
                tooltip: 'Abrir detalhes na aba Script',
              });
            }
          });
        },
      },
      apiEntries.length
        ? {
            name: API_SHEET_NAME,
            rows: [
              ['ID do bloco', 'Nome do bloco', 'URL Endpoint', 'Metodo HTTP', 'Header'],
              ...apiEntries.map((entry) => entry.cells),
            ],
            afterAppend: ({ worksheet }) => {
              apiEntries.forEach((entry, index) => {
                const reviewTarget = reviewRowAddressByKey.get(entry.reviewKey);
                if (!reviewTarget) return;
                setWorksheetInternalLink({
                  worksheet,
                  rowIndex: index + 1,
                  colIndex: 0,
                  targetSheetName: REVIEW_SHEET_NAME,
                  targetCellAddress: reviewTarget,
                  tooltip: 'Voltar para a aba Review Tecnica',
                });
              });
            },
          }
        : null,
      scriptEntries.length
        ? {
            name: SCRIPT_SHEET_NAME,
            rows: [
              ['ID do bloco', 'Nome do bloco', 'Script'],
              ...scriptEntries.map((entry) => entry.cells),
            ],
            afterAppend: ({ worksheet }) => {
              scriptEntries.forEach((entry, index) => {
                const reviewTarget = reviewRowAddressByKey.get(entry.reviewKey);
                if (!reviewTarget) return;
                setWorksheetInternalLink({
                  worksheet,
                  rowIndex: index + 1,
                  colIndex: 0,
                  targetSheetName: REVIEW_SHEET_NAME,
                  targetCellAddress: reviewTarget,
                  tooltip: 'Voltar para a aba Review Tecnica',
                });
              });
            },
          }
        : null,
    ]);

    state.statusKind = 'success';
    state.statusText = `Exportado: ${reviewEntries.length} linha(s).`;
  } finally {
    state.exporting = false;
    render();
  }
};

const bindEvents = () => {
  if (els.captureBtn) on(els.captureBtn, 'click', () => captureSnapshot());
  if (els.compareBtn) on(els.compareBtn, 'click', () => runComparison());
  if (els.exportBtn) on(els.exportBtn, 'click', () => exportComparison());

  if (els.baseSnapshot) {
    on(els.baseSnapshot, 'change', (event) => {
      state.baseSnapshotId = String(event?.target?.value ?? '');
      if (state.targetSnapshotId === state.baseSnapshotId) state.targetSnapshotId = '';
      clearComparisonState();
      render();
    });
  }

  if (els.targetType) {
    on(els.targetType, 'change', (event) => {
      state.targetType = String(event?.target?.value ?? TARGET_CURRENT);
      clearComparisonState();
      render();
    });
  }

  if (els.targetSnapshot) {
    on(els.targetSnapshot, 'change', (event) => {
      state.targetSnapshotId = String(event?.target?.value ?? '');
      clearComparisonState();
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

  if (els.groupsToggle) {
    on(els.groupsToggle, 'click', () => {
      state.detailsOpenAll = !state.detailsOpenAll;
      state.openDetailGroups = {};
      render();
    });
  }

  const onMessage = (message) => {
    if (disposed) return;

    if (message?.type === MessageType.CONTEXT_CHANGED) {
      loadContext()
        .then(() => render())
        .catch(() => undefined);
      return;
    }

    if (message?.type === MessageType.SYNC_STATUS) {
      applySyncStatus(message.state);
      render();
      if (!message.state?.running) {
        loadLocalData()
          .then(() => render())
          .catch(() => undefined);
      }
    }
  };

  chrome.runtime.onMessage.addListener(onMessage);
  cleanupFns.push(() => chrome.runtime.onMessage.removeListener(onMessage));
};

const init = async () => {
  bindEvents();
  state.loading = true;
  render();

  try {
    await Promise.all([loadContext(), loadStatus()]);
  } finally {
    state.loading = false;
    render();
  }

  const intervalId = setInterval(() => {
    loadContext()
      .then(() => render())
      .catch(() => undefined);
  }, 2000);
  cleanupFns.push(() => clearInterval(intervalId));
};

export const screenReviewTecnica = {
  id: 'review-tecnica',
  title: 'Review Técnica',
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
