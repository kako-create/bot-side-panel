import { buildBlockLink } from '../links.js';

const SHEET_NAME = 'APIs';
const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXCEL_CELL_LIMIT = 32767;
const CELL_CHUNK_SIZE = 32000;

const TYPE_PATHS = [
  'type',
  'blockType',
  'itemType',
  'componentType',
  'data.type',
  'config.type',
  'data.config.type',
];

const COMMON_ROOTS = ['', 'data', 'config', 'data.config'];

const withCommonRoots = (paths = []) =>
  Array.from(
    new Set(
      paths.flatMap((path) =>
        COMMON_ROOTS.map((root) => (root ? `${root}.${path}` : path)),
      ),
    ),
  );

const FIELD_PATHS = {
  quickAccess: withCommonRoots(['quickAccess', 'isQuickAccess']),
  checkpoint: withCommonRoots(['checkpoint', 'isCheckpoint']),
  tags: withCommonRoots(['tags', 'tagList']),
  endpoint: withCommonRoots([
    'urlEndpoint',
    'endpoint',
    'url',
    'apiUrl',
    'request.urlEndpoint',
    'request.endpoint',
    'request.url',
  ]),
  method: withCommonRoots([
    'methodType',
    'method',
    'httpMethod',
    'request.methodType',
    'request.method',
    'request.httpMethod',
  ]),
  typingTime: withCommonRoots([
    'timeTypping',
    'timeTyping',
    'typingTime',
    'typingSeconds',
  ]),
  jsonPayload: withCommonRoots([
    'jsonPayload',
    'requestPayload',
    'body',
    'request.jsonPayload',
    'request.payload',
    'request.body',
    'request.data',
    'payload',
  ]),
  headers: withCommonRoots([
    'headers',
    'customHeaders',
    'request.headers',
    'request.customHeaders',
  ]),
  variables: withCommonRoots([
    'apiV2Variables',
    'responseVariables',
    'response.variables',
  ]),
  waitResponse: withCommonRoots([
    'waitResponse',
    'awaitResponse',
    'request.waitResponse',
    'response.waitResponse',
  ]),
  timeout: withCommonRoots([
    'timeout',
    'timeoutMs',
    'request.timeout',
    'request.timeoutMs',
  ]),
  waitingResponseMessage: withCommonRoots([
    'waitingResponseMessage',
    'processingMessage',
    'response.waitingResponseMessage',
  ]),
  conditionEscape: withCommonRoots([
    'conditionEscape',
    'escapeCondition',
    'escape.condition',
  ]),
  redirectToCheckpoint: withCommonRoots([
    'redirectToCheckpoint',
    'activateLastCheckpoint',
    'escape.redirectToCheckpoint',
  ]),
  eventDescriptionActive: withCommonRoots([
    'eventDescription.active',
    'eventDescriptionActive',
    'event.active',
  ]),
  eventDescriptionText: withCommonRoots([
    'eventDescription.description',
    'eventDescriptionText',
    'event.description',
  ]),
};

const HEADER_NAME_ALIASES = ['key', 'name', 'label', 'header', 'field'];
const HEADER_VALUE_ALIASES = ['value', 'content', 'result', 'text', 'data'];
const VARIABLE_NAME_ALIASES = ['variable', 'name', 'key', 'variableName'];
const VARIABLE_VALUE_ALIASES = ['value', 'result', 'path', 'responsePath'];

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const hasOwn = (source, key) =>
  Object.prototype.hasOwnProperty.call(source ?? {}, key);

const getNestedValue = (source, path) => {
  if (source === null || source === undefined) return undefined;
  const parts = Array.isArray(path) ? path : String(path ?? '').split('.');
  let current = source;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current?.[part];
  }
  return current;
};

const pickFirstDefined = (source, paths = []) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const normalizeType = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const isApiV2Type = (value) => normalizeType(value) === 'apiv2';

