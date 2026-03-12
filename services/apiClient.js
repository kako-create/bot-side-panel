import { apiEndpoints } from '../config/apiConfig.js';
import {
  ALTERACOES_PAGE_LIMIT,
  API_FETCH_TIMEOUT_MS,
  API_RETRY_BASE_DELAY_MS,
} from '../config/limits.js';

const delay = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          reject(new Error('aborted'));
        },
        { once: true },
      );
    }
  });

const mergeSignals = (signals) => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (!signal) continue;
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
};

const fetchWithRetry = async (url, options, retries = 2) => {
  const timeoutMs = options.timeoutMs ?? API_FETCH_TIMEOUT_MS;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = mergeSignals([options.signal, timeoutController.signal]);

    try {
      const response = await fetch(url, { ...options, signal });
      if (response.status === 429 || response.status === 503) {
        if (attempt < retries) {
          await delay(API_RETRY_BASE_DELAY_MS * Math.pow(2, attempt), options.signal);
          continue;
        }
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error('Falha de rede após retries.');
};

const parseJson = async (response) => {
  if (!response.ok) {
    const text = await response.text();
    const error =
      response.status === 419
        ? new Error('Token de autorização expirado. Recarregue a página do Boteria e tente novamente.')
        : new Error(`HTTP ${response.status}: ${text}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }
  const payload = await response.json();
  if (typeof payload !== 'string') return payload;

  const trimmed = payload.trim();
  if (!trimmed) return payload;
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return payload;

  try {
    return JSON.parse(trimmed);
  } catch {
    return payload;
  }
};

const normalizeList = (payload, fallbackKeys = []) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload;
  const candidates = [];
  if (fallbackKeys.length > 0) {
    for (const key of fallbackKeys) {
      candidates.push(obj[key]);
    }
  }
  candidates.push(obj.data, obj.result);
  if (obj.data && typeof obj.data === 'object') {
    const data = obj.data;
    candidates.push(data.items, data.blocks, data.variables, data.tags, data.docs, data.conditions, data.intents, data.functions);
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
};

const extractBotTitle = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const bot = payload.bot;
  const data = payload.data;
  const dataBot = data?.bot;
  const title = bot?.title ?? dataBot?.title ?? payload.title ?? data?.title ?? null;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return null;
};

export const fetchItemsSummary = async (botId, authorization, signal) => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.itemsSummary(botId), {
    headers: { Authorization: authorization },
    signal,
  });
  const payload = await parseJson(response);
  return payload;
};

export const fetchRootItems = async (botId, authorization, signal) => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.rootItems(botId), {
    headers: { Authorization: authorization },
    signal,
  });
  const payload = await parseJson(response);
  const items = normalizeList(payload, ['items']);
  return { items, botTitle: extractBotTitle(payload) };
};

export const fetchSubflowItems = async (botId, groupId, authorization, signal) => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.subflowItems(botId, groupId), {
    headers: { Authorization: authorization },
    signal,
  });
  const payload = await parseJson(response);
  return normalizeList(payload, ['items']);
};

export const fetchBotVariables = async (botId, authorization, mode = 'bot', signal) => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.botVariables(botId, mode), {
    headers: { Authorization: authorization },
    signal,
  });
  const payload = await parseJson(response);

  const out = [];
  const addGroup = (groupKey, list) => {
    if (!Array.isArray(list)) return;
    list.forEach((item) => {
      if (item && typeof item === 'object') {
        out.push({ ...item, __group: groupKey });
        return;
      }
      out.push({ value: item, __group: groupKey });
    });
  };

  addGroup('local', payload?.local);
  addGroup('bot', payload?.bot);
  addGroup('global', payload?.global);
  addGroup('vtex', payload?.vtex);
  addGroup('ads', payload?.ads);
  if (payload?.human && typeof payload.human === 'object') {
    for (const value of Object.values(payload.human)) {
      addGroup('human', value);
    }
  }

  if (out.length > 0) return out;
  addGroup('outros', normalizeList(payload, ['variables', 'items', 'docs']));
  return out;
};

export const fetchBotTags = async (botId, authorization, mode = 'bot', signal) => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.botTags(botId, mode), {
    headers: { Authorization: authorization },
    signal,
  });
  const payload = await parseJson(response);

  const botTags = Array.isArray(payload?.bot) ? payload.bot : [];
  const globalTags = Array.isArray(payload?.global) ? payload.global : [];
  if (botTags.length || globalTags.length) {
    return [...botTags, ...globalTags];
  }
  return normalizeList(payload, ['tags', 'items', 'docs']);
};

export const fetchBuilderPendingPage = async (
  botId,
  authorization,
  { page = 1, limit = ALTERACOES_PAGE_LIMIT, signal } = {},
) => {
  if (!botId) {
    throw new Error('botId ausente para buscar alterações pendentes.');
  }
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  const response = await fetchWithRetry(apiEndpoints.builderPending(botId, params.toString()), {
    headers: { Authorization: authorization },
    signal,
  });
  return parseJson(response);
};

export const fetchBuilderTrackingDetails = async (botId, apiId, authorization, signal) => {
  if (!botId) {
    throw new Error('botId ausente para buscar detalhes da alteração.');
  }
  if (!apiId) {
    throw new Error('apiId ausente para buscar detalhes da alteração.');
  }
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.builderTrackingDetails(botId, apiId), {
    headers: { Authorization: authorization },
    signal,
  });
  return parseJson(response);
};

export const fetchBotAiIntents = async (botId, authorization, signal) => {
  if (!botId) {
    throw new Error('botId ausente para buscar intenções.');
  }
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.botAiIntents(), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ botId }),
    signal,
  });
  const payload = await parseJson(response);
  return normalizeList(payload, ['conditions', 'intents', 'items', 'docs']);
};

export const fetchUraAiAgentFunctions = async (authorization, signal) => {
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }
  const response = await fetchWithRetry(apiEndpoints.uraAiAgentFunctions(), {
    headers: { Authorization: authorization },
    signal,
  });
  const payload = await parseJson(response);

  // Esperado: array OU { functions: [...] } OU { docs: [...] } etc.
  let list = normalizeList(payload, ['functions', 'docs', 'items']);

  // Alternativa: { functions: { name: {...} } }
  if (list.length === 0) {
    const obj = payload?.functions;
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      list = Object.entries(obj).map(([name, value]) => {
        if (value && typeof value === 'object') return { name, ...value };
        return { name, value };
      });
    }
  }

  // Alternativa: payload e um mapa.
  if (list.length === 0 && payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const entries = Object.entries(payload);
    if (entries.length > 0 && entries.length <= 200) {
      list = entries.map(([name, value]) => {
        if (value && typeof value === 'object') return { name, ...value };
        return { name, value };
      });
    }
  }

  return list;
};
