import { callBG, MessageType } from '../../services/messaging.js';
import {
  getGroupsByBot,
  getSummaryItemsByGroup,
  countSummaryItemsByGroup,
  getMeta,
  searchFullItems,
} from '../../data/db.js';
import { getTypeIconUrl } from '../icons.js';
import { buildBlockLink } from '../links.js';
import { consumeConsultaIntent } from '../consultaIntent.js';
import { getModeConfig, DEFAULT_MODE_ID } from '../../config/modeRegistry.js';
import { getItemFieldValue } from '../../filters/itemHelpers.js';
import { shouldShowMenuWarning } from '../../shared/menuWarning.js';
import {
  exportAdvancedSearchWorkbook,
  getAdvancedExportSummary,
} from '../services/advancedSearchExport.js';

const TEMPLATE_ID = 'tpl-screen-consulta';
const CONTEXT_LOSS_GRACE_MS = 8_000;
const MENU_WARNING_ICON_PATH = 'assets/svgs/bot/MenuWarning.svg';
const ADVANCED_RESULT_LIMIT = 1_000;

const getMenuWarningIconUrl = () => {
  try {
    return chrome.runtime.getURL(MENU_WARNING_ICON_PATH);
  } catch {
    return null;
  }
};

const createInitialState = () => ({
  botId: null,
  mode: null,
  appBaseUrl: null,
  hasAuth: false,
  contextMissingSince: null,
  syncStatus: null,
  groups: [],
  filteredCounts: null,
  typeLabelByValue: {},
  typeIconByValue: {},
  query: '',
  type: '',
  expandedGroupId: null,
  filterSeq: 0,
  groupsError: null,
  meta: null,
  quick: {
    openAll: false,
    expandedGroups: {},
  },
  advanced: {
    type: '',
    query: '',
    deep: false,
    results: [],
    resultSnapshot: null,
    searchSeq: 0,
    searching: false,
    exporting: false,
    specific: {
      enabled: false,
      fields: {},
      type: '',
    },
    openAll: false,
    expandedGroups: {},
  },
  lastClicked: null,
  collapsedSections: {
    status: false,
    quick: false,
    advanced: false,
  },
});

let rootEl = null;
let state = createInitialState();
let els = {};
let disposed = false;
let cleanupFns = [];
let modeConfig = getModeConfig(DEFAULT_MODE_ID);

const setCurrentMode = (mode) => {
  modeConfig = getModeConfig(mode);
};

const normalizeModeValue = (mode) => {
  const raw = String(mode ?? '').trim().toLowerCase();
  if (raw === 'bot' || raw === 'ura') return raw;
  return null;
};

const on = (target, event, handler, options) => {
  if (!target) return;
  target.addEventListener(event, handler, options);
  cleanupFns.push(() => target.removeEventListener(event, handler, options));
};

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  const qa = (sel) => (rootEl ? Array.from(rootEl.querySelectorAll(sel)) : []);
  return {
    statusBot: q('#status-bot'),
    statusAuth: q('#status-auth'),
    statusSync: q('#status-sync'),
    quickSection: q('#quick-section'),
    advancedSection: q('#advanced-section'),
    statSummaryCount: q('#stat-summary-count'),
    statFullCount: q('#stat-full-count'),
    statGroupsCount: q('#stat-groups-count'),
    statCacheSize: q('#stat-cache-size'),
    syncSummary: q('#sync-summary'),
    syncFull: q('#sync-full'),
    syncFullCta: q('#sync-full-cta'),
    searchApply: q('#search-apply'),
    typeFilterSelect: q('#type-filter-select'),
    typeFilterButton: q('#type-filter-button'),
    typeFilterMenu: q('#type-filter-menu'),
    typeFilter: q('#type-filter'),
    searchInput: q('#search-input'),
    advancedTypeSelect: q('#advanced-type-select'),
    advancedTypeButton: q('#advanced-type-button'),
    advancedTypeMenu: q('#advanced-type-menu'),
    advancedType: q('#advanced-type'),
    advancedText: q('#advanced-text'),
    advancedDeep: q('#advanced-deep'),
    advancedSearch: q('#advanced-search'),
    advancedClear: q('#advanced-clear'),
    advancedExport: q('#advanced-export'),
    advancedResults: q('#advanced-results'),
    advancedTotal: q('#advanced-total'),
    filterSpecificContainer: q('#filter-specific-container'),
    filterSpecificToggle: q('#filter-specific-toggle'),
    filterSpecificContent: q('#filter-specific-content'),
    groupToggles: qa('.group-toggle'),
    groups: q('#groups'),
    groupsEmpty: q('#groups-empty'),
    statusLight: q('#status-light'),
    quickLight: q('#quick-light'),
    advancedLight: q('#advanced-light'),
  };
};

const specificFilterHelpers = {
  getItemFieldValue,
};

const resolveSpecificConfig = (typeValue) => {
  if (!typeValue) return null;
  const label = state.typeLabelByValue?.[typeValue] ?? typeValue;
  return (
    modeConfig.specificFilterConfigsByType[label] ??
    modeConfig.specificFilterConfigsByType[typeValue] ??
    null
  );
};

