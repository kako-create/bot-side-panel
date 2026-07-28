import { buildBlockLink } from '../links.js';

const CELL_CHUNK_SIZE = 32000;

export const TOPDESK_SUPPORTED_TYPES = Object.freeze([
  'TopdeskCreateTicket',
  'TopdeskInsertAttachment',
  'TopdeskRequesterValidation',
]);

const normalizeType = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const TYPE_BY_NORMALIZED = new Map(
  TOPDESK_SUPPORTED_TYPES.map((type) => [normalizeType(type), type]),
);

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

const COMMON_FIELD_PATHS = {
  quickAccess: withCommonRoots(['quickAccess', 'isQuickAccess']),
  checkpoint: withCommonRoots(['checkpoint', 'isCheckpoint']),
  tags: withCommonRoots(['tags', 'tagList']),
  conditionEscape: withCommonRoots([
    'conditionEscape',
    'escapeCondition',
    'escape.condition',
    'escape.destination',
    'escape.destinationId',
  ]),
  redirectToCheckpoint: withCommonRoots([
    'redirectToCheckpoint',
    'activateLastCheckpoint',
    'checkpointEscape',
    'escape.redirectToCheckpoint',
    'escape.checkpoint',
  ]),
  errorMessageFinal: withCommonRoots([
    'errorMessageFinal',
    'finalErrorMessage',
    'escape.message',
  ]),
  eventDescriptionActive: withCommonRoots([
    'eventDescription.active',
    'eventDescriptionActive',
    'switchEventDescription',
    'event.active',
  ]),
  eventDescriptionText: withCommonRoots([
    'eventDescription.description',
    'eventDescription.text',
    'eventDescriptionText',
    'event.description',
  ]),
};

const TOPDESK_ROOT_PATHS = [
  'topdesk',
  'data.topdesk',
  'config.topdesk',
  'data.config.topdesk',
];

const CUSTOM_FIELD_ALIASES = {
  apiField: ['apiField', 'field', 'path', 'responsePath'],
  variable: ['variable', 'variableName', 'value', 'targetVariable'],
  id: ['_id', 'id'],
};

const FIXED_OUTPUTS_BY_TYPE = Object.freeze({
  TopdeskCreateTicket: [
    ['Variável de retorno — Número do chamado', '{topdesk.ticket.number}'],
    ['Variável de retorno — Erro', '{topdesk.error}'],
  ],
  TopdeskInsertAttachment: [
    ['Variável de retorno — Erro', '{topdesk.error}'],
  ],
  TopdeskRequesterValidation: [
    ['Variável de retorno — ID do solicitante', '{topdesk.requesterId}'],
    ['Variável de retorno — Erro', '{topdesk.error}'],
  ],
});

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const hasOwn = (source, key) =>
  Object.prototype.hasOwnProperty.call(source ?? {}, key);

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

const pickFirstDefined = (source, paths = []) => {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
};

const pickOwnAlias = (source, aliases = []) => {
  if (!isPlainObject(source)) return undefined;
  for (const alias of aliases) {
    if (hasOwn(source, alias)) return source[alias];
  }
  return undefined;
};

const firstNonBlank = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (String(value).trim()) return value;
  }
  return '';
};

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
  const nestedType = TYPE_BY_NORMALIZED.get(normalizeType(getDirectType(nested)));

  return looksLikeStoredRecord || nestedType ? nested : record;
};

const resolveTopdeskType = (record) => {
  if (!isPlainObject(record)) return null;

  const directOuterType = getDirectType(record);
  if (directOuterType !== undefined && String(directOuterType).trim()) {
    return TYPE_BY_NORMALIZED.get(normalizeType(directOuterType)) ?? null;
  }

  const payload = getRecordPayload(record);
  const directPayloadType = getDirectType(payload);
  if (directPayloadType !== undefined && String(directPayloadType).trim()) {
    return TYPE_BY_NORMALIZED.get(normalizeType(directPayloadType)) ?? null;
  }

  for (const path of TYPE_PATHS.slice(4)) {
    const canonical = TYPE_BY_NORMALIZED.get(normalizeType(getNestedValue(payload, path)));
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

const getTopdeskConfig = (payload) => {
  for (const path of TOPDESK_ROOT_PATHS) {
    const value = getNestedValue(payload, path);
    if (isPlainObject(value)) return value;
  }
  return {};
};

const isSensitiveKey = (key) => {
  const normalized = String(key ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return (
    normalized.includes('password') ||
    normalized.includes('passwd') ||
    normalized === 'pwd' ||
    normalized.includes('senha')
  );
};

const isConfiguredSecret = (value) => {
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
  Object.entries(value).forEach(([key, nestedValue]) => {
    output[key] = isSensitiveKey(key)
      ? isConfiguredSecret(nestedValue)
        ? '[REDACTED]'
        : '[NÃO CONFIGURADA]'
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

const extractReferences = (sources = []) => {
  const references = new Map();
  const pattern = /\$\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}|\{\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}\}|\{([A-Za-zÀ-ÖØ-öø-ÿ_$][A-Za-zÀ-ÖØ-öø-ÿ0-9_.$:\-]*)\}/g;

  const visit = (value, location, seen = new WeakSet()) => {
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
          references.get(token).locations.add(location);
        }
        match = pattern.exec(value);
      }
      return;
    }
    if (typeof value !== 'object') return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((entry, index) => visit(entry, `${location}[${index}]`, seen));
      return;
    }
    Object.entries(value).forEach(([key, nestedValue]) => {
      if (isSensitiveKey(key)) return;
      visit(nestedValue, location ? `${location}.${key}` : key, seen);
    });
  };

  sources.forEach(({ value, location }) => visit(value, location));
  return Array.from(references.values(), ({ name, token, locations }) => ({
    name,
    token,
    locations: Array.from(locations),
  }));
};

