import { buildAppUrl } from '../../config/apiConfig.js';
import { specificFilterConfigsByType } from '../../filters/index.js';
import { getTypeLabel } from './typeLabels.js';

const appEndpoints = {
  builderBase: (botId) => buildAppUrl(`/bot/${botId}`),
};

export const botMode = {
  id: 'bot',
  label: 'BOT',
  labelArticle: 'do BOT',
  isUra: false,
  supported: true,
  iconsBasePath: 'assets/svgs/bot',
  getTypeLabel,
  appEndpoints,
  specificFilterConfigsByType,
};
