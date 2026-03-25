export const API_BASE_URL = 'https://api.bots.digitalcontact.cloud/api/v3';
export const APP_BASE_URL = 'https://new.boteria.com.br';
const CONDITIONS_FETCH_KEY = 'kgjdhURyashsJKSkd2kkd98Yf7';

export const buildApiUrl = (path) => {
  const trimmedBase = API_BASE_URL.replace(/\/+$/, '');
  const trimmedPath = String(path ?? '').replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
};

export const buildAppUrl = (path) => {
  const trimmedBase = APP_BASE_URL.replace(/\/+$/, '');
  const trimmedPath = String(path ?? '').replace(/^\/+/, '');
  return `${trimmedBase}/${trimmedPath}`;
};

export const apiEndpoints = {
  rootItems: (botId) => buildApiUrl(`/bots/${botId}/items`),
  subflowItems: (botId, groupId) => buildApiUrl(`/bots/${botId}/items-subflow/${groupId}`),
  whatsappFlowItems: (botId, itemId, exchangeId) => buildApiUrl(`/bots/${botId}/items-subflow/${itemId}/flow/${exchangeId}`),
  itemsSummary: (botId) => buildApiUrl(`/bots/${botId}/items-summary`),
  builderPending: (botId, params = '') =>
    buildApiUrl(`/bots/${botId}/builder-pending${params ? `?${params}` : ''}`),
  builderTrackingDetails: (botId, apiId) =>
    buildApiUrl(`/bots/${botId}/builder-tracking/details/${apiId}`),
  botVariables: (botId, mode = 'bot') =>
    buildApiUrl(mode === 'ura' ? `/ivr/variables/${botId}` : `/bots/variable/${botId}`),
  botTags: (botId, mode = 'bot') =>
    buildApiUrl(mode === 'ura' ? `/ivr/${botId}/tag` : `/bots/tag/${botId}`),
  botAiIntents: () => `${buildApiUrl('/conditions/fetch')}?${new URLSearchParams({ key: CONDITIONS_FETCH_KEY }).toString()}`,
  uraAiAgentFunctions: () => buildApiUrl(`/ivr/ai-agent/functions`),
};
