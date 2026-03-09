import { buildLexIntentRecord, clearLexIntentsData, saveBotLexIntents, getMeta, saveMeta } from '../data/db.js';

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

export const syncLexIntents = async ({ botId, items } = {}) => {
  if (!botId || !Array.isArray(items)) {
    throw new Error('Contexto incompleto para sincronizar intenções.');
  }

  await clearLexIntentsData(botId);

  const records = items.map((item) => buildLexIntentRecord(item));
  const samplesCount = records.reduce((acc, record) => acc + Number(record?.samplesCount ?? 0), 0);
  let bytes = 0;
  records.forEach((record) => {
    bytes += estimateBytes(record);
  });

  await saveBotLexIntents(botId, records);
  await mergeMeta(botId, {
    lastLexIntentsSyncAt: new Date().toISOString(),
    lexIntentsCount: records.length,
    lexSamplesCount: samplesCount,
    lexIntentsBytes: bytes,
  });

  return { lexIntentsCount: records.length, lexSamplesCount: samplesCount };
};
