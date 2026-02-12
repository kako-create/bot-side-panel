import { apiV2FilterConfig } from './types/bot/apiV2.js';
import { conditionalFilterConfig } from './types/bot/conditional.js';
import { menuFilterConfig } from './types/bot/menu.js';
import { redirectFilterConfig } from './types/bot/redirect.js';
import { scriptFilterConfig } from './types/bot/script.js';
import { textFilterConfig } from './types/bot/text.js';

export const specificFilterConfigsByType = {
  Menu: menuFilterConfig,
  ApiV2: apiV2FilterConfig,
  'API v2': apiV2FilterConfig,
  'Api v2': apiV2FilterConfig,
  APIV2: apiV2FilterConfig,
  Text: textFilterConfig,
  Texto: textFilterConfig,
  Redirect: redirectFilterConfig,
  Direcionador: redirectFilterConfig,
  Conditional: conditionalFilterConfig,
  Condicional: conditionalFilterConfig,
  Script: scriptFilterConfig,
};
