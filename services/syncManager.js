import { fetchItemsSummary, fetchRootItems, fetchSubflowItems, fetchWhatsAppFlowItems } from './apiClient.js';
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

const normalizeCompactText = (value) => normalizeText(value).replace(/[^a-z0-9]/g, '');

const getItemId = (item) => {
  const raw = item?._id ?? item?.id ?? item?.itemId ?? null;
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
};

const getItemTitle = (item) => {
  const raw = item?.title ?? item?.name ?? item?.label ?? '';
  return String(raw ?? '').trim();
};

const isGroupContainerType = (item) => {
  const compactType = normalizeCompactText(item?.type ?? '');
  return compactType === 'group' || compactType === 'grupo' || compactType === 'subflow';
};

const isWhatsAppFlowType = (item) => normalizeCompactText(item?.type ?? '') === 'whatsappflow';

const getExchangeId = (exchange) => {
  const raw = exchange?._id ?? exchange?.id ?? exchange?.exchangeId ?? exchange?.itemId ?? null;
  if (raw === null || raw === undefined) return '';
  return String(raw).trim();
};

const extractContainerTask = (item) => {
  if (!item || typeof item !== 'object') return null;

  if (isGroupContainerType(item)) {
    const groupId = getItemId(item);
    if (!groupId) return null;
    return {
      groupId,
      groupTitle: getItemTitle(item) || groupId,
      kind: 'subflow',
    };
  }

  if (!isWhatsAppFlowType(item)) return null;

  const parentItemId = getItemId(item);
  if (!parentItemId) return null;

  const exchanges =
    (Array.isArray(item?.whatsappFlow?.exchanges) ? item.whatsappFlow.exchanges : null) ||
    (Array.isArray(item?.whatsapp_flow?.exchanges) ? item.whatsapp_flow.exchanges : null) ||
    (Array.isArray(item?.data?.whatsappFlow?.exchanges) ? item.data.whatsappFlow.exchanges : null) ||
    (Array.isArray(item?.data?.whatsapp_flow?.exchanges) ? item.data.whatsapp_flow.exchanges : null) ||
    (Array.isArray(item?.config?.whatsappFlow?.exchanges) ? item.config.whatsappFlow.exchanges : null) ||
    (Array.isArray(item?.config?.whatsapp_flow?.exchanges) ? item.config.whatsapp_flow.exchanges : null) ||
    [];

  if (!exchanges.length) return null;

  const parentTitle = getItemTitle(item) || parentItemId;
  const tasks = exchanges
    .map((exchange) => {
      const exchangeId = getExchangeId(exchange);
      if (!exchangeId) return null;
      return {
        taskId: `whatsapp_flow:${parentItemId}:${exchangeId}`,
        groupId: parentItemId,
        groupTitle: parentTitle,
        parentItemId,
        exchangeId,
        kind: 'whatsapp_flow',
      };
    })
    .filter(Boolean);

  return tasks.length ? tasks : null;
};

const extractContainerTasksFromItems = (items) =>
  (Array.isArray(items) ? items : [])
    .flatMap((item) => {
      const task = extractContainerTask(item);
      if (!task) return [];
      return Array.isArray(task) ? task : [task];
    })
    .filter(Boolean);

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

    const rootGroupId = firstLevelItems?._id ?? 'firstLevelItems';
    const tasks = [{ taskId: `root:${rootGroupId}`, groupId: rootGroupId, groupTitle: firstLevelItems?.title ?? 'Ponto Inicial', kind: 'root' }];
    const scheduledTaskIds = new Set([`root:${rootGroupId}`]);

    const scheduleTask = (task) => {
      const taskId = String(task?.taskId ?? task?.groupId ?? '').trim();
      const groupId = String(task?.groupId ?? '').trim();
      if (!taskId || !groupId || scheduledTaskIds.has(taskId)) return false;
      scheduledTaskIds.add(taskId);
      tasks.push({
        taskId,
        groupId,
        groupTitle: String(task?.groupTitle ?? '').trim() || groupId,
        kind: task?.kind === 'whatsapp_flow' ? 'whatsapp_flow' : 'subflow',
        parentItemId: task?.parentItemId ? String(task.parentItemId).trim() : '',
        exchangeId: task?.exchangeId ? String(task.exchangeId).trim() : '',
      });
      setState({ totalGroups: tasks.length });
      if (onProgress) onProgress(getSyncState());
      return true;
    };

    groupRecords.forEach((group) => {
      const groupId = String(group?.groupId ?? '').trim();
      if (!groupId || groupId === rootGroupId) return;
      scheduleTask({
        taskId: `subflow:${groupId}`,
        groupId,
        groupTitle: String(group?.title ?? '').trim() || groupId,
        kind: 'subflow',
      });
    });

    setState({ totalGroups: tasks.length, completedGroups: 0 });
    if (onProgress) onProgress(getSyncState());

    let fullCount = 0;
    let fullBytes = 0;
    let hasIvrType = false;
    let hasBotType = false;

    const worker = async (task) => {
      if (signal.aborted) return;
      let payload;
      try {
        payload =
          task.kind === 'root'
            ? await fetchRootItems(botId, authorization, signal)
            : task.kind === 'whatsapp_flow'
              ? await fetchWhatsAppFlowItems(
                  botId,
                  task.parentItemId || task.groupId,
                  task.exchangeId,
                  authorization,
                  signal,
                )
              : await fetchSubflowItems(botId, task.groupId, authorization, signal);
      } catch (error) {
        const status = Number(error?.status);
        if (task.kind === 'whatsapp_flow' && (status === 400 || status === 404)) {
          setState({ completedGroups: syncState.completedGroups + 1 });
          if (onProgress) onProgress(getSyncState());
          return;
        }
        throw error;
      }
      const items = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      extractContainerTasksFromItems(items).forEach((nestedTask) => {
        scheduleTask(nestedTask);
      });
      const detected = detectModeFromItems(items);
      if (detected === MODE_URA) hasIvrType = true;
      if (detected === MODE_BOT) hasBotType = true;
      if (task.kind === 'root') {
        const title = payload?.botTitle;
        if (title) {
          await mergeMeta(botId, { botTitle: title });
        }
      }

      const fullRecords = items.map((item) =>
        buildFullItemRecord(item, {
          groupId: task.groupId,
          groupTitle: task.groupTitle ?? task.groupId,
          flowExchangeId: task.kind === 'whatsapp_flow' ? task.exchangeId : '',
        }),
      );
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
