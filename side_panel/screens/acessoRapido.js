import { callBG, MessageType } from '../../services/messaging.js';

const TEMPLATE_ID = 'tpl-screen-acesso-rapido';
const MODE_BOT = 'bot';
const MODE_URA = 'ura';
const ABSTRACT_BASE_URL = 'https://bots.digitalcontact.cloud';

const createInitialState = () => ({
  records: [],
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
    refreshBtn: q('#quick-access-refresh'),
    groupsToggleBtn: q('#quick-access-groups-toggle'),
    recordsCount: q('#quick-access-records-count'),
    orgsCount: q('#quick-access-orgs-count'),
    error: q('#quick-access-error'),
    list: q('#quick-access-list'),
    empty: q('#quick-access-empty'),
  };
};

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const normalizeMode = (value) => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const modeLabel = (mode) => {
  if (mode === MODE_URA) return 'URA';
  if (mode === MODE_BOT) return 'BOT';
  return '?';
};

const buildAbstractUrl = (botId, mode) => {
  const id = String(botId ?? '').trim();
  const normalizedMode = normalizeMode(mode);
  if (!id || !normalizedMode) return null;
  if (normalizedMode === MODE_URA) return `${ABSTRACT_BASE_URL}/ivrs/${id}/abstract`;
  return `${ABSTRACT_BASE_URL}/bots/${id}/abstract`;
};

const normalizeCompanyName = (value) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const resolveOrgGroupInfo = (record) => {
  const orgId = String(record?.orgId ?? '').trim();
  const companyName = normalizeCompanyName(record?.companyFantasyName);
  if (orgId) {
    return {
      key: `org:${orgId}`,
      orgId,
      label: companyName || `Org ${orgId}`,
      isUnknown: false,
    };
  }
  return {
    key: 'org:unknown',
    orgId: '',
    label: companyName || 'Sem organização',
    isUnknown: true,
  };
};

const sortRecords = (records) => {
  const list = Array.isArray(records) ? records.slice() : [];
  list.sort((a, b) => {
    const titleA = String(a?.botTitle ?? a?.botId ?? '').trim();
    const titleB = String(b?.botTitle ?? b?.botId ?? '').trim();
    return titleA.localeCompare(titleB, 'pt-BR');
  });
  return list;
};

const groupRecordsByOrg = (records) => {
  const map = new Map();
  for (const record of Array.isArray(records) ? records : []) {
    const groupInfo = resolveOrgGroupInfo(record);
    if (!map.has(groupInfo.key)) {
      map.set(groupInfo.key, {
        key: groupInfo.key,
        label: groupInfo.label,
        orgId: groupInfo.orgId,
        isUnknown: groupInfo.isUnknown,
        records: [],
      });
    }
    map.get(groupInfo.key).records.push(record);
  }

  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.records = sortRecords(group.records);
  });

  groups.sort((a, b) => {
    if (a.isUnknown !== b.isUnknown) return a.isUnknown ? 1 : -1;
    return String(a.label).localeCompare(String(b.label), 'pt-BR');
  });

  return groups;
};

const updateSummary = () => {
  const records = Array.isArray(state.records) ? state.records : [];
  const orgGroups = groupRecordsByOrg(records).filter((group) => !group.isUnknown);

  setText(els.recordsCount, String(records.length));
  setText(els.orgsCount, String(orgGroups.length));

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
    const hasRecords = records.length > 0;
    els.groupsToggleBtn.disabled = !hasRecords || state.loading;
    els.groupsToggleBtn.textContent = state.groupsOpenAll && hasRecords ? 'Fechar grupos' : 'Abrir grupos';
  }
};

const buildRecordRow = (record) => {
  const row = document.createElement('div');
  row.className = 'quick-access-row';

  const info = document.createElement('div');
  info.className = 'quick-access-info';

  const title = document.createElement('div');
  title.className = 'quick-access-title';
  title.textContent = record?.botTitle || record?.botId || '-';
  info.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'quick-access-meta';
  meta.textContent = `${modeLabel(record?.mode)} • ${record?.botId || '-'} • Full: ${formatDate(record?.lastItemsSyncAt)}`;
  info.appendChild(meta);

  const actions = document.createElement('div');
  actions.className = 'quick-access-actions';

  const openBtn = document.createElement('button');
  openBtn.className = 'item-link';
  openBtn.type = 'button';
  openBtn.textContent = 'Acessar';
  const abstractUrl = buildAbstractUrl(record?.botId, record?.mode);
  openBtn.disabled = !abstractUrl;
  if (abstractUrl) {
    openBtn.title = abstractUrl;
    openBtn.addEventListener('click', () => {
      callBG(MessageType.OPEN_URL_CURRENT_TAB, { url: abstractUrl }).catch(() => undefined);
    });
  }

  actions.appendChild(openBtn);

  row.appendChild(info);
  row.appendChild(actions);

  return row;
};

const renderRecords = () => {
  if (!els.list) return;
  els.list.innerHTML = '';

  const records = Array.isArray(state.records) ? state.records : [];
  if (els.empty) els.empty.hidden = records.length > 0;
  if (!records.length) return;

  const groups = groupRecordsByOrg(records);
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
    right.textContent = String(group.records.length);

    header.appendChild(left);
    header.appendChild(right);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    group.records.forEach((record) => content.appendChild(buildRecordRow(record)));

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

const loadRecords = async () => {
  if (disposed) return;
  state.loading = true;
  state.error = null;
  updateSummary();

  try {
    const response = await callBG(MessageType.LIST_BOTS);
    if (!response.ok) {
      state.records = [];
      state.error = response.error?.message ?? 'Falha ao listar registros.';
      state.groupsOpenAll = false;
      state.openOrgGroups = {};
    } else {
      const list = Array.isArray(response.data?.bots) ? response.data.bots : [];
      const filtered = list
        .filter((meta) => {
          const orgId = String(meta?.orgId ?? '').trim();
          const mode = normalizeMode(meta?.mode);
          return Boolean(orgId) && Boolean(mode);
        })
        .map((meta) => ({ ...meta, mode: normalizeMode(meta?.mode) }));

      state.records = sortRecords(filtered);
      if (!state.records.length) {
        state.groupsOpenAll = false;
        state.openOrgGroups = {};
      }
    }
  } catch (error) {
    state.records = [];
    state.error = String(error?.message ?? error);
    state.groupsOpenAll = false;
    state.openOrgGroups = {};
  } finally {
    state.loading = false;
  }

  updateSummary();
  renderRecords();
};

const init = async () => {
  if (els.refreshBtn) on(els.refreshBtn, 'click', () => loadRecords());
  if (els.groupsToggleBtn) {
    on(els.groupsToggleBtn, 'click', () => {
      state.groupsOpenAll = !state.groupsOpenAll;
      state.openOrgGroups = {};
      updateSummary();
      renderRecords();
    });
  }

  await loadRecords();
};

export const screenAcessoRapido = {
  id: 'acesso-rapido',
  title: 'Acesso Rápido',
  mount: async ({ root }) => {
    disposed = false;
    cleanupFns = [];
    state = createInitialState();
    rootEl = root;

    const template = document.getElementById(TEMPLATE_ID);
    if (!template) {
      throw new Error(`Template "${TEMPLATE_ID}" não encontrado em panel.html`);
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
          // ignore
        }
      });
      if (rootEl) rootEl.innerHTML = '';
      els = {};
      rootEl = null;
      state = createInitialState();
    };
  },
};
