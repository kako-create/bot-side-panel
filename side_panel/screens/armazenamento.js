import { callBG, MessageType } from '../../services/messaging.js';
import { normalizeText } from '../../shared/utils.js';

const TEMPLATE_ID = 'tpl-screen-armazenamento';

const createInitialState = () => ({
  bots: [],
  loading: false,
  error: null,
  groupsOpenAll: true,
  openOrgGroups: {},
});

let rootEl = null;
let state = createInitialState();
let els = {};
let disposed = false;
let cleanupFns = [];

const on = (target, event, handler, options) => {
  if (!target) return;
  target.addEventListener(event, handler, options);
  cleanupFns.push(() => target.removeEventListener(event, handler, options));
};

const setText = (el, value) => {
  if (!el) return;
  el.textContent = value ?? '';
};

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  return {
    refreshBtn: q('#storage-refresh'),
    groupsToggleBtn: q('#storage-groups-toggle'),
    botsCount: q('#storage-bots-count'),
    cacheSize: q('#storage-cache-size'),
    error: q('#storage-error'),
    list: q('#storage-bots'),
    empty: q('#storage-empty'),
  };
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

const getBotBytes = (meta) =>
  Number(meta?.summaryBytes ?? 0) +
  Number(meta?.fullBytes ?? 0) +
  Number(meta?.variablesBytes ?? 0) +
  Number(meta?.tagsBytes ?? 0) +
  Number(meta?.intentsBytes ?? 0) +
  Number(meta?.lexIntentsBytes ?? 0);

const sortBots = (bots) => {
  const list = Array.isArray(bots) ? bots.slice() : [];
  list.sort((a, b) => {
    const pinnedDiff = Number(Boolean(b?.pinned)) - Number(Boolean(a?.pinned));
    if (pinnedDiff !== 0) return pinnedDiff;
    const dateA = new Date(a?.lastItemsSyncAt || a?.lastSummarySyncAt || 0).getTime();
    const dateB = new Date(b?.lastItemsSyncAt || b?.lastSummarySyncAt || 0).getTime();
    return dateB - dateA;
  });
  return list;
};

const normalizeCompanyName = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const resolveOrgGroupInfo = (bot) => {
  const orgId = String(bot?.orgId ?? '').trim();
  const companyName = normalizeCompanyName(bot?.companyFantasyName);
  if (orgId) {
    return {
      key: `org:${orgId}`,
      orgId,
      label: companyName || `Org ${orgId}`,
      isUnknown: false,
    };
  }
  if (companyName) {
    return {
      key: `name:${normalizeText(companyName) || companyName.toLowerCase()}`,
      orgId: '',
      label: companyName,
      isUnknown: false,
    };
  }
  return {
    key: 'org:unknown',
    orgId: '',
    label: 'Sem organização',
    isUnknown: true,
  };
};

const groupBotsByOrg = (bots) => {
  const map = new Map();
  for (const bot of Array.isArray(bots) ? bots : []) {
    const groupInfo = resolveOrgGroupInfo(bot);
    if (!map.has(groupInfo.key)) {
      map.set(groupInfo.key, {
        key: groupInfo.key,
        label: groupInfo.label,
        orgId: groupInfo.orgId,
        isUnknown: groupInfo.isUnknown,
        bots: [],
      });
    }
    map.get(groupInfo.key).bots.push(bot);
  }

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.bots = sortBots(group.bots);
  });
  groups.sort((a, b) => {
    if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1;
    return String(a.label).localeCompare(String(b.label), 'pt-BR');
  });
  return groups;
};

const updateSummary = () => {
  const bots = Array.isArray(state.bots) ? state.bots : [];
  const totalBytes = bots.reduce((acc, b) => acc + getBotBytes(b), 0);

  setText(els.botsCount, String(bots.length));
  setText(els.cacheSize, formatBytes(totalBytes));

  if (els.error) {
    if (state.error) {
      els.error.hidden = false;
      els.error.textContent = state.error;
    } else {
      els.error.hidden = true;
      els.error.textContent = '';
    }
  }

  if (els.refreshBtn) {
    els.refreshBtn.disabled = Boolean(state.loading);
    els.refreshBtn.textContent = state.loading ? 'Atualizando...' : 'Atualizar';
  }
  if (els.groupsToggleBtn) {
    const hasBots = bots.length > 0;
    els.groupsToggleBtn.disabled = !hasBots || state.loading;
    els.groupsToggleBtn.textContent = state.groupsOpenAll && hasBots ? 'Fechar grupos' : 'Abrir grupos';
  }
};

