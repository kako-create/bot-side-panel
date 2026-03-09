import { fetchBotAiIntents } from './apiClient.js';
import { buildIntentRecord, clearIntentsData, saveBotIntents, getMeta, saveMeta } from '../data/db.js';

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

export const syncBotIntents = async ({ botId, authorization, items } = {}) => {
  if (!botId || (!authorization && !Array.isArray(items))) {
    throw new Error('Contexto incompleto para sincronizar intenções.');
  }

  await clearIntentsData(botId);
  const resolvedItems = Array.isArray(items) ? items : await fetchBotAiIntents(botId, authorization);

  const records = (resolvedItems || []).map((item) => buildIntentRecord(item));
  let bytes = 0;
  records.forEach((record) => {
    bytes += estimateBytes(record);
  });

  await saveBotIntents(botId, records);
  await mergeMeta(botId, {
    lastIntentsSyncAt: new Date().toISOString(),
    intentsCount: records.length,
    intentsBytes: bytes,
  });

  return { intentsCount: records.length };
};
