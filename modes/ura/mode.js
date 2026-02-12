import { buildAppUrl } from '../../config/apiConfig.js';
import { uraSpecificFilterConfigsByType } from '../../filters/ura.js';
import { getTypeLabel } from './typeLabels.js';

const appEndpoints = {
  builderBase: (botId) => buildAppUrl(`/ivr/${botId}`),
};

export const uraMode = {
  id: 'ura',
  label: 'URA',
  labelArticle: 'da URA',
  isUra: true,
  supported: true,
  iconsBasePath: 'assets/svgs/ura',
  getTypeLabel,
  appEndpoints,
  specificFilterConfigsByType: uraSpecificFilterConfigsByType,
};