const buildBotRow = (bot) => {
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

  const sizeBytes = getBotBytes(bot);
  const stats = document.createElement('div');
  stats.className = 'bot-stats';
  stats.textContent =
    `Resumo: ${bot.summaryCount ?? 0} | ` +
    `Completo: ${bot.fullCount ?? 0} | ` +
    `Variáveis: ${bot.variablesCount ?? 0} | ` +
    `TAGs: ${bot.tagsCount ?? 0} | ` +
    `Condições: ${bot.intentsCount ?? 0} | ` +
    `Intenções: ${bot.lexIntentsCount ?? 0} | ` +
    `Cache: ${formatBytes(sizeBytes)}`;
  info.appendChild(stats);

  const dates = document.createElement('div');
  dates.className = 'bot-dates';
  dates.textContent =
    `Resumo: ${formatDate(bot.lastSummarySyncAt)} | ` +
    `Completo: ${formatDate(bot.lastItemsSyncAt)} | ` +
    `Variáveis: ${formatDate(bot.lastVariablesSyncAt)} | ` +
    `TAGs: ${formatDate(bot.lastTagsSyncAt)} | ` +
    `Condições: ${formatDate(bot.lastIntentsSyncAt)} | ` +
    `Intenções: ${formatDate(bot.lastLexIntentsSyncAt)}`;
  info.appendChild(dates);

  const actions = document.createElement('div');
  actions.className = 'bot-actions';

  const pinBtn = document.createElement('button');
  pinBtn.className = 'bot-pin';
  pinBtn.type = 'button';
  pinBtn.textContent = bot.pinned ? 'Desfixar' : 'Fixar';
  pinBtn.addEventListener('click', async () => {
    await callBG(MessageType.TOGGLE_PIN, { botId: bot.botId, pinned: !bot.pinned });
    await loadBots();
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'bot-remove';
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remover';
  removeBtn.disabled = Boolean(bot.pinned);
  removeBtn.title = bot.pinned ? 'Desfixe para remover' : 'Remover dados do bot';
  removeBtn.addEventListener('click', async () => {
    const res = await callBG(MessageType.REMOVE_BOT, { botId: bot.botId });
    if (!res.ok) return;
    await loadBots();
  });

  actions.appendChild(pinBtn);
  actions.appendChild(removeBtn);

  row.appendChild(info);
  row.appendChild(actions);
  return row;
};

const renderBots = () => {
  if (!els.list) return;
  els.list.innerHTML = '';

  const bots = Array.isArray(state.bots) ? state.bots : [];
  if (els.empty) els.empty.hidden = bots.length > 0;
  if (bots.length === 0) return;

  const groups = groupBotsByOrg(bots);
  for (const group of groups) {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';

    const left = document.createElement('div');
    left.className = 'bot-group-label';

    const title = document.createElement('span');
    title.textContent = group.label;
    left.appendChild(title);

    if (group.orgId) {
      const org = document.createElement('span');
      org.className = 'bot-group-id';
      org.textContent = group.orgId;
      left.appendChild(org);
    }

    const right = document.createElement('span');
    right.className = 'tag-group-meta';
    right.textContent = String(group.bots.length);

    header.appendChild(left);
    header.appendChild(right);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    group.bots.forEach((bot) => content.appendChild(buildBotRow(bot)));

    const groupPref = state.openOrgGroups[group.key];
    const isOpen = state.groupsOpenAll ? groupPref !== false : groupPref === true;
    if (!isOpen) {
      content.setAttribute('hidden', 'true');
    }
    header.addEventListener('click', () => {
      const currentlyOpen = !content.hasAttribute('hidden');
      if (currentlyOpen) {
        content.setAttribute('hidden', 'true');
        state.openOrgGroups[group.key] = false;
      } else {
        content.removeAttribute('hidden');
        state.openOrgGroups[group.key] = true;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    els.list.appendChild(wrapper);
  }
};

const loadBots = async () => {
  if (disposed) return;
  state.loading = true;
  state.error = null;
  updateSummary();

  try {
    const response = await callBG(MessageType.LIST_BOTS);
    if (!response.ok) {
      state.bots = [];
      state.error = response.error?.message ?? 'Falha ao listar bots.';
      state.groupsOpenAll = false;
      state.openOrgGroups = {};
    } else {
      const bots = response.data?.bots ?? [];
      state.bots = sortBots(bots);
      if (!state.bots.length) {
        state.groupsOpenAll = false;
        state.openOrgGroups = {};
      }
    }
  } catch (error) {
    state.bots = [];
    state.error = String(error?.message ?? error);
    state.groupsOpenAll = false;
    state.openOrgGroups = {};
  } finally {
    state.loading = false;
  }

  updateSummary();
  renderBots();
};

const init = async () => {
  if (els.refreshBtn) on(els.refreshBtn, 'click', () => loadBots());
  if (els.groupsToggleBtn) {
    on(els.groupsToggleBtn, 'click', () => {
      state.groupsOpenAll = !state.groupsOpenAll;
      state.openOrgGroups = {};
      updateSummary();
      renderBots();
    });
  }
  await loadBots();
};

export const screenArmazenamento = {
  id: 'armazenamento',
  title: 'Armazenamento',
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
