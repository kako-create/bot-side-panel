const mapTypeToIconFile = (type) => {
  if (!type) return null;
  const raw = String(type).trim();
  if (!raw) return null;
  const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const normalizedLower = normalized.toLowerCase();

  const overrides = {
    'menu ia': 'MenuAI.svg',
    'menu_ia': 'MenuAI.svg',
    'menuia': 'MenuAI.svg',
    'whatsapp flow': 'WhatsappFlow.svg',
    'whatsappflow': 'WhatsappFlow.svg',
    'whats app flow': 'WhatsappFlow.svg',
    'api v2': 'APIV2.svg',
    'api-v2': 'APIV2.svg',
    'apiv2': 'APIV2.svg',
    'ivr api v2': 'IvrApiV2.svg',
    'ivrapiv2': 'IvrApiV2.svg',
    'ai execution': 'AIExecution.svg',
    'aiexecution': 'AIExecution.svg',
    'customer identifier': 'CustomerIdentifier.svg',
    'customeridentifier': 'CustomerIdentifier.svg',
  };

  if (overrides[normalizedLower]) return overrides[normalizedLower];

  const hasSeparators = /[\s_-]/.test(raw);
  if (!hasSeparators) return `${raw}.svg`;

  const titleCased = normalizedLower
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return titleCased ? `${titleCased}.svg` : null;
};

export const getTypeIconUrl = (type, iconsBasePath = 'assets/svgs/bot') => {
  const file = mapTypeToIconFile(type);
  if (!file) return null;
  return chrome.runtime.getURL(`${iconsBasePath}/${file}`);
};