const getRecordPayload = (record) => {
  if (!isPlainObject(record)) return {};
  const nested = record.payload;
  if (!isPlainObject(nested)) return record;

  const nestedHasApiType = TYPE_PATHS.some((path) => isApiV2Type(getNestedValue(nested, path)));
  const looksLikeStoredRecord =
    hasOwn(record, 'titleFold') ||
    hasOwn(record, 'typeFold') ||
    (nestedHasApiType && (hasOwn(record, 'itemId') || hasOwn(record, 'groupId')));

  return looksLikeStoredRecord ? nested : record;
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

const pickOwnAlias = (source, aliases = []) => {
  if (!isPlainObject(source)) return { found: false, value: undefined };
  for (const alias of aliases) {
    if (hasOwn(source, alias)) return { found: true, value: source[alias] };
  }
  return { found: false, value: undefined };
};

const firstNonBlank = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (String(value).trim()) return value;
  }
  return '';
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

const normalizeHeaders = (input) => {
  const entries = [];

  const visit = (candidate) => {
    const value = parseStructuredString(candidate);

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry));
      return;
    }

    if (isPlainObject(value)) {
      const name = pickOwnAlias(value, HEADER_NAME_ALIASES);
      const content = pickOwnAlias(value, HEADER_VALUE_ALIASES);
      if (name.found || content.found) {
        if (Array.isArray(name.value) || Array.isArray(content.value)) {
          const names = Array.isArray(name.value) ? name.value : [name.value];
          const contents = Array.isArray(content.value) ? content.value : [content.value];
          const total = Math.max(names.length, contents.length);
          for (let index = 0; index < total; index += 1) {
            entries.push({
              name: names[index],
              value: contents[index],
              hasName: name.found && index < names.length,
              hasValue: content.found && index < contents.length,
              raw: value,
            });
          }
          return;
        }
        entries.push({
          name: name.value,
          value: content.value,
          hasName: name.found,
          hasValue: content.found,
          raw: value,
        });
        return;
      }

      Object.entries(value).forEach(([key, nestedValue]) => {
        entries.push({
          name: key,
          value: nestedValue,
          hasName: true,
          hasValue: true,
          raw: { [key]: nestedValue },
        });
      });
      return;
    }

    entries.push({
      name: undefined,
      value,
      hasName: false,
      hasValue: true,
      raw: value,
    });
  };

  if (input !== undefined && input !== null) visit(input);
  return entries;
};

const normalizeVariables = (input) => {
  const entries = [];

  const visit = (candidate) => {
    const value = parseStructuredString(candidate);

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry));
      return;
    }

    if (isPlainObject(value)) {
      const name = pickOwnAlias(value, VARIABLE_NAME_ALIASES);
      const content = pickOwnAlias(value, VARIABLE_VALUE_ALIASES);
      if (name.found || content.found) {
        if (Array.isArray(name.value) || Array.isArray(content.value)) {
          const names = Array.isArray(name.value) ? name.value : [name.value];
          const contents = Array.isArray(content.value) ? content.value : [content.value];
          const total = Math.max(names.length, contents.length);
          for (let index = 0; index < total; index += 1) {
            entries.push({
              name: names[index],
              value: contents[index],
              hasName: name.found && index < names.length,
              hasValue: content.found && index < contents.length,
              raw: value,
            });
          }
          return;
        }
        entries.push({
          name: name.value,
          value: content.value,
          hasName: name.found,
          hasValue: content.found,
          raw: value,
        });
        return;
      }

      Object.entries(value).forEach(([key, nestedValue]) => {
        entries.push({
          name: key,
          value: nestedValue,
          hasName: true,
          hasValue: true,
          raw: { [key]: nestedValue },
        });
      });
      return;
    }

    entries.push({
      name: undefined,
      value,
      hasName: false,
      hasValue: true,
      raw: value,
    });
  };

  if (input !== undefined && input !== null) visit(input);
  return entries;
};

const formatPairedEntry = (entry, separator) => {
  const name = stringifyValue(entry?.name);
  const value = stringifyValue(entry?.value);
  if (entry?.hasName && entry?.hasValue) return `${name}${separator}${value}`;
  if (entry?.hasName) return name;
  if (entry?.hasValue) return value;
  return stringifyValue(entry?.raw);
};

