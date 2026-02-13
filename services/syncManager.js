import { fetchItemsSummary, fetchRootItems, fetchSubflowItems } from './apiClient.js';
import {
  buildGroupRecord,
  buildSummaryItemRecord,
  buildFullItemRecord,
  saveGroups,
  saveSummaryItems,
  saveFullItems,
  saveMeta,
  getMeta,
  clearSummaryData,
  clearFullData,
} from '../data/db.js';
import { chunkArray, normalizeText } from '../shared/utils.js';
import { SYNC_BATCH_SIZE, SYNC_CONCURRENCY } from '../config/limits.js';
import { MODE_BOT, MODE_URA } from '../config/modeResolver.js';

let currentController = null;
let syncState = {
  running: false,
  phase: 'idle',
  botId: null,
  startedAt: null,
  summaryCount: 0,
  fullCount: 0,
  completedGroups: 0,
  totalGroups: 0,
  lastError: null,
};

export const getSyncState = () => ({ ...syncState });

const setState = (patch) => {
  syncState = { ...syncState, ...patch };
};

const abortCurrent = () => {
  if (currentController) {
    currentController.abort();
    currentController = null;
  }
};

const extractBotTitle = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const title =
    payload.bot?.title ??
    payload.data?.bot?.title ??
    payload.title ??
    payload.data?.title ??
    null;
  return typeof title === 'string' && title.trim() ? title.trim() : null;
};

const normalizeSummaryPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return { firstLevelItems: null, groups: [], botTitle: null };
  const firstLevelItems = payload.firstLevelItems ?? payload.data?.firstLevelItems ?? null;
  const groups = Array.isArray(payload.groups) ? payload.groups : payload.data?.groups ?? [];
  const botTitle = extractBotTitle(payload);
  return { firstLevelItems, groups, botTitle };
};

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

const countTypes = (items) => {
  const counts = {};
  for (const item of items) {
    const type = item?.type ?? '';
    const key = normalizeText(type);
    if (!key) continue;
    if (!counts[key]) {
      counts[key] = { count: 0, label: String(type).trim() || key };
    }
    counts[key].count += 1;
  }
  return counts;
};

const detectModeFromItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) return null;
  let hasIvr = false;
  let hasBot = false;
  for (const item of items) {
    const type = normalizeText(item?.type ?? '');
    if (!type) continue;
    if (type.startsWith('ivr')) {
      hasIvr = true;
      continue;
    }
    if (type === 'group' || type === 'grupo') continue;
    hasBot = true;
  }
  if (hasIvr) return MODE_URA;
  if (hasBot) return MODE_BOT;
  return null;
};

const runQueue = async (tasks, concurrency, worker, signal) => {
  let index = 0;
  const workers = new Array(concurrency).fill(0).map(async () => {
    while (index < tasks.length) {
      if (signal?.aborted) return;
      const current = tasks[index++];
      await worker(current);
    }
  });
  await Promise.all(workers);
};

