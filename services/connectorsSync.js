import {
  clearFlowConnectors,
  getGroupsByBot,
  getMeta,
  saveFlowConnectors,
  saveMeta,
} from '../data/db.js';
import { fetchRootConnectors, fetchSubflowConnectors } from './apiClient.js';

const ROOT_SCOPE_ID = 'root';
const CONCURRENCY = 4;

const connectorIdOf = (connector, index) =>
  String(connector?._id ?? connector?.id ?? `connector-${index}`);

const buildRecords = (connectors, { scopeId, scope, groupId = null, groupTitle = '' }) =>
  (Array.isArray(connectors) ? connectors : []).map((connector, index) => ({
    scopeId,
    scope,
    groupId,
    groupTitle,
    connectorId: connectorIdOf(connector, index),
    payload: connector ?? null,
  }));

const runQueue = async (tasks, worker) => {
  let cursor = 0;
  const workers = new Array(Math.min(CONCURRENCY, Math.max(tasks.length, 1)))
    .fill(null)
    .map(async () => {
      while (cursor < tasks.length) {
        const index = cursor;
        cursor += 1;
        await worker(tasks[index]);
      }
    });
  await Promise.all(workers);
};

export const syncFlowConnectors = async ({ botId, authorization, signal } = {}) => {
  const resolvedBotId = String(botId ?? '').trim();
  if (!resolvedBotId || !authorization) {
    throw new Error('Contexto incompleto para sincronizar conectores.');
  }

  const [meta, groups] = await Promise.all([
    getMeta(resolvedBotId),
    getGroupsByBot(resolvedBotId),
  ]);
  if (!meta?.lastItemsSyncAt) {
    throw new Error('Execute uma sincronização completa antes de sincronizar os conectores.');
  }

  const orderedGroups = (Array.isArray(groups) ? groups : []).slice().sort((left, right) => {
    const levelDiff = Number(left?.level ?? 0) - Number(right?.level ?? 0);
    if (levelDiff !== 0) return levelDiff;
    return String(left?.title ?? '').localeCompare(String(right?.title ?? ''), 'pt-BR');
  });
  const rootGroup =
    orderedGroups.find((group) => Number(group?.level) === 0) ??
    orderedGroups.find((group) => String(group?.groupId) === 'firstLevelItems') ??
    null;
  const subflows = orderedGroups.filter(
    (group) => String(group?.groupId ?? '') && group !== rootGroup,
  );

  const rootConnectors = await fetchRootConnectors(resolvedBotId, authorization, signal);
  const records = buildRecords(rootConnectors, {
    scopeId: ROOT_SCOPE_ID,
    scope: 'root',
    groupId: rootGroup?.groupId ?? null,
    groupTitle: rootGroup?.title ?? 'Fluxo principal',
  });
  const warnings = [];

  await runQueue(subflows, async (group) => {
    const groupId = String(group.groupId);
    try {
      const connectors = await fetchSubflowConnectors(
        resolvedBotId,
        groupId,
        authorization,
        signal,
      );
      records.push(
        ...buildRecords(connectors, {
          scopeId: groupId,
          scope: 'subflow',
          groupId,
          groupTitle: group.title ?? groupId,
        }),
      );
    } catch (error) {
      if (signal?.aborted) throw error;
      warnings.push({
        code: 'SUBFLOW_CONNECTORS_FETCH_FAILED',
        groupId,
        groupTitle: group.title ?? groupId,
        message: String(error?.message ?? error),
      });
    }
  });

  if (signal?.aborted) throw new Error('Sincronização de conectores cancelada.');

  await clearFlowConnectors(resolvedBotId);
  await saveFlowConnectors(resolvedBotId, records);

  const synchronizedAt = new Date().toISOString();
  const successfulScopesCount = 1 + subflows.length - warnings.length;
  await saveMeta({
    ...(meta ?? {}),
    botId: resolvedBotId,
    lastConnectorsSyncAt: synchronizedAt,
    connectorsForItemsSyncAt: meta.lastItemsSyncAt,
    connectorsCount: records.length,
    connectorScopesCount: successfulScopesCount,
    connectorsComplete: warnings.length === 0,
    connectorWarnings: warnings,
  });

  return {
    botId: resolvedBotId,
    synchronizedAt,
    connectorsCount: records.length,
    scopesCount: successfulScopesCount,
    complete: warnings.length === 0,
    warnings,
  };
};