const extractBraceReferences = (sources = []) => {
  const references = new Map();
  const pattern = /\$\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}|\{\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}\}|\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}/g;

  sources.forEach(({ value, location }) => {
    const text = stringifyValue(value);
    if (!text) return;
    pattern.lastIndex = 0;
    let match = pattern.exec(text);
    while (match) {
      const name = String(match[1] ?? match[2] ?? match[3] ?? '').trim();
      const token = String(match[0] ?? '').trim();
      if (name) {
        if (!references.has(token)) {
          references.set(token, { name, token, locations: new Set() });
        }
        references.get(token).locations.add(location);
      }
      match = pattern.exec(text);
    }
  });

  return Array.from(references.values(), ({ name, token, locations }) => ({
    name,
    token,
    locations: Array.from(locations),
  }));
};

const normalizeDate = (value, fallback = null) => {
  const resolved = value ?? fallback;
  if (resolved === undefined || resolved === null || resolved === '') return '';
  const date = resolved instanceof Date ? resolved : new Date(resolved);
  if (Number.isNaN(date.getTime())) return String(resolved);
  return date.toISOString();
};

const sanitizeFileNamePart = (value, fallback = 'bot') =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 80) || fallback;

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

const getApiData = (record) => {
  const payload = getRecordPayload(record);
  const itemId = firstNonBlank(
    record?.itemId,
    record?.displayId,
    record?._id,
    record?.id,
    pickFirstDefined(payload, ['_id', 'id', 'itemId']),
  );
  const title = firstNonBlank(
    record?.title,
    pickFirstDefined(payload, withCommonRoots(['title', 'name', 'label'])),
  );
  const groupId = firstNonBlank(
    record?.groupId,
    pickFirstDefined(payload, withCommonRoots([
      'groupId',
      'subflowId',
      'group._id',
      'group.id',
    ])),
  );

  return {
    payload,
    itemId,
    title,
    type: firstNonBlank(
      record?.type,
      TYPE_PATHS.map((path) => getNestedValue(payload, path)).find((value) => isApiV2Type(value)),
      'ApiV2',
    ),
    groupId,
    groupTitle: firstNonBlank(
      record?.groupTitle,
      pickFirstDefined(payload, withCommonRoots(['groupTitle', 'group.title', 'group.name'])),
    ),
    flowExchangeId: firstNonBlank(
      record?.flowExchangeId,
      pickFirstDefined(payload, withCommonRoots(['flowExchangeId', 'exchangeId'])),
    ),
    quickAccess: pickFirstDefined(payload, FIELD_PATHS.quickAccess),
    checkpoint: pickFirstDefined(payload, FIELD_PATHS.checkpoint),
    tags: pickFirstDefined(payload, FIELD_PATHS.tags),
    endpoint: pickFirstDefined(payload, FIELD_PATHS.endpoint),
    method: pickFirstDefined(payload, FIELD_PATHS.method),
    typingTime: pickFirstDefined(payload, FIELD_PATHS.typingTime),
    jsonPayload: pickFirstDefined(payload, FIELD_PATHS.jsonPayload),
    headers: pickFirstDefined(payload, FIELD_PATHS.headers),
    variables: pickFirstDefined(payload, FIELD_PATHS.variables),
    waitResponse: pickFirstDefined(payload, FIELD_PATHS.waitResponse),
    timeout: pickFirstDefined(payload, FIELD_PATHS.timeout),
    waitingResponseMessage: pickFirstDefined(payload, FIELD_PATHS.waitingResponseMessage),
    conditionEscape: pickFirstDefined(payload, FIELD_PATHS.conditionEscape),
    redirectToCheckpoint: pickFirstDefined(payload, FIELD_PATHS.redirectToCheckpoint),
    eventDescriptionActive: pickFirstDefined(payload, FIELD_PATHS.eventDescriptionActive),
    eventDescriptionText: pickFirstDefined(payload, FIELD_PATHS.eventDescriptionText),
  };
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
    const chunk = value.slice(offset, end);
    const rowIndex = model.rows.length;
    const chunkLabel = chunkIndex === 0
      ? String(label ?? '')
      : `${String(label ?? '')} (continuação ${chunkIndex + 1})`;
    model.rows.push([chunkLabel, chunk]);
    if (chunkIndex === 0 && link) {
      model.links.push({ row: rowIndex, column: 1, target: link });
    }
    if (firstRowIndex < 0) firstRowIndex = rowIndex;
    offset = end;
    chunkIndex += 1;
  }
  return firstRowIndex;
};

