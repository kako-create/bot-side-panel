import { callBG, MessageType } from '../services/messaging.js';
import {
  getGroupsByBot,
  getSummaryItemsByGroup,
  countSummaryItemsByGroup,
  getMeta,
  searchFullItems,
} from '../data/db.js';
import { getTypeIconUrl } from './icons.js';
import { buildBlockLink } from './links.js';
import { getModeConfig, DEFAULT_MODE_ID } from '../config/modeRegistry.js';
import { getItemFieldValue } from '../filters/itemHelpers.js';

const state = {
  botId: null,
  mode: null,
  appBaseUrl: null,
  hasAuth: false,
  syncStatus: null,
  groups: [],
  filteredCounts: null,
  typeLabelByValue: {},
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
    bots: false,
  },
};

const els = {
  statusBot: document.getElementById('status-bot'),
  statusAuth: document.getElementById('status-auth'),
  statusSync: document.getElementById('status-sync'),
  quickSection: document.getElementById('quick-section'),
  advancedSection: document.getElementById('advanced-section'),
  botsSection: document.getElementById('bots-section'),
  statSummaryCount: document.getElementById('stat-summary-count'),
  statFullCount: document.getElementById('stat-full-count'),
  statGroupsCount: document.getElementById('stat-groups-count'),
  statCacheSize: document.getElementById('stat-cache-size'),
  syncSummary: document.getElementById('sync-summary'),
  syncFull: document.getElementById('sync-full'),
  syncFullCta: document.getElementById('sync-full-cta'),
  searchApply: document.getElementById('search-apply'),
  typeFilterSelect: document.getElementById('type-filter-select'),
  typeFilterButton: document.getElementById('type-filter-button'),
  typeFilterMenu: document.getElementById('type-filter-menu'),
  typeFilter: document.getElementById('type-filter'),
  searchInput: document.getElementById('search-input'),
  advancedTypeSelect: document.getElementById('advanced-type-select'),
  advancedTypeButton: document.getElementById('advanced-type-button'),
  advancedTypeMenu: document.getElementById('advanced-type-menu'),
  advancedType: document.getElementById('advanced-type'),
  advancedText: document.getElementById('advanced-text'),
  advancedDeep: document.getElementById('advanced-deep'),
  advancedSearch: document.getElementById('advanced-search'),
  advancedClear: document.getElementById('advanced-clear'),
  advancedResults: document.getElementById('advanced-results'),
  advancedTotal: document.getElementById('advanced-total'),
  filterSpecificContainer: document.getElementById('filter-specific-container'),
  filterSpecificToggle: document.getElementById('filter-specific-toggle'),
  filterSpecificContent: document.getElementById('filter-specific-content'),
  groupToggles: document.querySelectorAll('.group-toggle'),
  groups: document.getElementById('groups'),
  groupsEmpty: document.getElementById('groups-empty'),
  botsList: document.getElementById('bots-list'),
  botsEmpty: document.getElementById('bots-empty'),
  statusLight: document.getElementById('status-light'),
  quickLight: document.getElementById('quick-light'),
  advancedLight: document.getElementById('advanced-light'),
};

let modeConfig = getModeConfig(DEFAULT_MODE_ID);