const getTopdeskData = (record) => {
  const payload = getRecordPayload(record);
  const config = getTopdeskConfig(payload);
  const type = resolveTopdeskType(record);
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
    config,
    type,
    itemId,
    title,
    groupId,
    groupTitle: firstNonBlank(
      record?.groupTitle,
      pickFirstDefined(payload, withCommonRoots(['groupTitle', 'group.title', 'group.name'])),
    ),
    flowExchangeId: firstNonBlank(
      record?.flowExchangeId,
      pickFirstDefined(payload, withCommonRoots(['flowExchangeId', 'exchangeId'])),
    ),
    quickAccess: pickFirstDefined(payload, COMMON_FIELD_PATHS.quickAccess),
    checkpoint: pickFirstDefined(payload, COMMON_FIELD_PATHS.checkpoint),
    tags: pickFirstDefined(payload, COMMON_FIELD_PATHS.tags),
    conditionEscape: pickFirstDefined(payload, COMMON_FIELD_PATHS.conditionEscape),
    redirectToCheckpoint: pickFirstDefined(payload, COMMON_FIELD_PATHS.redirectToCheckpoint),
    errorMessageFinal: pickFirstDefined(payload, COMMON_FIELD_PATHS.errorMessageFinal),
    eventDescriptionActive: pickFirstDefined(payload, COMMON_FIELD_PATHS.eventDescriptionActive),
    eventDescriptionText: pickFirstDefined(payload, COMMON_FIELD_PATHS.eventDescriptionText),
    acceptFiles: pickFirstDefined(payload, withCommonRoots(['acceptFiles'])),
  };
};

const appendCustomFields = (model, rawFields) => {
  if (!Array.isArray(rawFields) || rawFields.length === 0) {
    appendField(model, 'Campos customizados', '');
    return;
  }

  rawFields.forEach((entry, index) => {
    const prefix = `Campo customizado ${index + 1}`;
    if (!isPlainObject(entry)) {
      appendField(model, prefix, entry);
      return;
    }

    const apiField = pickOwnAlias(entry, CUSTOM_FIELD_ALIASES.apiField);
    const variable = pickOwnAlias(entry, CUSTOM_FIELD_ALIASES.variable);
    const id = pickOwnAlias(entry, CUSTOM_FIELD_ALIASES.id);
    appendField(model, `${prefix} — Campo da API`, apiField);
    appendField(model, `${prefix} — Variável / valor`, variable);
    appendField(model, `${prefix} — ID`, id);

    const knownKeys = new Set(Object.values(CUSTOM_FIELD_ALIASES).flat());
    const additional = Object.fromEntries(
      Object.entries(entry).filter(([key]) => !knownKeys.has(key)),
    );
    if (Object.keys(additional).length > 0) {
      appendField(
        model,
        `${prefix} — Configuração adicional (JSON)`,
        redactSensitive(additional),
      );
    }
  });
};

const appendAuthenticationFields = (model, config) => {
  const password = pickOwnAlias(config, [
    'password',
    'passwd',
    'pwd',
    'senha',
    'clientPassword',
  ]);
  appendField(model, 'Autenticação TOPdesk', pickOwnAlias(config, [
    'hasTopdeskAuthentication',
    'topdeskAuthentication',
  ]));
  appendField(model, 'Valores dinâmicos / API Manager', pickOwnAlias(config, [
    'useManagerApi',
    'useManagerAPI',
  ]));
  appendField(model, 'Login', pickOwnAlias(config, ['login', 'username', 'userName']));
  appendField(model, 'Senha', isConfiguredSecret(password) ? 'Configurada' : 'Não configurada');
};

const appendCreateTicketFields = (model, config) => {
  appendField(model, 'ID do solicitante', config.requesterId);
  appendField(model, 'Nome do cliente', config.clientName);
  appendField(model, 'Telefone', config.phoneNumber);
  appendField(model, 'E-mail', config.email);
  appendField(model, 'Título do chamado', config.ticketTitle);
  appendField(model, 'Descrição do chamado', config.ticketDescription);
  appendField(model, 'Grupo de operadores', firstNonBlank(
    config.operatorsGroupId,
    config.operatorGroupId,
  ));
  appendField(model, 'Categoria', config.categoryId);
  appendField(model, 'Subcategoria', firstNonBlank(config.subCategoryId, config.subcategoryId));
  appendField(model, 'Tipo de incidente', config.callTypeId);
  appendField(model, 'Tipo de registro', config.entryTypeId);
  appendField(model, 'Invisível para o solicitante', config.invisibleForCaller);
};

