import { fetchBotVariables } from './apiClient.js';
import { buildVariableRecord, clearVariablesData, saveBotVariables, getMeta, saveMeta } from '../data/db.js';

const estimateBytes = (value) => {
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
};

const mergeMeta = async (botId, patch) => {
  const current = (await getMeta(botId)) || {};
  await saveMeta({ ...current, botId, ...patch });
};

export const syncBotVariables = async ({ botId, authorization, mode = 'bot' } = {}) => {
  if (!botId || !authorization) {
    throw new Error('Contexto incompleto para sincronizar variáveis.');
  }

  await clearVariablesData(botId);
  const items = await fetchBotVariables(botId, authorization, mode);

  const records = (items || []).map((item) => buildVariableRecord(item, { groupKey: item?.__group }));
  let bytes = 0;
  records.forEach((record) => {
    bytes += estimateBytes(record);
  });

  await saveBotVariables(botId, records);
  await mergeMeta(botId, {
    lastVariablesSyncAt: new Date().toISOString(),
    variablesCount: records.length,
    variablesBytes: bytes,
  });

  return { variablesCount: records.length };
};