const debounce = (fn, wait = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

const setText = (el, value) => {
  if (el) el.textContent = value ?? '';
};

const cloneSerializable = (value) => {
  if (value === null || value === undefined) return value ?? null;
  try {
    if (typeof structuredClone === 'function') return structuredClone(value);
  } catch {
    // usar fallback JSON
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
};

const readAdvancedCriteria = () => ({
  type: String(els.advancedType?.value ?? state.advanced.type ?? ''),
  query: String(els.advancedText?.value ?? state.advanced.query ?? '').trim(),
  deep: Boolean(els.advancedDeep?.checked),
  specific: {
    enabled: Boolean(state.advanced.specific?.enabled),
    type: String(state.advanced.specific?.type ?? ''),
    fields: cloneSerializable(state.advanced.specific?.fields ?? {}),
  },
});

const getExportableAdvancedSnapshot = () => {
  const snapshot = state.advanced.resultSnapshot;
  if (!snapshot || snapshot.stale) return null;
  if (String(snapshot.botId ?? '') !== String(state.botId ?? '')) return null;
  if (normalizeModeValue(snapshot.mode) !== 'bot' || normalizeModeValue(state.mode) !== 'bot') {
    return null;
  }
  if (state.syncStatus?.running) return null;
  if (String(state.meta?.botId ?? '') !== String(snapshot.botId ?? '')) return null;
  if (String(state.meta?.lastItemsSyncAt ?? '') !== String(snapshot.lastItemsSyncAt ?? '')) {
    return null;
  }
  return snapshot;
};

const formatExportSummary = ({
  apiCount = 0,
  topdeskCount = 0,
  configuredBlockCount = 0,
} = {}) => {
  const parts = [];
  if (apiCount > 0) parts.push(`${apiCount} API${apiCount === 1 ? '' : 's'} v2`);
  if (topdeskCount > 0) {
    parts.push(`${topdeskCount} bloco${topdeskCount === 1 ? '' : 's'} Topdesk`);
  }
  if (configuredBlockCount > 0) {
    parts.push(
      `${configuredBlockCount} bloco${configuredBlockCount === 1 ? '' : 's'} com filtro específico`,
    );
  }
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} e ${parts[parts.length - 1]}`;
};

const updateAdvancedExportButton = () => {
  if (!els.advancedExport) return;
  const snapshot = getExportableAdvancedSnapshot();
  const exportSummary = getAdvancedExportSummary(snapshot?.results ?? []);
  const isBotSnapshot = normalizeModeValue(snapshot?.mode ?? state.mode) === 'bot';
  const isUraMode = normalizeModeValue(state.mode) === 'ura';
  const ready =
    Boolean(snapshot) &&
    isBotSnapshot &&
    exportSummary.totalCount > 0 &&
    !state.advanced.searching &&
    !state.advanced.exporting;

  els.advancedExport.disabled = !ready;
  els.advancedExport.textContent = state.advanced.exporting
    ? 'Exportando...'
    : exportSummary.totalCount > 0
      ? `Exportar (${exportSummary.totalCount})`
      : 'Exportar';

  if (isUraMode) {
    els.advancedExport.title = 'A exportação está disponível apenas no modo BOT.';
  } else if (state.syncStatus?.running) {
    els.advancedExport.title = 'Aguarde a sincronização terminar e execute uma nova busca se necessário.';
  } else if (!snapshot) {
    els.advancedExport.title = 'Execute uma busca para exportar os blocos suportados encontrados.';
  } else if (!exportSummary.totalCount) {
    els.advancedExport.title = 'A busca atual não possui blocos suportados para exportação.';
  } else {
    els.advancedExport.title = `Exportar ${formatExportSummary(exportSummary)} da última busca.`;
  }
};

const invalidateAdvancedResult = ({ updateMessage = true } = {}) => {
  const wasSearching = state.advanced.searching;
  const hadVisibleResult = Array.isArray(state.advanced.results) && state.advanced.results.length > 0;
  state.advanced.searchSeq += 1;
  state.advanced.searching = false;
  if (state.advanced.resultSnapshot) {
    state.advanced.resultSnapshot = { ...state.advanced.resultSnapshot, stale: true };
  }
  if (updateMessage && (state.advanced.resultSnapshot || wasSearching || hadVisibleResult)) {
    setText(els.advancedTotal, 'Filtros alterados — clique em Buscar novamente');
  }
  updateSearchButtons({
    summaryReady: Boolean(state.meta?.lastSummarySyncAt),
    fullReady: Boolean(state.meta?.lastItemsSyncAt),
  });
};

const resetAdvancedResults = ({ message = '0 blocos encontrados', render = true } = {}) => {
  state.advanced.searchSeq += 1;
  state.advanced.searching = false;
  state.advanced.results = [];
  state.advanced.resultSnapshot = null;
  setText(els.advancedTotal, message);
  if (render) renderAdvancedResults([]);
  updateSearchButtons({
    summaryReady: Boolean(state.meta?.lastSummarySyncAt),
    fullReady: Boolean(state.meta?.lastItemsSyncAt),
  });
};

const updateAdvancedPlaceholder = () => {
  if (!els.advancedText) return;
  const deep = Boolean(state.advanced.deep);
  els.advancedText.placeholder = deep ? 'Buscar no payload' : 'Buscar no título';
};

const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let current = bytes;
  while (current >= 1024 && idx < units.length - 1) {
    current /= 1024;
    idx += 1;
  }
  return `${current.toFixed(current >= 100 || idx === 0 ? 0 : 1)} ${units[idx]}`;
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const formatSyncStatus = (status) => {
  if (!status) return '-';
  if (status.phase === 'error') return `Erro: ${status.lastError ?? 'desconhecido'}`;
  if (!status.running) return 'OK';
  if (status.phase === 'summary') return `Summary ${status.summaryCount ?? 0}`;
  if (status.phase === 'full') {
    return `Full ${status.completedGroups}/${status.totalGroups}`;
  }
  return status.phase;
};

const updateBotLabel = () => {
  if (!els.statusBot) return;
  if (!state.botId) {
    setText(els.statusBot, '-');
    return;
  }
  const title = state.meta?.botTitle;
  if (title) {
    setText(els.statusBot, `${title} (${state.botId})`);
    return;
  }
  const modeLabel = state.mode ?? '-';
  setText(els.statusBot, `${state.botId} (${modeLabel})`);
};

const updateMetaStats = () => {
  const meta = state.meta;
  if (!meta) {
    setText(els.statSummaryCount, '-');
    setText(els.statFullCount, '-');
    setText(els.statGroupsCount, '-');
    setText(els.statCacheSize, '-');
    return;
  }
  const summaryCount = Number(meta.summaryCount ?? 0);
  const fullCount = Number(meta.fullCount ?? 0);
  const groupsCount = Number(meta.groupsCount ?? 0);
  const summaryBytes = Number(meta.summaryBytes ?? 0);
  const fullBytes = Number(meta.fullBytes ?? 0);
  const cacheSize = summaryBytes + fullBytes;

  setText(els.statSummaryCount, String(summaryCount || 0));
  setText(els.statFullCount, String(fullCount || 0));
  setText(els.statGroupsCount, String(groupsCount || 0));
  setText(els.statCacheSize, formatBytes(cacheSize));
};

const getIconsBasePath = () => modeConfig.iconsBasePath || 'assets/svgs/bot';

const getTypeLabel = (type) =>
  typeof modeConfig.getTypeLabel === 'function' ? modeConfig.getTypeLabel(type) : type;

const resolveTypeIconSource = (value) => {
  if (!value) return null;
  return state.typeIconByValue?.[value] ?? value;
};

const applySyncStatus = (status) => {
  state.syncStatus = status;
  setText(els.statusSync, formatSyncStatus(status));
  updateSyncButtons();
  if (status?.running) {
    updateSearchButtons({
      summaryReady: Boolean(state.meta?.lastSummarySyncAt),
      fullReady: Boolean(state.meta?.lastItemsSyncAt),
    });
  }
  let botChanged = false;
  const previousMode = state.mode;
  if (status?.appBaseUrl) state.appBaseUrl = status.appBaseUrl;
  if (status?.botId && String(status.botId) !== String(state.botId ?? '')) {
    resetAdvancedResults();
    state.botId = status.botId;
    if (status.mode) state.mode = status.mode;
    setCurrentMode(state.mode);
    botChanged = true;
  }
  if (status?.mode && status.mode !== state.mode) {
    state.mode = status.mode;
    setCurrentMode(state.mode);
  }
  if (!botChanged && previousMode && state.mode && previousMode !== state.mode) {
    resetAdvancedResults();
  }
  updateBotLabel();
  loadMeta();
  if (botChanged) {
    refreshGroups();
  }
};

const loadContext = async () => {
  if (disposed) return;
  const response = await callBG(MessageType.GET_CONTEXT);
  if (disposed) return;
  if (response.ok && response.data?.context) {
    const nextBotId = response.data.context.botId ?? null;
    const nextMode = response.data.context.mode ?? null;
    const nextAppBaseUrl = response.data.context.appBaseUrl ?? null;
    const botChanged = String(nextBotId ?? '') !== String(state.botId ?? '');
    const modeChanged =
      Boolean(nextMode && state.mode) && normalizeModeValue(nextMode) !== normalizeModeValue(state.mode);
    const isMissingBotId = !nextBotId;

    if (isMissingBotId && state.botId) {
      if (!state.contextMissingSince) state.contextMissingSince = Date.now();
      const elapsed = Date.now() - state.contextMissingSince;
      if (elapsed < CONTEXT_LOSS_GRACE_MS) {
        state.hasAuth = Boolean(response.data.hasAuth);
        if (nextAppBaseUrl) state.appBaseUrl = nextAppBaseUrl;
        setText(els.statusAuth, state.hasAuth ? 'ok' : 'ausente');
        updateSyncButtons();
        return;
      }
    } else {
      state.contextMissingSince = null;
    }

    if (botChanged || modeChanged) resetAdvancedResults();
    state.botId = nextBotId;
    state.mode = nextMode;
    state.appBaseUrl = nextAppBaseUrl;
    setCurrentMode(state.mode);
    state.hasAuth = Boolean(response.data.hasAuth);
    updateBotLabel();
    setText(els.statusAuth, state.hasAuth ? 'ok' : 'ausente');
    updateSyncButtons();
    loadMeta();
  }
};

const loadStatus = async () => {
  if (disposed) return;
  const response = await callBG(MessageType.GET_STATUS);
  if (disposed) return;
  if (response.ok) applySyncStatus(response.data?.status);
};

const refreshGroups = async () => {
  if (disposed) return;
  if (!state.botId) {
    state.groups = [];
    state.filteredCounts = null;
    state.groupsError = null;
    state.meta = null;
    updateMetaStats();
    updateSemaforo();
    renderGroups();
    return;
  }
  try {
    const groups = await getGroupsByBot(state.botId);
    if (disposed) return;
    state.groups = (groups || []).sort((a, b) => {
      const levelDiff = (a.level ?? 0) - (b.level ?? 0);
      if (levelDiff !== 0) return levelDiff;
      return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'pt-BR');
    });
    state.groupsError = null;
    await loadMeta();
    updateTypeOptions();
    await refreshFilteredCounts();
    renderGroups();
  } catch (error) {
    state.groups = [];
    state.filteredCounts = null;
    state.groupsError = `Erro ao carregar dados: ${error?.message ?? error}`;
    renderGroups();
  }
};

const ensureTypeSelectBindings = (selectRoot, button, menu) => {
  if (!selectRoot || !button || !menu) return;
  if (selectRoot.dataset.bound === 'true') return;
  selectRoot.dataset.bound = 'true';

  on(button, 'click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  on(document, 'click', (event) => {
    if (!selectRoot.contains(event.target)) {
      menu.hidden = true;
    }
  });
};

const syncTypeSelectButton = ({ button, value, labels }) => {
  if (!button) return;
  const label = value ? labels[value] ?? value : 'Todos os tipos';
  const iconSource = value ? resolveTypeIconSource(value) : null;
  const iconUrl = iconSource ? getTypeIconUrl(iconSource, getIconsBasePath()) : null;
  button.innerHTML = '';
  if (iconUrl) {
    const icon = document.createElement('img');
    icon.className = 'type-select__icon';
    icon.alt = label;
    icon.src = iconUrl;
    button.appendChild(icon);
  }
  const labelEl = document.createElement('span');
  labelEl.className = 'type-select__label';
  labelEl.textContent = label;
  button.appendChild(labelEl);
};

const buildTypeOption = ({ value, label, iconType, count, onSelect }) => {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'type-select__option';
  option.dataset.value = value;

  const iconSource = value ? iconType || value : null;
  const iconUrl = iconSource ? getTypeIconUrl(iconSource, getIconsBasePath()) : null;
  if (iconUrl) {
    const icon = document.createElement('img');
    icon.className = 'type-select__icon';
    icon.alt = label;
    icon.src = iconUrl;
    option.appendChild(icon);
  }

  const text = document.createElement('span');
  text.className = 'type-select__label';
  text.textContent = label;
  option.appendChild(text);

  if (typeof count === 'number') {
    const countEl = document.createElement('span');
    countEl.className = 'type-select__count';
    countEl.textContent = String(count);
    option.appendChild(countEl);
  }

  option.addEventListener('click', () => {
    onSelect(value);
  });

  return option;
};

const appendPreservedTypeOption = ({
  select,
  menu,
  value,
  label,
  iconType,
  onSelect,
}) => {
  if (!select || !value) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = `${label} (preservado)`;
  option.dataset.preserved = 'true';
  select.appendChild(option);

  if (menu) {
    menu.appendChild(
      buildTypeOption({
        value,
        label: `${label} (preservado)`,
        iconType,
        onSelect,
      }),
    );
  }
};

const updateTypeOptions = () => {
  ensureTypeSelectBindings(els.typeFilterSelect, els.typeFilterButton, els.typeFilterMenu);
  ensureTypeSelectBindings(els.advancedTypeSelect, els.advancedTypeButton, els.advancedTypeMenu);
  const prevTypeLabelByValue = { ...(state.typeLabelByValue || {}) };
  const prevTypeIconByValue = { ...(state.typeIconByValue || {}) };
  const typeCounts = {};
  const typeLabelByValue = {};
  const typeIconByValue = {};

  for (const group of state.groups) {
    const counts = group.typeCounts || {};
    Object.entries(counts).forEach(([key, value]) => {
      if (!key) return;
      const count = typeof value === 'number' ? value : value?.count ?? 0;
      const sourceType = typeof value === 'number' ? key : value?.label ?? key;
      const mappedLabel = getTypeLabel(key);
      const resolvedLabel = mappedLabel && mappedLabel !== key ? mappedLabel : sourceType;
      if (!typeCounts[key]) typeCounts[key] = 0;
      typeCounts[key] += count;
      if (!typeLabelByValue[key]) typeLabelByValue[key] = resolvedLabel;
      if (!typeIconByValue[key]) typeIconByValue[key] = sourceType;
    });
  }

  state.typeLabelByValue = { ...prevTypeLabelByValue, ...typeLabelByValue };
  state.typeIconByValue = { ...prevTypeIconByValue, ...typeIconByValue };
  const entries = Object.entries(typeCounts).map(([key, count]) => ({
    value: key,
    label: state.typeLabelByValue[key] ?? key,
    iconType: state.typeIconByValue[key] ?? key,
    count,
  }));

  entries.sort((a, b) => String(a.label).localeCompare(String(b.label), 'pt-BR'));

  const totalCount = entries.reduce((sum, entry) => sum + entry.count, 0);

  els.typeFilter.innerHTML = '<option value="">Todos os tipos</option>';
  els.typeFilterMenu.innerHTML = '';
  els.typeFilterMenu.appendChild(
    buildTypeOption({
      value: '',
      label: 'Todos os tipos',
      count: totalCount,
      onSelect: (value) => {
        state.type = value;
        els.typeFilter.value = value;
        syncTypeSelectButton({ button: els.typeFilterButton, value, labels: state.typeLabelByValue });
        els.typeFilterMenu.hidden = true;
        applyFilters();
      },
    }),
  );

  entries.forEach(({ value, label, count }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    els.typeFilter.appendChild(option);
    els.typeFilterMenu.appendChild(
      buildTypeOption({
        value,
        label,
        iconType: state.typeIconByValue[value] ?? value,
        count,
        onSelect: (selected) => {
          state.type = selected;
          els.typeFilter.value = selected;
          syncTypeSelectButton({ button: els.typeFilterButton, value: selected, labels: state.typeLabelByValue });
          els.typeFilterMenu.hidden = true;
          applyFilters();
        },
      }),
    );
  });

  if (state.type && !entries.find((entry) => entry.value === state.type)) {
    appendPreservedTypeOption({
      select: els.typeFilter,
      menu: els.typeFilterMenu,
      value: state.type,
      label: state.typeLabelByValue[state.type] ?? state.type,
      iconType: state.typeIconByValue[state.type] ?? state.type,
      onSelect: (selected) => {
        state.type = selected;
        els.typeFilter.value = selected;
        syncTypeSelectButton({ button: els.typeFilterButton, value: selected, labels: state.typeLabelByValue });
        els.typeFilterMenu.hidden = true;
        applyFilters();
      },
    });
  }
  els.typeFilter.value = state.type;
  syncTypeSelectButton({ button: els.typeFilterButton, value: state.type, labels: state.typeLabelByValue });

  if (els.advancedType) {
    els.advancedType.innerHTML = '<option value="">Todos os tipos</option>';
    els.advancedTypeMenu.innerHTML = '';
    els.advancedTypeMenu.appendChild(
      buildTypeOption({
        value: '',
        label: 'Todos os tipos',
        count: totalCount,
        onSelect: (value) => {
          invalidateAdvancedResult();
          state.advanced.type = value;
          els.advancedType.value = value;
          syncTypeSelectButton({ button: els.advancedTypeButton, value, labels: state.typeLabelByValue });
          els.advancedTypeMenu.hidden = true;
          updateSpecificFilterUI();
          persistPanelState();
        },
      }),
    );
    entries.forEach(({ value, label, iconType, count }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.advancedType.appendChild(option);
      els.advancedTypeMenu.appendChild(
        buildTypeOption({
          value,
          label,
          iconType,
          count,
          onSelect: (selected) => {
            invalidateAdvancedResult();
            state.advanced.type = selected;
            els.advancedType.value = selected;
            syncTypeSelectButton({ button: els.advancedTypeButton, value: selected, labels: state.typeLabelByValue });
            els.advancedTypeMenu.hidden = true;
            updateSpecificFilterUI();
            persistPanelState();
          },
        }),
      );
    });

    if (state.advanced.type && !entries.find((entry) => entry.value === state.advanced.type)) {
      appendPreservedTypeOption({
        select: els.advancedType,
        menu: els.advancedTypeMenu,
        value: state.advanced.type,
        label: state.typeLabelByValue[state.advanced.type] ?? state.advanced.type,
        iconType: state.typeIconByValue[state.advanced.type] ?? state.advanced.type,
        onSelect: (selected) => {
          invalidateAdvancedResult();
          state.advanced.type = selected;
          els.advancedType.value = selected;
          syncTypeSelectButton({ button: els.advancedTypeButton, value: selected, labels: state.typeLabelByValue });
          els.advancedTypeMenu.hidden = true;
          updateSpecificFilterUI();
          persistPanelState();
        },
      });
    }
    els.advancedType.value = state.advanced.type;
    syncTypeSelectButton({
      button: els.advancedTypeButton,
      value: state.advanced.type,
      labels: state.typeLabelByValue,
    });
    updateSpecificFilterUI();
  }
};

const renderGroups = () => {
  els.groups.innerHTML = '';
  if (!state.groups.length) {
    els.groupsEmpty.textContent = state.groupsError || 'Nenhum grupo encontrado.';
    els.groupsEmpty.style.display = 'block';
    return;
  }
  els.groupsEmpty.style.display = 'none';

  let rendered = 0;
  for (const group of state.groups) {
    const filteredCount = state.filteredCounts ? state.filteredCounts[group.groupId] ?? 0 : null;
    const displayCount = filteredCount === null ? group.itemsCount ?? 0 : filteredCount;
    if (filteredCount !== null && displayCount === 0) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'group';

    const header = document.createElement('div');
    header.className = 'group-header';
    header.innerHTML = `<span>${group.title || 'Grupo sem nome'}</span><span>${displayCount}</span>`;
    header.addEventListener('click', () => toggleGroup(group.groupId, wrapper));

    wrapper.appendChild(header);
    els.groups.appendChild(wrapper);
    rendered += 1;

    const isOpen = state.quick.openAll || state.quick.expandedGroups[group.groupId];
    if (isOpen) {
      loadGroupItems(group.groupId, wrapper);
    }
  }

  if (rendered === 0) {
    els.groupsEmpty.style.display = 'block';
  }
};

const toggleGroup = (groupId, wrapper) => {
  if (!groupId || state.quick.openAll) return;
  const isOpen = Boolean(state.quick.expandedGroups[groupId]);
  if (isOpen) {
    delete state.quick.expandedGroups[groupId];
    const items = wrapper.querySelector('.group-items');
    if (items) items.remove();
  } else {
    state.quick.expandedGroups[groupId] = true;
    loadGroupItems(groupId, wrapper);
  }
  persistPanelState();
};

const loadGroupItems = async (groupId, wrapper) => {
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'group-items';
  itemsContainer.textContent = 'Carregando...';
  wrapper.appendChild(itemsContainer);

  const items = await getSummaryItemsByGroup(state.botId, groupId, {
    type: state.type,
    query: state.query,
    limit: 500,
  });

  itemsContainer.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhum item encontrado.';
    itemsContainer.appendChild(empty);
    return;
  }

  for (const item of items) {
    itemsContainer.appendChild(buildItemRow(item, groupId, 'quick'));
  }
  scrollToLastClicked(itemsContainer, 'quick');
};

const startSync = async (fullItems) => {
  if (disposed) return;
  if (fullItems) {
    resetAdvancedResults({ message: 'Sincronizando detalhes completos...' });
  }
  const response = await callBG(MessageType.START_SYNC, { botId: state.botId, fullItems });
  if (disposed) return;
  if (!response.ok) {
    setText(els.statusSync, response.error?.message ?? 'Falha ao iniciar sync');
    return;
  }
  if (response.data?.status) {
    applySyncStatus(response.data.status);
    return;
  }
  await loadStatus();
};

const handleSearchChange = debounce(() => {
  applyFilters();
}, 200);

const handleTypeChange = () => {
  state.type = els.typeFilter.value;
  syncTypeSelectButton({ button: els.typeFilterButton, value: state.type, labels: state.typeLabelByValue });
  applyFilters();
};

const handleAdvancedInput = debounce(() => {
  if (!els.advancedText) return;
  state.advanced.query = els.advancedText.value.trim();
  persistPanelState();
}, 300);

const handleAdvancedDeepChange = () => {
  if (!els.advancedDeep) return;
  invalidateAdvancedResult();
  state.advanced.deep = Boolean(els.advancedDeep.checked);
  updateAdvancedPlaceholder();
  persistPanelState();
};

const refreshFilteredCounts = async () => {
  if (!state.botId) {
    state.filteredCounts = null;
    return;
  }
  const hasFilter = Boolean(state.query) || Boolean(state.type);
  if (!hasFilter) {
    state.filteredCounts = null;
    return;
  }
  const seq = ++state.filterSeq;
  const counts = {};
  await Promise.all(
    state.groups.map(async (group) => {
      const count = await countSummaryItemsByGroup(state.botId, group.groupId, {
        type: state.type,
        query: state.query,
      });
      counts[group.groupId] = count;
    }),
  );
  if (seq !== state.filterSeq) return;
  state.filteredCounts = counts;
};

const applyFilters = async () => {
  state.query = els.searchInput.value.trim();
  state.type = els.typeFilter.value;
  await refreshFilteredCounts();
  renderGroups();
  persistPanelState();
};

const PANEL_STATE_KEY = 'bot_sp_panel_state_v1';

const persistPanelState = debounce(() => {
  const payload = {
    query: state.query,
    type: state.type,
    expandedGroupId: state.expandedGroupId,
    collapsedSections: state.collapsedSections,
    quick: {
      openAll: state.quick.openAll,
      expandedGroups: Object.keys(state.quick.expandedGroups || {}),
    },
    advanced: {
      type: state.advanced.type,
      query: state.advanced.query,
      deep: state.advanced.deep,
      specific: state.advanced.specific,
      openAll: state.advanced.openAll,
      expandedGroups: Object.keys(state.advanced.expandedGroups || {}),
    },
    lastClicked: state.lastClicked,
  };
  try {
    chrome.storage.local.set({ [PANEL_STATE_KEY]: payload });
  } catch {
    // ignorar
  }
}, 200);

const loadPanelState = async () => {
  try {
    const result = await chrome.storage.local.get([PANEL_STATE_KEY]);
    const saved = result?.[PANEL_STATE_KEY];
    if (saved) {
      state.query = saved.query ?? state.query;
      state.type = saved.type ?? state.type;
      state.expandedGroupId = saved.expandedGroupId ?? state.expandedGroupId;
      state.collapsedSections = { ...state.collapsedSections, ...(saved.collapsedSections || {}) };
      if (saved.quick) {
        state.quick.openAll = Boolean(saved.quick.openAll);
        if (Array.isArray(saved.quick.expandedGroups)) {
          state.quick.expandedGroups = saved.quick.expandedGroups.reduce((acc, id) => {
            if (id) acc[id] = true;
            return acc;
          }, {});
        }
      }
      if (saved.advanced) {
        state.advanced.type = saved.advanced.type ?? state.advanced.type;
        state.advanced.query = saved.advanced.query ?? state.advanced.query;
        state.advanced.deep = Boolean(saved.advanced.deep);
        if (saved.advanced.specific) {
          state.advanced.specific = {
            ...state.advanced.specific,
            ...(saved.advanced.specific || {}),
          };
        }
        state.advanced.openAll = Boolean(saved.advanced.openAll);
        if (Array.isArray(saved.advanced.expandedGroups)) {
          state.advanced.expandedGroups = saved.advanced.expandedGroups.reduce((acc, id) => {
            if (id) acc[id] = true;
            return acc;
          }, {});
        }
      }
      if (saved.lastClicked) {
        state.lastClicked = saved.lastClicked;
        if (!state.expandedGroupId && saved.lastClicked.section === 'quick') {
          state.expandedGroupId = saved.lastClicked.groupId ?? state.expandedGroupId;
        }
        if (saved.lastClicked.section === 'quick' && saved.lastClicked.groupId && !state.quick.openAll) {
          state.quick.expandedGroups[saved.lastClicked.groupId] = true;
        }
        if (saved.lastClicked.section === 'advanced' && saved.lastClicked.groupId && !state.advanced.openAll) {
          state.advanced.expandedGroups[saved.lastClicked.groupId] = true;
        }
      }
      els.searchInput.value = state.query;
      els.typeFilter.value = state.type;
      if (els.advancedText) els.advancedText.value = state.advanced.query;
      if (els.advancedType) els.advancedType.value = state.advanced.type;
      if (els.advancedDeep) els.advancedDeep.checked = Boolean(state.advanced.deep);
    }
  } catch {
    // ignorar
  }
};

const ensureSpecificToggleBinding = () => {
  if (!els.filterSpecificToggle || !els.filterSpecificContent) return;
  if (els.filterSpecificToggle.dataset.bound === 'true') return;
  els.filterSpecificToggle.dataset.bound = 'true';
  els.filterSpecificToggle.addEventListener('change', () => {
    invalidateAdvancedResult();
    const enabled = Boolean(els.filterSpecificToggle.checked);
    state.advanced.specific.enabled = enabled;
    els.filterSpecificContent.style.display = enabled ? 'grid' : 'none';
    persistPanelState();
  });
};

const updateSpecificFilterUI = () => {
  if (!els.filterSpecificContainer || !els.filterSpecificContent || !els.filterSpecificToggle) return;
  ensureSpecificToggleBinding();
  const typeValue = state.advanced.type || '';
  const configEntry = resolveSpecificConfig(typeValue);

  if (!typeValue) {
    els.filterSpecificContainer.hidden = true;
    els.filterSpecificContent.innerHTML = '';
    els.filterSpecificToggle.checked = false;
    els.filterSpecificContent.style.display = 'none';
    return;
  }

  if (!configEntry) {
    // Evita perder filtros em oscilacoes temporarias de contexto/modo.
    els.filterSpecificContainer.hidden = true;
    els.filterSpecificContent.innerHTML = '';
    els.filterSpecificToggle.checked = Boolean(state.advanced.specific.enabled);
    els.filterSpecificContent.style.display = 'none';
    return;
  }

  if (state.advanced.specific.type && state.advanced.specific.type !== typeValue) {
    state.advanced.specific = { enabled: false, fields: {}, type: typeValue };
  } else if (!state.advanced.specific.type) {
    state.advanced.specific.type = typeValue;
  }

  els.filterSpecificContainer.hidden = false;
  els.filterSpecificContent.innerHTML = '';
  configEntry.render({
    container: els.filterSpecificContent,
    state: state.advanced.specific.fields,
    onChange: (key, value, autoEnable = true) => {
      invalidateAdvancedResult();
      state.advanced.specific.fields = { ...state.advanced.specific.fields, [key]: value };
      if (autoEnable) {
        state.advanced.specific.enabled = true;
        els.filterSpecificToggle.checked = true;
      }
      persistPanelState();
    },
  });

  els.filterSpecificToggle.checked = Boolean(state.advanced.specific.enabled);
  els.filterSpecificContent.style.display = state.advanced.specific.enabled ? 'grid' : 'none';
  persistPanelState();
};

const renderAdvancedResults = (items) => {
  if (!els.advancedResults) return;
  els.advancedResults.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhum resultado encontrado.';
    els.advancedResults.appendChild(empty);
    return;
  }

  const groupsById = new Map(state.groups.map((group) => [group.groupId, group.title]));
  const grouped = new Map();
  items.forEach((item) => {
    const groupId = item.groupId ?? 'root';
    if (!grouped.has(groupId)) grouped.set(groupId, []);
    grouped.get(groupId).push(item);
  });

  grouped.forEach((groupItems, groupId) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';
    const title = groupsById.get(groupId) || String(groupItems[0]?.groupTitle ?? '').trim() || groupId || 'Grupo';
    header.innerHTML = `<span>${title}</span><span>${groupItems.length}</span>`;

    const content = document.createElement('div');
    content.className = 'search-group-content';
    groupItems.forEach((item) => content.appendChild(buildItemRow(item, groupId, 'advanced')));

    const isOpen = state.advanced.openAll || state.advanced.expandedGroups[groupId];
    if (!isOpen) {
      content.setAttribute('hidden', 'true');
    }
    header.addEventListener('click', () => {
      if (state.advanced.openAll) return;
      const currentlyOpen = !content.hasAttribute('hidden');
      if (currentlyOpen) {
        content.setAttribute('hidden', 'true');
        delete state.advanced.expandedGroups[groupId];
      } else {
        content.removeAttribute('hidden');
        state.advanced.expandedGroups[groupId] = true;
      }
      persistPanelState();
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.advancedResults.appendChild(wrapper);
  });

  scrollToLastClicked(els.advancedResults, 'advanced');
};

const runAdvancedSearch = async () => {
  if (
    disposed ||
    state.syncStatus?.running ||
    state.advanced.searching ||
    state.advanced.exporting
  ) {
    return;
  }
  const searchState = state;
  if (!state.botId) {
    resetAdvancedResults();
    return;
  }

  const searchBotId = String(state.botId);
  const criteria = readAdvancedCriteria();
  const searchSeq = state.advanced.searchSeq + 1;
  state.advanced.searchSeq = searchSeq;
  state.advanced.searching = true;
  state.advanced.resultSnapshot = null;
  setText(els.advancedTotal, 'Buscando...');
  updateSearchButtons({
    summaryReady: Boolean(state.meta?.lastSummarySyncAt),
    fullReady: Boolean(state.meta?.lastItemsSyncAt),
  });
  updateAdvancedExportButton();

  try {
    const meta =
      state.meta && String(state.meta.botId ?? '') === searchBotId ? state.meta : await loadMeta();
    if (
      disposed ||
      state !== searchState ||
      searchSeq !== state.advanced.searchSeq ||
      searchBotId !== String(state.botId ?? '')
    ) {
      return;
    }
    if (!meta?.lastItemsSyncAt) {
      state.advanced.results = [];
      state.advanced.resultSnapshot = null;
      setText(els.advancedTotal, '0 blocos encontrados');
      if (els.advancedResults) {
        els.advancedResults.innerHTML = '';
        const warn = document.createElement('div');
        warn.className = 'muted';
        warn.textContent = 'Sincronize os detalhes completos antes de buscar.';
        els.advancedResults.appendChild(warn);
      }
      return;
    }

    state.advanced.query = criteria.query;
    state.advanced.type = criteria.type;
    state.advanced.deep = criteria.deep;
    persistPanelState();

    const specificConfig = resolveSpecificConfig(criteria.type);
    const specificEnabled = Boolean(criteria.specific.enabled && specificConfig?.match);
    const filterFn = specificEnabled
      ? (record) => {
          const payload = record?.payload ?? record;
          try {
            return Boolean(specificConfig.match(payload, criteria.specific.fields, specificFilterHelpers));
          } catch {
            return false;
          }
        }
      : null;

    const rawResults = await searchFullItems(searchBotId, {
      type: criteria.type,
      query: criteria.query,
      deep: criteria.deep,
      limit: ADVANCED_RESULT_LIMIT + 1,
      filterFn,
    });
    if (
      disposed ||
      state !== searchState ||
      searchSeq !== state.advanced.searchSeq ||
      searchBotId !== String(state.botId ?? '')
    ) {
      return;
    }

    const truncated = rawResults.length > ADVANCED_RESULT_LIMIT;
    const results = truncated ? rawResults.slice(0, ADVANCED_RESULT_LIMIT) : rawResults;
    state.advanced.results = results;
    state.advanced.resultSnapshot = {
      botId: searchBotId,
      botTitle: meta?.botTitle ?? null,
      mode: normalizeModeValue(meta?.mode) ?? normalizeModeValue(state.mode),
      appBaseUrl: state.appBaseUrl,
      lastItemsSyncAt: meta?.lastItemsSyncAt ?? null,
      executedAt: new Date().toISOString(),
      criteria: cloneSerializable(criteria),
      results,
      truncated,
      stale: false,
    };
    setText(
      els.advancedTotal,
      truncated
        ? `${results.length}+ blocos encontrados (limite exibido)`
        : `${results.length} blocos encontrados`,
    );
    renderAdvancedResults(results);
  } catch (error) {
    if (state !== searchState || searchSeq !== state.advanced.searchSeq) return;
    state.advanced.results = [];
    state.advanced.resultSnapshot = null;
    setText(els.advancedTotal, 'Erro ao buscar');
    if (els.advancedResults) {
      els.advancedResults.innerHTML = '';
      const warn = document.createElement('div');
      warn.className = 'muted';
      warn.textContent = `Erro ao buscar: ${error?.message ?? error}`;
      els.advancedResults.appendChild(warn);
    }
  } finally {
    if (state === searchState && searchSeq === state.advanced.searchSeq) {
      state.advanced.searching = false;
      updateSearchButtons({
        summaryReady: Boolean(state.meta?.lastSummarySyncAt),
        fullReady: Boolean(state.meta?.lastItemsSyncAt),
      });
      updateAdvancedExportButton();
    }
  }
};

const exportAdvancedResults = async () => {
  if (disposed || state.advanced.searching || state.advanced.exporting) return;
  const snapshot = getExportableAdvancedSnapshot();
  if (!snapshot || normalizeModeValue(snapshot.mode) !== 'bot') return;

  const exportSummary = getAdvancedExportSummary(snapshot.results);
  if (!exportSummary.totalCount) return;

  state.advanced.exporting = true;
  updateSearchButtons({
    summaryReady: Boolean(state.meta?.lastSummarySyncAt),
    fullReady: Boolean(state.meta?.lastItemsSyncAt),
  });

  try {
    const groupsById = new Map(
      state.groups.map((group) => [
        String(group?.groupId ?? ''),
        String(group?.title ?? '').trim() || String(group?.groupId ?? ''),
      ]),
    );
    const exportedAt = new Date().toISOString();
    const result = exportAdvancedSearchWorkbook({
      records: snapshot.results,
      botId: snapshot.botId,
      botTitle: snapshot.botTitle,
      mode: snapshot.mode,
      appBaseUrl: snapshot.appBaseUrl,
      exportedAt,
      searchedAt: snapshot.executedAt,
      lastItemsSyncAt: snapshot.lastItemsSyncAt,
      criteria: snapshot.criteria,
      truncated: snapshot.truncated,
      groupsById,
    });
    const count = Number(result?.count ?? exportSummary.totalCount) || exportSummary.totalCount;
    const exportedSummary = formatExportSummary({
      apiCount: Number(result?.apiCount ?? exportSummary.apiCount),
      topdeskCount: Number(result?.topdeskCount ?? exportSummary.topdeskCount),
      configuredBlockCount: Number(
        result?.configuredBlockCount ?? exportSummary.configuredBlockCount,
      ),
    });
    const blockLabel = `bloco${count === 1 ? '' : 's'}`;
    setText(
      els.advancedTotal,
      snapshot.truncated
        ? `Exportado: ${count} ${blockLabel} (${exportedSummary}) do resultado limitado.`
        : `Exportado: ${count} ${blockLabel} (${exportedSummary}).`,
    );
  } catch (error) {
    setText(els.advancedTotal, `Erro ao exportar: ${error?.message ?? error}`);
  } finally {
    state.advanced.exporting = false;
    updateSearchButtons({
      summaryReady: Boolean(state.meta?.lastSummarySyncAt),
      fullReady: Boolean(state.meta?.lastItemsSyncAt),
    });
  }
};

const applyConsultaIntent = async () => {
  const intent = await consumeConsultaIntent();
  const validKinds = new Set(['variable_payload_search', 'tag_payload_search', 'payload_search']);
  if (!intent || !validKinds.has(intent.kind)) return false;
  const query = String(intent.query ?? '').trim();
  if (!query) return false;

  const meta = (state.meta && state.meta.botId === state.botId) ? state.meta : await loadMeta();
  if (!meta?.lastItemsSyncAt) return false;

  resetAdvancedResults();
  state.advanced.query = query;
  state.advanced.type = String(intent.type ?? '');
  state.advanced.deep = intent.deep !== false;
  state.advanced.specific = { enabled: false, fields: {}, type: state.advanced.type };
  state.advanced.expandedGroups = {};

  if (els.advancedText) els.advancedText.value = state.advanced.query;
  if (els.advancedType) els.advancedType.value = state.advanced.type;
  if (els.advancedDeep) els.advancedDeep.checked = Boolean(state.advanced.deep);

  syncTypeSelectButton({
    button: els.advancedTypeButton,
    value: state.advanced.type,
    labels: state.typeLabelByValue,
  });
  updateAdvancedPlaceholder();
  updateSpecificFilterUI();
  persistPanelState();

  if (intent.autoRun !== false) {
    await runAdvancedSearch();
  }
  return true;
};

const clearAdvancedSearch = () => {
  resetAdvancedResults({ render: false });
  state.advanced.query = '';
  state.advanced.type = '';
  state.advanced.deep = false;
  state.advanced.specific = { enabled: false, fields: {}, type: '' };
  state.advanced.expandedGroups = {};
  if (els.advancedText) els.advancedText.value = '';
  if (els.advancedDeep) els.advancedDeep.checked = false;
  if (els.advancedType) els.advancedType.value = '';
  if (els.filterSpecificToggle) els.filterSpecificToggle.checked = false;
  if (els.filterSpecificContent) els.filterSpecificContent.innerHTML = '';
  if (els.filterSpecificContainer) els.filterSpecificContainer.hidden = true;
  updateAdvancedPlaceholder();
  syncTypeSelectButton({
    button: els.advancedTypeButton,
    value: state.advanced.type,
    labels: state.typeLabelByValue,
  });
  renderAdvancedResults([]);
  persistPanelState();
};

const setLight = (el, color) => {
  if (!el) return;
  el.classList.remove('semaforo--red', 'semaforo--yellow', 'semaforo--green');
  if (color) el.classList.add(`semaforo--${color}`);
};

const setHidden = (el, hidden) => {
  if (!el) return;
  if (hidden) el.setAttribute('hidden', 'true');
  else el.removeAttribute('hidden');
};

const updateSearchSectionsVisibility = ({ summaryReady, fullReady }) => {
  // Apenas uma secao de busca deve ficar visivel:
  // - nenhuma ate o sync de resumo
  // - rapida apos o sync de resumo
  // - avancada apos o sync completo
  if (fullReady) {
    setHidden(els.quickSection, true);
    setHidden(els.advancedSection, false);
    return;
  }
  if (summaryReady) {
    setHidden(els.quickSection, false);
    setHidden(els.advancedSection, true);
    return;
  }
  setHidden(els.quickSection, true);
  setHidden(els.advancedSection, true);
};

const updateSearchButtons = ({ summaryReady, fullReady }) => {
  if (els.searchApply) els.searchApply.disabled = !summaryReady;
  if (els.advancedSearch) {
    els.advancedSearch.disabled =
      !fullReady ||
      Boolean(state.syncStatus?.running) ||
      state.advanced.searching ||
      state.advanced.exporting;
    els.advancedSearch.textContent = state.advanced.searching ? 'Buscando...' : 'Buscar';
  }
  updateAdvancedExportButton();
};

const updateGroupToggleLabels = () => {
  if (!els.groupToggles) return;
  els.groupToggles.forEach((button) => {
    const scope = button.dataset.scope;
    if (scope === 'quick') {
      button.textContent = state.quick.openAll ? 'Fechar grupos' : 'Abrir grupos';
    } else if (scope === 'advanced') {
      button.textContent = state.advanced.openAll ? 'Fechar grupos' : 'Abrir grupos';
    }
  });
};

const updateSemaforo = () => {
  const summaryReady = Boolean(state.meta?.lastSummarySyncAt);
  const fullReady = Boolean(state.meta?.lastItemsSyncAt);

  let statusColor = 'red';
  if (!state.botId || !state.hasAuth) {
    statusColor = 'red';
  } else if (fullReady) {
    statusColor = 'green';
  } else if (summaryReady) {
    statusColor = 'yellow';
  } else {
    statusColor = 'red';
  }

  const quickColor = summaryReady ? 'green' : 'red';
  const advancedColor = fullReady ? 'green' : 'red';

  setLight(els.statusLight, statusColor);
  setLight(els.quickLight, quickColor);
  setLight(els.advancedLight, advancedColor);
  updateSearchSectionsVisibility({ summaryReady, fullReady });
  updateSearchButtons({ summaryReady, fullReady });
};

const loadMeta = async () => {
  if (disposed) return null;
  const requestedState = state;
  const requestedBotId = state.botId;
  const requestedBotKey = String(requestedBotId ?? '');
  if (!requestedBotKey) {
    state.meta = null;
    updateSemaforo();
    return null;
  }
  let nextMeta = null;
  try {
    nextMeta = await getMeta(requestedBotId);
  } catch {
    nextMeta = null;
  }
  if (
    disposed ||
    state !== requestedState ||
    String(state.botId ?? '') !== requestedBotKey
  ) {
    return null;
  }

  const previousMeta = state.meta;
  state.meta = nextMeta;
  const prevMode = state.mode;
  const syncedMode = normalizeModeValue(state.meta?.mode);
  if (syncedMode && syncedMode !== state.mode) {
    state.mode = syncedMode;
    setCurrentMode(state.mode);
  }
  const modeChanged = prevMode !== state.mode;
  const syncVersionChanged =
    Boolean(previousMeta && state.meta) &&
    String(previousMeta.botId ?? '') === requestedBotKey &&
    String(previousMeta.lastItemsSyncAt ?? '') !== String(state.meta.lastItemsSyncAt ?? '');
  const snapshot = state.advanced.resultSnapshot;
  const snapshotOutdated =
    Boolean(snapshot && !snapshot.stale && state.meta) &&
    (String(snapshot.botId ?? '') !== requestedBotKey ||
      String(snapshot.lastItemsSyncAt ?? '') !== String(state.meta?.lastItemsSyncAt ?? '') ||
      normalizeModeValue(snapshot.mode) !== normalizeModeValue(state.mode));
  if (snapshotOutdated || (state.advanced.searching && (syncVersionChanged || modeChanged))) {
    invalidateAdvancedResult({ updateMessage: false });
    setText(els.advancedTotal, 'Dados sincronizados — clique em Buscar novamente');
  }
  updateBotLabel();
  updateMetaStats();
  updateSemaforo();
  if (modeChanged && Array.isArray(state.groups) && state.groups.length > 0) {
    updateTypeOptions();
    renderGroups();
    renderAdvancedResults(state.advanced.results || []);
  }
  return state.meta;
};

const setLastClicked = ({ section, itemId, groupId }) => {
  if (!itemId) return;
  state.lastClicked = {
    section,
    itemId,
    groupId,
    updatedAt: Date.now(),
  };
  if (section === 'quick' && groupId) {
    state.expandedGroupId = groupId;
    if (!state.quick.openAll) {
      state.quick.expandedGroups[groupId] = true;
    }
  }
  if (section === 'advanced' && groupId) {
    if (!state.advanced.openAll) {
      state.advanced.expandedGroups[groupId] = true;
    }
  }
  persistPanelState();
};

const scrollToLastClicked = (root, section) => {
  if (!state.lastClicked || state.lastClicked.section !== section) return;
  const target = root.querySelector(`[data-key=\"${state.lastClicked.itemId}\"]`);
  if (!target) return;
  target.classList.add('active');
  target.scrollIntoView({ block: 'center' });
};

const buildItemRow = (item, fallbackGroupId = null, section = 'quick') => {
  const row = document.createElement('div');
  row.className = 'item-row';
  if (item?.itemId) {
    row.dataset.key = item.itemId;
  }
  row.dataset.section = section;

  const title = document.createElement('div');
  title.className = 'item-title';

  const iconUrl = getTypeIconUrl(item.type, getIconsBasePath());
  if (iconUrl) {
    const icon = document.createElement('img');
    icon.className = 'item-icon';
    icon.alt = item.type || '';
    icon.src = iconUrl;
    icon.addEventListener('error', () => {
      icon.remove();
    });
    title.appendChild(icon);
  }

  if (shouldShowMenuWarning(item, 20)) {
    const warningUrl = getMenuWarningIconUrl();
    if (warningUrl) {
      const warning = document.createElement('img');
      warning.className = 'item-warning-icon';
      warning.alt = 'Menu com opção acima de 20 caracteres';
      warning.src = warningUrl;
      warning.title = 'Menu com opção acima de 20 caracteres';
      warning.addEventListener('error', () => {
        warning.remove();
      });
      title.appendChild(warning);
    }
  }

  const titleText = document.createElement('span');
  titleText.textContent = item.title || 'Sem título';
  title.appendChild(titleText);

  const linkButton = document.createElement('button');
  linkButton.className = 'item-link';
  linkButton.type = 'button';
  linkButton.textContent = 'Abrir';
  linkButton.title = 'Abrir no Boteria';
  linkButton.addEventListener('click', () => {
    (rootEl ? rootEl.querySelectorAll('.item-row.active') : []).forEach((el) => el.classList.remove('active'));
    row.classList.add('active');
    setLastClicked({
      section,
      itemId: item.itemId,
      groupId: item.groupId ?? fallbackGroupId,
    });
    const url = buildBlockLink({
      botId: state.botId,
      mode: state.mode,
      itemId: item.itemId,
      groupId: item.groupId ?? fallbackGroupId,
      flowExchangeId: item.flowExchangeId,
      searchValue: item.displayId ?? item.title ?? item.itemId,
      appBaseUrl: state.appBaseUrl,
    });
    if (url) {
      callBG(MessageType.OPEN_URL_CURRENT_TAB, { url }).catch(() => undefined);
    }
  });

  row.appendChild(title);
  row.appendChild(linkButton);
  return row;
};

const updateSyncButtons = () => {
  const ready = Boolean(state.botId) && Boolean(state.hasAuth);
  const disabled = !ready;
  if (els.syncSummary) els.syncSummary.disabled = disabled;
  if (els.syncFull) els.syncFull.disabled = disabled;
  if (els.syncFullCta) els.syncFullCta.disabled = disabled;
  if (disabled) {
    setText(els.statusSync, 'Aguardando bot/token');
  } else if (
    els.statusSync.textContent === 'Aguardando bot/token' ||
    els.statusSync.textContent === '-' ||
    !els.statusSync.textContent
  ) {
    setText(els.statusSync, 'Pronto para sincronizar');
  }
};

const initSectionToggles = () => {
  const toggles = rootEl ? rootEl.querySelectorAll('.section-toggle') : [];
  toggles.forEach((button) => {
    const targetId = button.dataset.target;
    const target = targetId && rootEl ? rootEl.querySelector(`#${targetId}`) : null;
    if (!target) return;
    const sectionKey =
      targetId === 'status-content'
        ? 'status'
        : targetId === 'quick-content'
          ? 'quick'
          : targetId === 'advanced-content'
            ? 'advanced'
            : null;
    if (!sectionKey) return;
    if (state.collapsedSections[sectionKey]) {
      target.setAttribute('hidden', 'true');
      button.textContent = 'Exibir';
    }
    on(button, 'click', () => {
      const isHidden = target.hasAttribute('hidden');
      if (isHidden) {
        target.removeAttribute('hidden');
        button.textContent = 'Recolher';
        state.collapsedSections[sectionKey] = false;
      } else {
        target.setAttribute('hidden', 'true');
        button.textContent = 'Exibir';
        state.collapsedSections[sectionKey] = true;
      }
      persistPanelState();
    });
  });
};

const bindEvents = () => {
  if (els.searchInput) on(els.searchInput, 'input', handleSearchChange);
  if (els.typeFilter) on(els.typeFilter, 'change', handleTypeChange);
  if (els.searchApply)
    on(els.searchApply, 'click', () => {
      applyFilters();
    });

  if (els.advancedDeep) on(els.advancedDeep, 'change', handleAdvancedDeepChange);
  if (els.advancedSearch) on(els.advancedSearch, 'click', () => runAdvancedSearch());
  if (els.advancedClear) on(els.advancedClear, 'click', () => clearAdvancedSearch());
  if (els.advancedExport) on(els.advancedExport, 'click', () => exportAdvancedResults());

  if (els.advancedText) {
    on(els.advancedText, 'input', (...args) => {
      invalidateAdvancedResult();
      handleAdvancedInput(...args);
    });
    on(els.advancedText, 'keydown', (event) => {
      if (event.key === 'Enter') runAdvancedSearch();
    });
  }

  if (Array.isArray(els.groupToggles) && els.groupToggles.length) {
    els.groupToggles.forEach((button) => {
      on(button, 'click', () => {
        const scope = button.dataset.scope;
        if (scope === 'quick') {
          state.quick.openAll = !state.quick.openAll;
          state.quick.expandedGroups = {};
          renderGroups();
        }
        if (scope === 'advanced') {
          state.advanced.openAll = !state.advanced.openAll;
          state.advanced.expandedGroups = {};
          renderAdvancedResults(state.advanced.results || []);
        }
        updateGroupToggleLabels();
        persistPanelState();
      });
    });
  }

  if (els.syncSummary) on(els.syncSummary, 'click', () => startSync(false));
  if (els.syncFull) on(els.syncFull, 'click', () => startSync(true));
  if (els.syncFullCta) on(els.syncFullCta, 'click', () => startSync(true));

  const onMessage = (message) => {
    if (disposed) return;
    if (message?.type === MessageType.CONTEXT_CHANGED) {
      resetAdvancedResults({ message: 'Contexto alterado — carregando...' });
      loadContext();
      return;
    }
    if (message?.type === MessageType.SYNC_STATUS) {
      applySyncStatus(message.state);
      if (!message.state?.running && message.state?.phase === 'idle') {
        refreshGroups();
      }
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  cleanupFns.push(() => chrome.runtime.onMessage.removeListener(onMessage));
};

const init = async () => {
  bindEvents();
  await loadPanelState();
  initSectionToggles();
  updateAdvancedPlaceholder();
  updateSpecificFilterUI();
  updateGroupToggleLabels();
  await loadContext();
  await loadStatus();
  await refreshGroups();
  const appliedIntent = await applyConsultaIntent();
  if (!appliedIntent && (state.advanced.query || state.advanced.type)) {
    runAdvancedSearch();
  }
  const intervalId = setInterval(() => loadContext(), 2000);
  cleanupFns.push(() => clearInterval(intervalId));
  updateSemaforo();
};

export const screenConsulta = {
  id: 'consulta',
  title: 'Consulta & status',
  mount: async ({ root }) => {
    disposed = false;
    cleanupFns = [];
    state = createInitialState();
    rootEl = root;

    const template = document.getElementById(TEMPLATE_ID);
    if (!template) {
      throw new Error(`Template \"${TEMPLATE_ID}\" não encontrado em panel.html`);
    }

    root.innerHTML = '';
    root.appendChild(template.content.cloneNode(true));
    els = initEls();

    await init();

    return () => {
      disposed = true;
      const fns = cleanupFns.slice();
      cleanupFns = [];
      fns.reverse().forEach((fn) => {
        try {
          fn();
        } catch {
          // ignorar
        }
      });
      if (rootEl) rootEl.innerHTML = '';
      els = {};
      rootEl = null;
      state = createInitialState();
    };
  },
};