const appendInsertAttachmentFields = (model, config) => {
  appendField(model, 'Número do chamado', config.ticketNumber);
  appendField(model, 'ID do solicitante', config.requesterId);
  appendField(model, 'Invisível para o solicitante', config.invisibleForCaller);
};

const appendRequesterValidationFields = (model, config) => {
  appendField(model, 'Campo da API para validação', config.apiField);
  appendField(model, 'Valor para validação', config.validationValue);
  appendField(model, 'Invisível para o solicitante', config.invisibleForCaller);
};

/** Identifica exclusivamente os três tipos BOT Topdesk suportados. */
export const isTopdeskRecord = (record) => Boolean(resolveTopdeskType(record));

/** Filtra registros Topdesk sem alterar a ordem nem os objetos de origem. */
export const getTopdeskRecords = (records) =>
  (Array.isArray(records) ? records : []).filter((record) => isTopdeskRecord(record));

/**
 * Transforma blocos Topdesk em linhas verticais para uma futura planilha XLSX.
 * A função é pura: não acessa DOM, Blob nem SheetJS.
 */
export const buildTopdeskExportRows = ({
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
  const topdeskRecords = getTopdeskRecords(records);
  const exportDate = normalizeDate(exportedAt, new Date());
  const countsByType = Object.fromEntries(
    TOPDESK_SUPPORTED_TYPES.map((type) => [type, 0]),
  );
  topdeskRecords.forEach((record) => {
    const type = resolveTopdeskType(record);
    if (type) countsByType[type] += 1;
  });

  const model = {
    rows: [],
    links: [],
    headerRows: [],
    topdeskCount: topdeskRecords.length,
    countsByType,
    exportedAt: exportDate,
  };

  appendHeader(model);
  appendField(model, 'Exportação', 'Topdesk');
  appendField(model, 'Bot ID', botId);
  appendField(model, 'Bot', botTitle);
  appendField(model, 'Modo', mode);
  appendField(model, 'Exportado em', exportDate);
  appendField(model, 'Consulta executada em', normalizeDate(searchedAt));
  appendField(model, 'Última sincronização completa', normalizeDate(lastItemsSyncAt));
  appendField(model, 'Critérios da consulta', redactSensitive(criteria ?? ''));
  appendField(model, 'Resultado truncado', Boolean(truncated));
  appendField(model, 'Total de blocos Topdesk', topdeskRecords.length);
  TOPDESK_SUPPORTED_TYPES.forEach((type) => {
    appendField(model, `Total ${type}`, countsByType[type]);
  });
  appendField(
    model,
    'Aviso de segurança',
    'O arquivo pode conter dados pessoais e configurações sensíveis. Senhas são sempre omitidas.',
  );
  appendBlankRow(model);

  topdeskRecords.forEach((record, index) => {
    const data = getTopdeskData(record);
    const config = data.config;
    const resolvedBotId = firstNonBlank(
      botId,
      pickRecordValue(record, withCommonRoots(['botId', 'bot._id', 'bot.id'])),
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
    appendField(model, 'Bloco Topdesk', `${index + 1} de ${topdeskRecords.length}`);
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

    appendAuthenticationFields(model, config);

    if (data.type === 'TopdeskCreateTicket') {
      appendCreateTicketFields(model, config);
    } else if (data.type === 'TopdeskInsertAttachment') {
      appendInsertAttachmentFields(model, config);
      appendField(model, 'Arquivos aceitos / configurados', data.acceptFiles);
    } else if (data.type === 'TopdeskRequesterValidation') {
      appendRequesterValidationFields(model, config);
    }

    appendCustomFields(model, pickOwnAlias(config, ['customFields', 'fields']));

    (FIXED_OUTPUTS_BY_TYPE[data.type] ?? []).forEach(([label, value]) => {
      appendField(model, label, value);
    });

    appendField(model, 'Mensagem de finalização', data.errorMessageFinal);
    appendField(model, 'Rota de fuga', data.conditionEscape);
    appendField(model, 'Ativar último checkpoint', data.redirectToCheckpoint);
    appendField(model, 'Descrição de evento ativa', data.eventDescriptionActive);
    appendField(model, 'Descrição do evento', data.eventDescriptionText);

    const references = extractReferences([
      { value: config, location: 'topdesk' },
      { value: data.errorMessageFinal, location: 'errorMessageFinal' },
      { value: data.eventDescriptionText, location: 'eventDescription.description' },
    ]);
    if (references.length > 0) {
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

    appendField(model, 'Configuração Topdesk (JSON)', redactSensitive(config));
    appendBlankRow(model);
  });

  return model;
};
