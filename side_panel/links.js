import { buildAppUrl } from '../config/apiConfig.js';

const ALLOWED_APP_HOSTS = new Set(['bots.digitalcontact.cloud', 'new.boteria.com.br']);

const normalizeAppBaseUrl = (value) => {
  if (!value) return null;
  try {
    const parsed = new URL(String(value));
    if (!ALLOWED_APP_HOSTS.has(parsed.hostname)) return null;
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
};

const buildBuilderBase = (botId, mode, appBaseUrl = null) => {
  const builderPath = mode === 'ura' ? `/ivr/${botId}` : `/bot/${botId}`;
  const preferredBaseUrl = normalizeAppBaseUrl(appBaseUrl);
  if (preferredBaseUrl) return `${preferredBaseUrl}${builderPath}`;
  return buildAppUrl(builderPath);
};

const buildQueryString = (params) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    const normalized = String(value ?? '').trim();
    if (!normalized) return;
    searchParams.set(key, normalized);
  });
  return searchParams.toString();
};

export const buildBlockLink = ({
  botId,
  mode,
  itemId,
  groupId,
  flowExchangeId,
  searchValue = null,
  appBaseUrl = null,
}) => {
  if (!botId || !itemId) return null;
  const baseUrl = buildBuilderBase(botId, mode, appBaseUrl);
  const resolvedItemId = String(itemId).trim();
  const resolvedGroupId = String(groupId ?? '').trim();
  const resolvedExchangeId = String(flowExchangeId ?? '').trim();
  const resolvedSearchValue = String(searchValue ?? '').trim() || resolvedItemId;
  const query = buildQueryString({
    search: resolvedSearchValue,
    center: resolvedItemId,
    item: resolvedItemId,
  });
  const isRoot = !groupId || groupId === 'firstLevelItems';
  if (isRoot) {
    return `${baseUrl}/builder?${query}`;
  }
  const subflowPath = `${baseUrl}/builder/subflow/${encodeURIComponent(resolvedGroupId)}`;
  const flowPath = resolvedExchangeId ? `${subflowPath}/flow/${encodeURIComponent(resolvedExchangeId)}` : subflowPath;
  return `${flowPath}?${query}`;
};
