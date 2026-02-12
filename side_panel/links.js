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

export const buildBlockLink = ({ botId, mode, itemId, groupId, appBaseUrl = null }) => {
  if (!botId || !itemId) return null;
  const baseUrl = buildBuilderBase(botId, mode, appBaseUrl);
  const isRoot = !groupId || groupId === 'firstLevelItems';
  if (isRoot) {
    return `${baseUrl}/builder?search=${itemId}&item=${itemId}&center=${itemId}`;
  }
  return `${baseUrl}/builder/subflow/${groupId}?search=${itemId}&center=${itemId}&item=${itemId}`;
};
