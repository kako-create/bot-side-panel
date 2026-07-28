const ROOT_SCOPE_ID = 'root';

const payloadOf = (record) => record?.payload ?? null;

const sortByTitle = (left, right) =>
  String(left?.title ?? '').localeCompare(String(right?.title ?? ''), 'pt-BR');

export const buildFlowJsonSnapshot = ({
  meta,
  groups = [],
  items = [],
  connectors = [],
  variables = [],
  tags = [],
  exportedAt = new Date().toISOString(),
} = {}) => {
  const orderedGroups = (Array.isArray(groups) ? groups : []).slice().sort((left, right) => {
    const levelDiff = Number(left?.level ?? 0) - Number(right?.level ?? 0);
    return levelDiff || sortByTitle(left, right);
  });
  const rootConnector = connectors.find((connector) => connector?.scope === 'root');
  const rootGroup =
    orderedGroups.find(
      (group) =>
        rootConnector?.groupId &&
        String(group?.groupId ?? '') === String(rootConnector.groupId),
    ) ??
    orderedGroups.find((group) => Number(group?.level) === 0) ??
    orderedGroups.find((group) => String(group?.groupId) === 'firstLevelItems') ??
    null;
  const rootGroupId = String(rootGroup?.groupId ?? rootConnector?.groupId ?? 'firstLevelItems');

  const itemsByGroup = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const groupId = String(item?.groupId ?? rootGroupId);
    if (!itemsByGroup.has(groupId)) itemsByGroup.set(groupId, []);
    itemsByGroup.get(groupId).push(payloadOf(item));
  }

  const connectorsByScope = new Map();
  for (const connector of Array.isArray(connectors) ? connectors : []) {
    const scopeId = String(connector?.scopeId ?? connector?.groupId ?? ROOT_SCOPE_ID);
    if (!connectorsByScope.has(scopeId)) connectorsByScope.set(scopeId, []);
    connectorsByScope.get(scopeId).push(payloadOf(connector));
  }

  const subflowIds = new Set(
    orderedGroups
      .map((group) => String(group?.groupId ?? ''))
      .filter((groupId) => groupId && groupId !== rootGroupId),
  );
  for (const groupId of itemsByGroup.keys()) {
    if (groupId !== rootGroupId) subflowIds.add(groupId);
  }
  for (const connector of connectors) {
    const groupId = String(connector?.groupId ?? '');
    if (connector?.scope === 'subflow' && groupId) subflowIds.add(groupId);
  }

  const groupById = new Map(
    orderedGroups.map((group) => [String(group?.groupId ?? ''), group]),
  );
  const subflows = {};
  for (const groupId of subflowIds) {
    const group = groupById.get(groupId);
    subflows[groupId] = {
      name: group?.title ?? `Subflow ${groupId}`,
      items: itemsByGroup.get(groupId) ?? [],
      connectors: connectorsByScope.get(groupId) ?? [],
    };
  }

  return {
    format: 'bot-side-panel-flow',
    version: 1,
    botId: String(meta?.botId ?? ''),
    botTitle: meta?.botTitle ?? null,
    mode: meta?.mode ?? null,
    capturedAt: exportedAt,
    synchronization: {
      itemsAt: meta?.lastItemsSyncAt ?? null,
      connectorsAt: meta?.lastConnectorsSyncAt ?? null,
      variablesAt: meta?.lastVariablesSyncAt ?? null,
      tagsAt: meta?.lastTagsSyncAt ?? null,
    },
    root: {
      groupId: rootGroupId,
      name: rootGroup?.title ?? 'Fluxo principal',
      items: itemsByGroup.get(rootGroupId) ?? [],
      connectors: connectorsByScope.get(ROOT_SCOPE_ID) ?? [],
    },
    subflows,
    groups: orderedGroups,
    variables: variables.map(payloadOf),
    tags: tags.map(payloadOf),
    warnings: Array.isArray(meta?.connectorWarnings) ? meta.connectorWarnings : [],
  };
};

export const downloadFlowJsonSnapshot = (snapshot) => {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeBot = String(snapshot?.botTitle ?? snapshot?.botId ?? 'bot')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'bot';
  const safeDate = String(snapshot?.capturedAt ?? new Date().toISOString()).replace(/[:.]/g, '-');
  anchor.href = url;
  anchor.download = `bot-side-panel-flow_${safeBot}_${safeDate}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
