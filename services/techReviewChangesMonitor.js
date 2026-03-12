import { fetchBuilderPendingPage } from './apiClient.js';
import {
  getTechReviewChangeMonitor,
  saveTechReviewChangeEvents,
  saveTechReviewChangeMonitor,
  searchFullItems,
} from '../data/db.js';
import { normalizeText } from '../shared/utils.js';

const toText = (value) => String(value ?? '').trim();

const toTimestamp = (value) => {
  const raw = String(value ?? '').trim();
  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric < 1e12 ? numeric * 1000 : numeric;
    }
  }
  const ms = new Date(value ?? '').getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const getDocApiId = (doc) => toText(doc?._id ?? '');

const getDocDescription = (doc, indexedDescription) =>
  toText(indexedDescription ?? doc?.description ?? doc?.desc ?? doc?.text ?? doc?.content ?? doc?.message ?? '');

const getDocTitle = (doc, indexedTitle, description, targetId) =>
  toText(
    indexedTitle ??
      doc?.title ??
      doc?.docTitle ??
      doc?.label ??
      doc?.name ??
      doc?.fieldName ??
      doc?.fieldLabel ??
      doc?.documentTitle ??
      doc?.documentName ??
      doc?.itemTitle ??
      doc?.blockTitle ??
      description ??
      targetId ??
      '',
  ) || 'Sem título';

const getDocType = (doc) =>
  toText(doc?.itemType ?? doc?.type ?? doc?.docType ?? doc?.documentType ?? doc?.blockType ?? '');

const getDocUpdatedAt = (doc) =>
  toText(doc?.when ?? doc?.updatedAt ?? doc?.createdAt ?? doc?.date ?? doc?.timestamp ?? '');

const getDocUserName = (doc) => toText(doc?.userName ?? doc?.user ?? '') || 'Desconhecido';

const getDocAction = (doc) => toText(doc?.action ?? doc?.event ?? '') || 'unknown';

const getItemId = (item) => toText(item?.itemId ?? item?._id ?? item?.id ?? '');

const getItemTitle = (item) =>
  toText(
    item?.title ??
      item?.label ??
      item?.name ??
      item?.text ??
      item?.description ??
      item?.type ??
      '',
  ) || 'Sem título';

const getItemDescription = (item) =>
  toText(
    item?.description ??
      item?.subtitle ??
      item?.helpText ??
      item?.text ??
      item?.label ??
      item?.name ??
      item?.title ??
      '',
  );

const getItemType = (item) => toText(item?.type ?? item?.payload?.type ?? '');

const buildPendingItemIndex = (items = []) => {
  const index = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const itemId = getItemId(item);
    if (!itemId || index.has(itemId)) return;
    index.set(itemId, {
      title: getItemTitle(item),
      description: getItemDescription(item),
      type: getItemType(item),
    });
  });
  return index;
};

const pushTargetCandidate = (targetSet, value) => {
  const raw = toText(value);
  if (raw) targetSet.add(raw);
};

const collectDocTargetIds = (doc) => {
  const out = new Set();
  pushTargetCandidate(out, doc?.targetModelId);
  pushTargetCandidate(out, doc?.targetId);
  pushTargetCandidate(out, doc?.blockId);
  pushTargetCandidate(out, doc?.itemId);
  pushTargetCandidate(out, doc?.modelId);
  pushTargetCandidate(out, doc?.target?._id);
  pushTargetCandidate(out, doc?.target?.id);
  pushTargetCandidate(out, doc?.target?.itemId);
  pushTargetCandidate(out, doc?.targetModel?._id);
  pushTargetCandidate(out, doc?.targetModel?.id);
  pushTargetCandidate(out, doc?.targetModel?.itemId);
  pushTargetCandidate(out, doc?.document?._id);
  pushTargetCandidate(out, doc?.document?.id);
  pushTargetCandidate(out, doc?.document?.itemId);
  pushTargetCandidate(out, doc?.id);
  pushTargetCandidate(out, doc?._id);
  return Array.from(out);
};

const selectResolvedTargetId = (targetIds, itemIndex, apiId) => {
  const ids = Array.isArray(targetIds) ? targetIds : [];
  const matchedId = ids.find((candidate) => itemIndex.has(candidate));
  if (matchedId) return matchedId;
  const nonApiId = ids.find((candidate) => candidate && candidate !== apiId);
  if (nonApiId) return nonApiId;
  return ids[0] ?? '';
};

const buildChangeId = ({ apiId, targetId, updatedAtTs, action, userName }) =>
  apiId || `${targetId || 'sem-target'}:${updatedAtTs || 0}:${action || 'unknown'}:${userName || 'desconhecido'}`;

const normalizePendingChange = (doc, observedAt, itemIndex = new Map()) => {
  const apiId = getDocApiId(doc);
  const targetIds = collectDocTargetIds(doc);
  const targetId = selectResolvedTargetId(targetIds, itemIndex, apiId);
  const indexedItem = targetId ? itemIndex.get(targetId) : null;
  const description = getDocDescription(doc, indexedItem?.description);
  const providerUpdatedAt = getDocUpdatedAt(doc);
  const providerUpdatedAtTs = toTimestamp(providerUpdatedAt);
  const userName = getDocUserName(doc);
  const action = getDocAction(doc);
  const title = getDocTitle(doc, indexedItem?.title, description, targetId);
  const type = getDocType(doc) || indexedItem?.type || null;
  const updatedAt = providerUpdatedAt || observedAt;
  const updatedAtTs = providerUpdatedAtTs || toTimestamp(observedAt);

  return {
    changeId: buildChangeId({ apiId, targetId, updatedAtTs, action, userName }),
    apiId: apiId || null,
    targetId: targetId || null,
    targetIds: targetIds.length ? targetIds : targetId ? [targetId] : [],
    title,
    titleFold: normalizeText(title),
    description,
    type,
    typeFold: normalizeText(type),
    userName,
    action,
    updatedAt: updatedAt || null,
    updatedAtTs,
    updatedAtSource: providerUpdatedAtTs ? 'provider' : 'observed',
    observedAt,
  };
};

