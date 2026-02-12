import { fetchBotTags } from './apiClient.js';
import { buildTagRecord, clearTagsData, saveBotTags, getMeta, saveMeta } from '../data/db.js';

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

export const syncBotTags = async ({ botId, authorization, mode = 'bot' } = {}) => {
  if (!botId || !authorization) {
    throw new Error('Contexto incompleto para sincronizar TAGs.');
  }

  await clearTagsData(botId);
  const items = await fetchBotTags(botId, authorization, mode);

  const records = (items || []).map((item) => buildTagRecord(item));
  let bytes = 0;
  records.forEach((record) => {
    bytes += estimateBytes(record);
  });

  await saveBotTags(botId, records);
  await mergeMeta(botId, {
    lastTagsSyncAt: new Date().toISOString(),
    tagsCount: records.length,
    tagsBytes: bytes,
  });

  return { tagsCount: records.length };
};