const toHttpLink = (value) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed) || /[\u0000-\u001f]/.test(trimmed)) return null;
  if (trimmed.length > EXCEL_CELL_LIMIT) return null;
  return trimmed;
};

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

/**
 * Identifica somente blocos BOT cujo tipo normalizado seja ApiV2.
 */
export const isApiV2Record = (record) => {
  if (!isPlainObject(record)) return false;

  const outerType = pickFirstDefined(record, ['type', 'blockType', 'itemType', 'componentType']);
  if (outerType !== undefined && String(outerType).trim()) return isApiV2Type(outerType);

  const payload = getRecordPayload(record);
  const payloadType = pickFirstDefined(payload, ['type', 'blockType', 'itemType', 'componentType']);
  if (payloadType !== undefined && String(payloadType).trim()) return isApiV2Type(payloadType);

  return ['data.type', 'config.type', 'data.config.type'].some((path) =>
    isApiV2Type(getNestedValue(payload, path)),
  );
};

/**
 * Filtra os registros ApiV2 sem alterar a ordem nem os objetos de origem.
 */
export const getApiV2Records = (records) =>
  (Array.isArray(records) ? records : []).filter((record) => isApiV2Record(record));

/**
 * Transforma os registros em linhas verticais. A função é pura e pode ser
 * usada para validar a exportação sem acessar DOM, Blob ou SheetJS.
 */