const fetchAllPendingChanges = async (botId, authorization, signal) => {
  const firstPage = await fetchBuilderPendingPage(botId, authorization, { signal });
  let allDocs = Array.isArray(firstPage?.docs) ? [...firstPage.docs] : [];
  const totalDocs =
    typeof firstPage?.totalDocs === 'number' ? firstPage.totalDocs : allDocs.length;
  const totalPages =
    typeof firstPage?.totalPages === 'number'
      ? firstPage.totalPages
      : typeof firstPage?.limit === 'number' && totalDocs > 0
        ? Math.ceil(totalDocs / firstPage.limit)
        : 1;

  if (firstPage?.hasNextPage === true || totalPages > 1) {
    for (let page = 2; page <= Math.max(1, totalPages); page += 1) {
      const nextPage = await fetchBuilderPendingPage(botId, authorization, { page, signal });
      if (Array.isArray(nextPage?.docs) && nextPage.docs.length > 0) {
        allDocs = allDocs.concat(nextPage.docs);
      }
      if (nextPage?.hasNextPage === false) break;
    }
  }

  return {
    docs: allDocs,
    totalDocs,
  };
};

export const syncTechReviewChangeHistory = async ({ botId, authorization, signal } = {}) => {
  const resolvedBotId = toText(botId);
  if (!resolvedBotId) throw new Error('botId ausente para monitorar histórico da review técnica.');
  if (!authorization || !authorization.toLowerCase().startsWith('bearer ')) {
    throw new Error('Token de autorização inválido ou ausente.');
  }

  const observedAt = new Date().toISOString();
  const [currentMeta, payload, fullItems] = await Promise.all([
    getTechReviewChangeMonitor(resolvedBotId),
    fetchAllPendingChanges(resolvedBotId, authorization, signal),
    searchFullItems(resolvedBotId, { limit: 0 }),
  ]);
  const itemIndex = buildPendingItemIndex(fullItems);

  const events = payload.docs.map((doc) => normalizePendingChange(doc, observedAt, itemIndex));
  if (events.length > 0) {
    await saveTechReviewChangeEvents(resolvedBotId, events);
  }

  const oldestObservedAt = currentMeta?.oldestObservedAt
    ? String(currentMeta.oldestObservedAt)
    : observedAt;
  const newestUpdatedAtTs = events.reduce(
    (max, event) => Math.max(max, Number(event?.updatedAtTs ?? 0)),
    0,
  );

  const nextMeta = {
    ...(currentMeta || { botId: resolvedBotId }),
    botId: resolvedBotId,
    monitoringEnabled: currentMeta?.monitoringEnabled !== false,
    status: 'active',
    reason: null,
    lastPollAt: observedAt,
    lastSuccessAt: observedAt,
    oldestObservedAt,
    docsSeenLastPoll: events.length,
    newestUpdatedAt: newestUpdatedAtTs > 0 ? new Date(newestUpdatedAtTs).toISOString() : null,
    newestUpdatedAtTs,
    lastError: null,
  };
  await saveTechReviewChangeMonitor(nextMeta);

  return {
    botId: resolvedBotId,
    observedAt,
    docsSeen: events.length,
    totalDocs: payload.totalDocs,
    newestUpdatedAtTs,
  };
};

export const saveTechReviewChangeMonitorError = async (botId, error) => {
  const resolvedBotId = toText(botId);
  if (!resolvedBotId) return;
  const currentMeta = await getTechReviewChangeMonitor(resolvedBotId);
  await saveTechReviewChangeMonitor({
    ...(currentMeta || { botId: resolvedBotId }),
    botId: resolvedBotId,
    monitoringEnabled: currentMeta?.monitoringEnabled !== false,
    status: currentMeta?.monitoringEnabled === false ? 'paused' : 'paused',
    reason: currentMeta?.monitoringEnabled === false ? 'manual' : 'error',
    lastPollAt: new Date().toISOString(),
    lastError: String(error?.message ?? error ?? 'Erro desconhecido'),
  });
};

export const setTechReviewChangeMonitorEnabled = async (botId, enabled) => {
  const resolvedBotId = toText(botId);
  if (!resolvedBotId) throw new Error('botId ausente para configurar o monitor da review técnica.');

  const currentMeta = await getTechReviewChangeMonitor(resolvedBotId);
  const nextEnabled = Boolean(enabled);
  const now = new Date().toISOString();
  const nextMeta = {
    ...(currentMeta || { botId: resolvedBotId }),
    botId: resolvedBotId,
    monitoringEnabled: nextEnabled,
    status: nextEnabled ? 'active' : 'paused',
    reason: nextEnabled ? null : 'manual',
    lastToggledAt: now,
  };
  if (!nextEnabled) {
    nextMeta.stoppedAt = now;
  } else {
    nextMeta.stoppedAt = null;
    nextMeta.lastError = null;
  }
  await saveTechReviewChangeMonitor(nextMeta);
  return nextMeta;
};

export const saveTechReviewChangeMonitorStatus = async (botId, patch = {}) => {
  const resolvedBotId = toText(botId);
  if (!resolvedBotId) return null;
  const currentMeta = await getTechReviewChangeMonitor(resolvedBotId);
  const nextMeta = {
    ...(currentMeta || { botId: resolvedBotId }),
    botId: resolvedBotId,
    ...patch,
  };
  await saveTechReviewChangeMonitor(nextMeta);
  return nextMeta;
};
