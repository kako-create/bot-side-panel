import { apiV2FilterConfig } from './types/bot/apiV2.js';
import { cardFilterConfig } from './types/bot/card.js';
import { conditionalFilterConfig } from './types/bot/conditional.js';
import { humanFilterConfig } from './types/bot/human.js';
import { menuFilterConfig } from './types/bot/menu.js';
import { redirectFilterConfig } from './types/bot/redirect.js';
import { scriptFilterConfig } from './types/bot/script.js';
import { textFilterConfig } from './types/bot/text.js';
import {
  topdeskCreateTicketFilterConfig,
  topdeskInsertAttachmentFilterConfig,
  topdeskRequesterValidationFilterConfig,
} from './types/bot/topdesk.js';

export const specificFilterConfigsByType = {
  Menu: menuFilterConfig,
  ApiV2: apiV2FilterConfig,
  'API v2': apiV2FilterConfig,
  'Api v2': apiV2FilterConfig,
  APIV2: apiV2FilterConfig,
  Card: cardFilterConfig,
  card: cardFilterConfig,
  Human: humanFilterConfig,
  human: humanFilterConfig,
  Humano: humanFilterConfig,
  humano: humanFilterConfig,
  BotTransfer: humanFilterConfig,
  bottransfer: humanFilterConfig,
  Text: textFilterConfig,
  Texto: textFilterConfig,
  Redirect: redirectFilterConfig,
  Direcionador: redirectFilterConfig,
  Conditional: conditionalFilterConfig,
  Condicional: conditionalFilterConfig,
  Script: scriptFilterConfig,
  TopdeskCreateTicket: topdeskCreateTicketFilterConfig,
  topdeskcreateticket: topdeskCreateTicketFilterConfig,
  TopdeskInsertAttachment: topdeskInsertAttachmentFilterConfig,
  topdeskinsertattachment: topdeskInsertAttachmentFilterConfig,
  TopdeskRequesterValidation: topdeskRequesterValidationFilterConfig,
  topdeskrequestervalidation: topdeskRequesterValidationFilterConfig,
};