export const buildApiV2ExportRows = ({
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
  const apiRecords = getApiV2Records(records);
  const exportDate = normalizeDate(exportedAt, new Date());
  const model = {
    rows: [],
    links: [],
    headerRows: [],
    apiCount: apiRecords.length,
    exportedAt: exportDate,
  };

  appendHeader(model);
  appendField(model, 'Exportação', 'APIs v2');
  appendField(model, 'Bot ID', botId);
  appendField(model, 'Bot', botTitle);
  appendField(model, 'Modo', mode);
  appendField(model, 'Exportado em', exportDate);
  appendField(model, 'Consulta executada em', normalizeDate(searchedAt));
  appendField(model, 'Última sincronização completa', normalizeDate(lastItemsSyncAt));
  appendField(model, 'Critérios da consulta', criteria ?? '');
  appendField(model, 'Resultado truncado', Boolean(truncated));
  appendField(model, 'Total de APIs', apiRecords.length);
  appendField(
    model,
    'Aviso de segurança',
    'O arquivo pode conter credenciais, tokens e outros valores sensíveis configurados nos headers e payloads.',
  );
  appendBlankRow(model);

  apiRecords.forEach((record, index) => {
    const data = getApiData(record);
    const resolvedBotId = firstNonBlank(
      botId,
      pickRecordValue(record, withCommonRoots(['botId', 'bot._id', 'bot.id'])),
    );
    const groupLabel = firstNonBlank(
      getGroupLabel(groupsById, data.groupId),
      data.groupTitle,
      data.groupId,
    );
    const headers = normalizeHeaders(data.headers);
    const variables = normalizeVariables(data.variables);
    const headerReferences = headers.map((entry, headerIndex) => ({
      value: formatPairedEntry(entry, ': '),
      location: `Header ${headerIndex + 1}`,
    }));
    const references = extractBraceReferences([
      { value: data.endpoint, location: 'URL' },
      ...headerReferences,
      { value: data.jsonPayload, location: 'Payload JSON' },
    ]);
    const blockLink = createBlockLink({
      botId: resolvedBotId,
      mode,
      appBaseUrl,
      data,
    });

    appendHeader(model);
    appendField(model, 'API', `${index + 1} de ${apiRecords.length}`);
    appendField(model, 'Bot ID', resolvedBotId);
    appendField(model, 'ID do bloco', data.itemId);
    appendField(model, 'Nome do bloco', data.title);
    appendField(model, 'Tipo', data.type);
    appendField(model, 'Grupo', groupLabel);
    appendField(model, 'ID do grupo', data.groupId);
    appendField(model, 'Link do bloco', blockLink ?? '', { link: blockLink });
    appendField(model, 'Acesso rápido', data.quickAccess);
    appendField(model, 'Checkpoint', data.checkpoint);
    appendField(model, 'Tags', data.tags);
    appendField(model, 'URL', data.endpoint, { link: toHttpLink(data.endpoint) });
    appendField(model, 'Método', data.method);
    appendField(model, 'Tempo de digitação (segundos)', data.typingTime);
    appendField(model, 'Payload JSON', data.jsonPayload);

    if (headers.length) {
      headers.forEach((entry, headerIndex) => {
        appendField(model, `Header ${headerIndex + 1}`, formatPairedEntry(entry, ': '));
      });
    } else {
      appendField(model, 'Headers', '');
    }

    if (variables.length) {
      variables.forEach((entry, variableIndex) => {
        appendField(
          model,
          `Variável da resposta ${variableIndex + 1}`,
          formatPairedEntry(entry, ' ← '),
        );
      });
    } else {
      appendField(model, 'Variáveis da resposta', '');
    }

    appendField(model, 'Aguardar resposta', data.waitResponse);
    appendField(model, 'Timeout (ms)', data.timeout);
    appendField(model, 'Mensagem durante processamento', data.waitingResponseMessage);
    appendField(model, 'Rota de fuga', data.conditionEscape);
    appendField(model, 'Ativar último checkpoint', data.redirectToCheckpoint);
    appendField(model, 'Descrição de evento ativa', data.eventDescriptionActive);
    appendField(model, 'Descrição do evento', data.eventDescriptionText);

    if (references.length) {
      references.forEach((reference, referenceIndex) => {
        appendField(
          model,
          `Variável usada ${referenceIndex + 1}`,
          `${reference.token} — ${reference.locations.join(', ')}`,
        );
      });
    } else {
      appendField(model, 'Variáveis usadas', '');
    }

    appendBlankRow(model);
  });

  return model;
};

const applyWorksheetPresentation = (worksheet, model, xlsx) => {
  worksheet['!cols'] = [
    { wch: 34 },
    { wch: 105 },
  ];

  model.links.forEach(({ row, column, target }) => {
    const address = xlsx.utils.encode_cell({ r: row, c: column });
    const cell = worksheet[address];
    if (!cell || !target) return;
    cell.l = {
      Target: target,
      Tooltip: 'Abrir link',
    };
  });
};

const downloadWorkbookBlob = (filename, data) => {
  if (typeof globalThis.Blob !== 'function') {
    throw new Error('Blob não está disponível neste ambiente.');
  }
  if (!globalThis.document?.createElement || !globalThis.document?.body) {
    throw new Error('O download do arquivo requer um documento do navegador.');
  }
  if (!globalThis.URL?.createObjectURL) {
    throw new Error('A criação de URL para download não está disponível.');
  }

  const blob = new Blob([data], { type: XLSX_MIME_TYPE });
  const url = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  globalThis.document.body.appendChild(anchor);

  try {
    anchor.click();
  } finally {
    anchor.remove();
    globalThis.setTimeout(() => globalThis.URL.revokeObjectURL(url), 1000);
  }
};

/**
 * Gera e baixa uma planilha XLSX com uma seção vertical por bloco ApiV2.
 */
export const exportApiV2Workbook = (options = {}) => {
  const xlsx = globalThis.XLSX ?? null;
  if (!xlsx?.utils?.aoa_to_sheet || !xlsx?.utils?.book_new || !xlsx?.write) {
    throw new Error('SheetJS não está disponível no painel.');
  }

  const model = buildApiV2ExportRows(options);
  const worksheet = xlsx.utils.aoa_to_sheet(model.rows);
  applyWorksheetPresentation(worksheet, model, xlsx);

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);
  const data = xlsx.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  });

  const safeBot = sanitizeFileNamePart(options.botTitle || options.botId, 'bot');
  const safeDate = sanitizeFileNamePart(model.exportedAt, 'exportacao');
  const filename = `bot-side-panel-apis_${safeBot}_${safeDate}.xlsx`;
  downloadWorkbookBlob(filename, data);

  return {
    count: model.apiCount,
    filename,
    exportedCount: model.apiCount,
  };
};
