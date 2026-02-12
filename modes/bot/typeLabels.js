const normalizeTypeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const buildTypeLabelMap = (entries) => {
  const map = {};
  Object.entries(entries || {}).forEach(([key, label]) => {
    const normalized = normalizeTypeKey(key);
    if (normalized) map[normalized] = label;
  });
  return map;
};

export const TYPE_LABELS = buildTypeLabelMap({
  'AIExecution': 'AIExecution',
  'AI Execution': 'AI Execution',
  'AI': 'AI',
  'API': 'API',
  'Api': 'Api',
  'API v2': 'API v2',
  'Api v2': 'Api v2',
  'APIV2': 'APIV2',
  'ApiV2': 'ApiV2',
  'Audio': 'Audio',
  'BotTransfer': 'BotTransfer',
  'Card': 'Card',
  'Carousel': 'Carousel',
  'ChatGpt': 'ChatGpt',
  'Collect': 'Collect',
  'Conditional': 'Conditional',
  'Condicional': 'Condicional',
  'CustomMessage': 'CustomMessage',
  'CustomerIdentifier': 'CustomerIdentifier',
  'Customer Identifier': 'Customer Identifier',
  'Decision': 'Decision',
  'Default': 'Default',
  'Document': 'Document',
  'DynamicMedia': 'DynamicMedia',
  'EMAIL': 'EMAIL',
  'Form': 'Form',
  'Group': 'Group',
  'Human': 'Human',
  'IA': 'IA',
  'Ia': 'Ia',
  'Image': 'Image',
  'Internal': 'Internal',
  'Leia': 'Leia',
  'Menu': 'Menu',
  'Menu AI': 'Menu AI',
  'Menu IA': 'Menu IA',
  'MenuAI': 'MenuAI',
  'MenuIA': 'MenuIA',
  'Note': 'Note',
  'Nps': 'Nps',
  'Redirect': 'Redirect',
  'SMS': 'SMS',
  'Script': 'Script',
  'Text': 'Text',
  'Texto': 'Texto',
  'Timer': 'Timer',
  'Video': 'Video',
  'WebView': 'WebView',
  'WhatsappFlow': 'WhatsappFlow',
  'Whatsapp Flow': 'Whatsapp Flow',
  'WhatsApp Flow': 'WhatsApp Flow',
  'Whats App Flow': 'Whats App Flow',
});

export const getTypeLabel = (type) => {
  const key = normalizeTypeKey(type);
  return TYPE_LABELS[key] ?? (type || 'Unknown');
};