const setCurrentMode = (mode) => {
  modeConfig = getModeConfig(mode);
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

const applySyncStatus = (status) => {
  state.syncStatus = status;
  setText(els.statusSync, formatSyncStatus(status));
  updateSyncButtons();
  let botChanged = false;
  if (status?.appBaseUrl) state.appBaseUrl = status.appBaseUrl;
  if (status?.botId && status.botId !== state.botId) {
    state.botId = status.botId;
    if (status.mode) state.mode = status.mode;
    setCurrentMode(state.mode);
    botChanged = true;
  }
  if (status?.mode && status.mode !== state.mode) {
    state.mode = status.mode;
    setCurrentMode(state.mode);
  }
  updateBotLabel();
  loadMeta();
  if (botChanged) {
    refreshGroups();
    refreshBotsList();
  }
};

const loadContext = async () => {
  const response = await callBG(MessageType.GET_CONTEXT);
  if (response.ok && response.data?.context) {
    state.botId = response.data.context.botId ?? null;
    state.mode = response.data.context.mode ?? null;
    state.appBaseUrl = response.data.context.appBaseUrl ?? null;
    setCurrentMode(state.mode);
    state.hasAuth = Boolean(response.data.hasAuth);
    updateBotLabel();
    setText(els.statusAuth, state.hasAuth ? 'ok' : 'ausente');
    updateSyncButtons();
    loadMeta();
  }
};

const loadStatus = async () => {
  const response = await callBG(MessageType.GET_STATUS);
  if (response.ok) applySyncStatus(response.data?.status);
};

const refreshGroups = async () => {
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

  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener('click', (event) => {
    if (!selectRoot.contains(event.target)) {
      menu.hidden = true;
    }
  });
};

const syncTypeSelectButton = ({ button, value, labels }) => {
  if (!button) return;
  const label = value ? labels[value] ?? value : 'Todos os tipos';
  const iconUrl = value ? getTypeIconUrl(value, getIconsBasePath()) : null;
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

const buildTypeOption = ({ value, label, count, onSelect }) => {
  const option = document.createElement('button');
  option.type = 'button';
  option.className = 'type-select__option';
  option.dataset.value = value;

  const iconUrl = value ? getTypeIconUrl(value, getIconsBasePath()) : null;
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

const updateTypeOptions = () => {
  ensureTypeSelectBindings(els.typeFilterSelect, els.typeFilterButton, els.typeFilterMenu);
  ensureTypeSelectBindings(els.advancedTypeSelect, els.advancedTypeButton, els.advancedTypeMenu);
  const typeCounts = {};
  const typeLabelByValue = {};

  for (const group of state.groups) {
    const counts = group.typeCounts || {};
    Object.entries(counts).forEach(([key, value]) => {
      if (!key) return;
      const count = typeof value === 'number' ? value : value?.count ?? 0;
      const label = typeof value === 'number' ? key : value?.label ?? key;
      const mappedLabel = getTypeLabel(key);
      if (!typeCounts[key]) typeCounts[key] = 0;
      typeCounts[key] += count;
      if (!typeLabelByValue[key]) typeLabelByValue[key] = mappedLabel;
    });
  }

  state.typeLabelByValue = typeLabelByValue;
  const entries = Object.entries(typeCounts).map(([key, count]) => ({
    value: key,
    label: typeLabelByValue[key] ?? key,
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
    state.type = '';
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
          state.advanced.type = value;
          els.advancedType.value = value;
          syncTypeSelectButton({ button: els.advancedTypeButton, value, labels: state.typeLabelByValue });
          els.advancedTypeMenu.hidden = true;
          updateSpecificFilterUI();
          persistPanelState();
        },
      }),
    );
    entries.forEach(({ value, label, count }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      els.advancedType.appendChild(option);
      els.advancedTypeMenu.appendChild(
        buildTypeOption({
          value,
          label,
          count,
          onSelect: (selected) => {
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
      state.advanced.type = '';
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

const refreshBotsList = async () => {
  const response = await callBG(MessageType.LIST_BOTS);
  const bots = response.ok ? response.data?.bots ?? [] : [];
  bots.sort((a, b) => {
    const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
    if (pinnedDiff !== 0) return pinnedDiff;
    const dateA = new Date(a.lastItemsSyncAt || a.lastSummarySyncAt || 0).getTime();
    const dateB = new Date(b.lastItemsSyncAt || b.lastSummarySyncAt || 0).getTime();
    return dateB - dateA;
  });
  els.botsList.innerHTML = '';
  if (!bots.length) {
    els.botsEmpty.style.display = 'block';
    return;
  }
  els.botsEmpty.style.display = 'none';
  for (const bot of bots) {
    const row = document.createElement('div');
    row.className = 'bot-row';
    if (bot.pinned) row.classList.add('pinned');

    const info = document.createElement('div');
    info.className = 'bot-info';

    const title = document.createElement('div');
    title.className = 'bot-title';
    title.textContent = bot.botTitle || bot.botId;
    info.appendChild(title);

    const idLine = document.createElement('div');
    idLine.className = 'bot-meta';
    idLine.textContent = bot.botTitle ? bot.botId : '';
    info.appendChild(idLine);

    const sizeBytes = (bot.summaryBytes || 0) + (bot.fullBytes || 0);
    const stats = document.createElement('div');
    stats.className = 'bot-stats';
    stats.textContent = `Summary: ${bot.summaryCount ?? 0} | Full: ${bot.fullCount ?? 0} | Cache: ${formatBytes(sizeBytes)}`;
    info.appendChild(stats);

    const dates = document.createElement('div');
    dates.className = 'bot-dates';
    dates.textContent = `Summary: ${formatDate(bot.lastSummarySyncAt)} | Full: ${formatDate(bot.lastItemsSyncAt)}`;
    info.appendChild(dates);

    const actions = document.createElement('div');
    actions.className = 'bot-actions';

    const pinBtn = document.createElement('button');
    pinBtn.className = 'bot-pin';
    pinBtn.textContent = bot.pinned ? 'Desfixar' : 'Fixar';
    pinBtn.addEventListener('click', async () => {
      await callBG(MessageType.TOGGLE_PIN, { botId: bot.botId, pinned: !bot.pinned });
      refreshBotsList();
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'bot-remove';
    removeBtn.textContent = 'Remover';
    removeBtn.disabled = Boolean(bot.pinned);
    removeBtn.title = bot.pinned ? 'Desfixe para remover' : 'Remover dados do bot';
    removeBtn.addEventListener('click', async () => {
      const res = await callBG(MessageType.REMOVE_BOT, { botId: bot.botId });
      if (!res.ok) return;
      refreshBotsList();
      if (bot.botId === state.botId) {
        refreshGroups();
      }
    });

    actions.appendChild(pinBtn);
    actions.appendChild(removeBtn);

    row.appendChild(info);
    row.appendChild(actions);
    els.botsList.appendChild(row);
  }
};

const startSync = async (fullItems) => {
  const response = await callBG(MessageType.START_SYNC, { fullItems });
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
    // ignore
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
    // ignore
  }
};

const ensureSpecificToggleBinding = () => {
  if (!els.filterSpecificToggle || !els.filterSpecificContent) return;
  if (els.filterSpecificToggle.dataset.bound === 'true') return;
  els.filterSpecificToggle.dataset.bound = 'true';
  els.filterSpecificToggle.addEventListener('change', () => {
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

  if (!typeValue || !configEntry) {
    els.filterSpecificContainer.hidden = true;
    els.filterSpecificContent.innerHTML = '';
    els.filterSpecificToggle.checked = false;
    state.advanced.specific = { enabled: false, fields: {}, type: typeValue };
    persistPanelState();
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
    const title = groupsById.get(groupId) || groupId || 'Grupo';
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
  if (!state.botId) {
    setText(els.advancedTotal, '0 blocos encontrados');
    renderAdvancedResults([]);
    return;
  }
  try {
    const meta = (state.meta && state.meta.botId === state.botId) ? state.meta : await loadMeta();
    if (!meta?.lastItemsSyncAt) {
      if (els.advancedResults) {
        els.advancedResults.innerHTML = '';
        const warn = document.createElement('div');
        warn.className = 'muted';
        warn.textContent = 'Sincronize os detalhes completos antes de buscar.';
        els.advancedResults.appendChild(warn);
      }
      return;
    }

    state.advanced.query = els.advancedText?.value.trim() ?? '';
    state.advanced.type = els.advancedType?.value ?? '';
    state.advanced.deep = Boolean(els.advancedDeep?.checked);
    persistPanelState();

    const specificConfig = resolveSpecificConfig(state.advanced.type);
    const specificEnabled = Boolean(state.advanced.specific.enabled && specificConfig?.match);
    const filterFn = specificEnabled
      ? (record) => {
          const payload = record?.payload ?? record;
          try {
            return Boolean(specificConfig.match(payload, state.advanced.specific.fields, specificFilterHelpers));
          } catch {
            return false;
          }
        }
      : null;

    const results = await searchFullItems(state.botId, {
      type: state.advanced.type,
      query: state.advanced.query,
      deep: state.advanced.deep,
      limit: 1000,
      filterFn,
    });
    state.advanced.results = results;
    setText(els.advancedTotal, `${results.length} blocos encontrados`);
    renderAdvancedResults(results);
  } catch (error) {
    if (els.advancedResults) {
      els.advancedResults.innerHTML = '';
      const warn = document.createElement('div');
      warn.className = 'muted';
      warn.textContent = `Erro ao buscar: ${error?.message ?? error}`;
      els.advancedResults.appendChild(warn);
    }
  }
};

const clearAdvancedSearch = () => {
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
  setText(els.advancedTotal, '0 blocos encontrados');
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
  // Only one search section should be visible:
  // - none until summary sync
  // - quick after summary sync
  // - advanced after full sync
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
  if (els.advancedSearch) els.advancedSearch.disabled = !fullReady;
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
  if (!state.botId) {
    state.meta = null;
    updateSemaforo();
    return null;
  }
  try {
    state.meta = await getMeta(state.botId);
  } catch {
    state.meta = null;
  }
  updateBotLabel();
  updateMetaStats();
  updateSemaforo();
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

  const titleText = document.createElement('span');
  titleText.textContent = item.title || 'Sem título';
  title.appendChild(titleText);

  const linkButton = document.createElement('button');
  linkButton.className = 'item-link';
  linkButton.type = 'button';
  linkButton.textContent = 'Abrir';
  linkButton.title = 'Abrir no Boteria';
  linkButton.addEventListener('click', () => {
    document.querySelectorAll('.item-row.active').forEach((el) => el.classList.remove('active'));
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
  const toggles = document.querySelectorAll('.section-toggle');
  toggles.forEach((button) => {
    const targetId = button.dataset.target;
    const target = targetId ? document.getElementById(targetId) : null;
    if (!target) return;
    const sectionKey =
      targetId === 'status-content'
        ? 'status'
        : targetId === 'quick-content'
          ? 'quick'
          : targetId === 'advanced-content'
            ? 'advanced'
            : 'bots';
    if (state.collapsedSections[sectionKey]) {
      target.setAttribute('hidden', 'true');
      button.textContent = 'Exibir';
    }
    button.addEventListener('click', () => {
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

els.searchInput.addEventListener('input', handleSearchChange);
els.typeFilter.addEventListener('change', handleTypeChange);
els.searchApply.addEventListener('click', () => {
  applyFilters();
});
if (els.advancedDeep) {
  els.advancedDeep.addEventListener('change', handleAdvancedDeepChange);
}
if (els.advancedSearch) {
  els.advancedSearch.addEventListener('click', () => runAdvancedSearch());
}
if (els.advancedClear) {
  els.advancedClear.addEventListener('click', () => clearAdvancedSearch());
}
if (els.advancedText) {
  els.advancedText.addEventListener('input', handleAdvancedInput);
  els.advancedText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') runAdvancedSearch();
  });
}
if (els.groupToggles) {
  els.groupToggles.forEach((button) => {
    button.addEventListener('click', () => {
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
els.syncSummary.addEventListener('click', () => startSync(false));
els.syncFull.addEventListener('click', () => startSync(true));
if (els.syncFullCta) {
  els.syncFullCta.addEventListener('click', () => startSync(true));
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MessageType.SYNC_STATUS) {
    applySyncStatus(message.state);
    if (!message.state?.running && message.state?.phase === 'idle') {
      refreshGroups();
      refreshBotsList();
    }
  }
});

const init = async () => {
  await loadPanelState();
  initSectionToggles();
  updateAdvancedPlaceholder();
  updateSpecificFilterUI();
  updateGroupToggleLabels();
  await loadContext();
  await loadStatus();
  await refreshGroups();
  await refreshBotsList();
  if (state.advanced.query || state.advanced.type) {
    runAdvancedSearch();
  }
  setInterval(loadContext, 2000);
  updateSemaforo();
};

init();