export const startSync = async ({ botId, authorization, fullItems = false, onProgress } = {}) => {
  if (!botId || !authorization) throw new Error('Contexto incompleto para sincronizar.');
  abortCurrent();
  currentController = new AbortController();
  const signal = currentController.signal;

  setState({
    running: true,
    phase: 'summary',
    botId,
    startedAt: Date.now(),
    summaryCount: 0,
    fullCount: 0,
    completedGroups: 0,
    totalGroups: 0,
    lastError: null,
  });
  if (onProgress) onProgress(getSyncState());

  try {
    await clearSummaryData(botId);
    if (fullItems) await clearFullData(botId);

    const summaryPayload = await fetchItemsSummary(botId, authorization, signal);
    if (signal.aborted) return getSyncState();

    const { firstLevelItems, groups, botTitle } = normalizeSummaryPayload(summaryPayload);
    const groupRecords = [];
    let summaryBuffer = [];
    let summaryCount = 0;
    let summaryBytes = 0;

    const flushSummary = async () => {
      if (summaryBuffer.length === 0) return;
      const chunk = summaryBuffer;
      summaryBuffer = [];
      await saveSummaryItems(botId, chunk);
    };

    const processGroupItems = async (group, items, levelOverride) => {
      const groupId = group?._id ?? group?.id ?? group?.groupId ?? 'group';
      const level = levelOverride ?? group?.level ?? null;
      const typeCounts = countTypes(items);
      const groupRecord = buildGroupRecord({ ...group, _id: groupId, level }, {
        itemsCount: items.length,
        typeCounts,
      });
      groupRecords.push(groupRecord);
      summaryBytes += estimateBytes(groupRecord);

      for (const item of items) {
        const summaryRecord = buildSummaryItemRecord(item, { groupId, level });
        summaryBuffer.push(summaryRecord);
        summaryBytes += estimateBytes(summaryRecord);
        summaryCount += 1;
        if (summaryBuffer.length >= SYNC_BATCH_SIZE) {
          await flushSummary();
        }
      }
    };

    if (firstLevelItems?.items) {
      const rootGroup = {
        _id: firstLevelItems._id ?? 'firstLevelItems',
        title: firstLevelItems.title ?? 'Ponto Inicial',
        level: 0,
      };
      await processGroupItems(rootGroup, firstLevelItems.items, 0);
    }

    for (const group of groups) {
      const items = Array.isArray(group?.items) ? group.items : [];
      await processGroupItems(group, items, group?.level ?? null);
    }

    await flushSummary();
    await saveGroups(botId, groupRecords);

    setState({ summaryCount, totalGroups: groupRecords.length, phase: fullItems ? 'full' : 'summary_done' });
    if (onProgress) onProgress(getSyncState());

    const summaryMeta = {
      lastSummarySyncAt: new Date().toISOString(),
      summaryCount,
      summaryBytes,
      groupsCount: groupRecords.length,
    };
    if (botTitle) summaryMeta.botTitle = botTitle;
    await mergeMeta(botId, summaryMeta);

    if (!fullItems) {
      setState({ running: false, phase: 'idle' });
      if (onProgress) onProgress(getSyncState());
      return getSyncState();
    }

    const groupIds = groupRecords.map((g) => g.groupId);
    const tasks = [{ groupId: firstLevelItems?._id ?? 'firstLevelItems', kind: 'root' }];
    for (const groupId of groupIds) {
      if (groupId === (firstLevelItems?._id ?? 'firstLevelItems')) continue;
      tasks.push({ groupId, kind: 'subflow' });
    }

    setState({ totalGroups: tasks.length, completedGroups: 0 });
    if (onProgress) onProgress(getSyncState());

    let fullCount = 0;
    let fullBytes = 0;
    let hasIvrType = false;
    let hasBotType = false;

    const worker = async (task) => {
      if (signal.aborted) return;
      const payload =
        task.kind === 'root'
          ? await fetchRootItems(botId, authorization, signal)
          : await fetchSubflowItems(botId, task.groupId, authorization, signal);
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const detected = detectModeFromItems(items);
      if (detected === MODE_URA) hasIvrType = true;
      if (detected === MODE_BOT) hasBotType = true;
      if (task.kind === 'root') {
        const title = payload?.botTitle;
        if (title) {
          await mergeMeta(botId, { botTitle: title });
        }
      }

      const fullRecords = items.map((item) => buildFullItemRecord(item, { groupId: task.groupId }));
      fullRecords.forEach((record) => {
        fullBytes += estimateBytes(record);
      });
      for (const chunk of chunkArray(fullRecords, SYNC_BATCH_SIZE)) {
        await saveFullItems(botId, chunk);
      }
      fullCount += fullRecords.length;

      setState({ completedGroups: syncState.completedGroups + 1, fullCount });
      if (onProgress) onProgress(getSyncState());
    };

    await runQueue(tasks, SYNC_CONCURRENCY, worker, signal);
    if (signal.aborted) return getSyncState();

    setState({ fullCount, phase: 'full_done' });
    const detectedMode = hasIvrType ? MODE_URA : hasBotType ? MODE_BOT : null;
    const fullMeta = {
      lastItemsSyncAt: new Date().toISOString(),
      summaryCount,
      fullCount,
      fullBytes,
    };
    if (detectedMode) {
      fullMeta.mode = detectedMode;
      fullMeta.modeDetectedAt = new Date().toISOString();
    }
    await mergeMeta(botId, fullMeta);

    setState({ running: false, phase: 'idle' });
    if (onProgress) onProgress(getSyncState());
    return getSyncState();
  } catch (error) {
    setState({ running: false, phase: 'error', lastError: String(error?.message ?? error) });
    if (onProgress) onProgress(getSyncState());
    throw error;
  }
};

export const cancelSync = () => {
  abortCurrent();
  setState({ running: false, phase: 'idle' });
  return getSyncState();
};
