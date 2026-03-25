import { callBG, MessageType } from '../../services/messaging.js';
import { getMeta, listBotTags, searchFullItems } from '../../data/db.js';
import { saveActiveScreenId } from '../router.js';
import { saveConsultaIntent } from '../consultaIntent.js';
import { PANEL_EVENTS } from '../panelEvents.js';
import { normalizeText } from '../../shared/utils.js';

const TEMPLATE_ID = 'tpl-screen-tags';
const TAG_GROUP_REGEX = /^([A-Za-z]{3})\.(\d{3,4})$/;
const MODE_BOT = 'bot';
const MODE_URA = 'ura';
const SCRIPT_BLOCK_TYPE_REGEX = /script/;
const SCRIPT_FIELD_KEY_REGEX = /(script|code)/i;
const SCRIPT_TAG_ICON_PATH = 'assets/svgs/bot/Script.svg';

const createInitialState = () => ({
  botId: null,
  hasAuth: false,
  syncing: false,
  lastError: null,
  meta: null,
  tags: [],
  missingTags: [],
  unusedTags: [],
  scriptOnlyTagKeys: new Set(),
  usageScanError: null,
  openGroups: {},
  collapsedSections: {
    status: false,
    used: false,
    missing: false,
    unused: false,
  },
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

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return String(value);
  }
};

const initEls = () => {
  const q = (sel) => rootEl?.querySelector(sel) ?? null;
  const qa = (sel) => (rootEl ? Array.from(rootEl.querySelectorAll(sel)) : []);
  return {
    light: q('#tags-light'),
    bot: q('#tags-bot'),
    auth: q('#tags-auth'),
    status: q('#tags-status'),
    total: q('#tags-total'),
    lastSync: q('#tags-last-sync'),
    syncBtn: q('#tags-sync'),
    usedSection: q('#tags-used-section'),
    missingSection: q('#tags-missing-section'),
    unusedSection: q('#tags-unused-section'),
    usedResults: q('#tags-used-results'),
    missingResults: q('#tags-missing-results'),
    unusedResults: q('#tags-unused-results'),
    sectionToggles: qa('.section-toggle'),
  };
};

const updateHeader = () => {
  const title = state.meta?.botTitle;
  if (!state.botId) setText(els.bot, '-');
  else if (title) setText(els.bot, `${title} (${state.botId})`);
  else setText(els.bot, state.botId);
  setText(els.auth, state.hasAuth ? 'ok' : 'ausente');
};

const getCanonicalMode = () => {
  const raw = String(state.meta?.mode ?? '').trim().toLowerCase();
  if (raw === MODE_BOT || raw === MODE_URA) return raw;
  return null;
};

const updateStatus = () => {
  const hasBotAndAuth = Boolean(state.botId) && Boolean(state.hasAuth);
  const mode = getCanonicalMode();
  const synced = Boolean(state.meta?.lastTagsSyncAt);
  if (!hasBotAndAuth) {
    setText(els.status, 'Aguardando bot/token');
    setLight(els.light, 'red');
    return;
  }
  if (state.syncing) {
    setText(els.status, 'Sincronizando...');
    setLight(els.light, 'yellow');
    return;
  }
  if (state.lastError) {
    setText(els.status, `Erro: ${state.lastError}`);
    setLight(els.light, 'red');
    return;
  }
  if (!mode) {
    setText(els.status, 'Modo indefinido. Execute "Sinc. Busca avançada".');
    setLight(els.light, 'red');
    return;
  }
  setText(els.status, synced ? 'OK' : 'Pronto para sincronizar');
  setLight(els.light, synced ? 'green' : 'red');
};

const updateStats = () => {
  const total = Array.isArray(state.tags) ? state.tags.length : 0;
  setText(els.total, String(total));
  setText(els.lastSync, formatDate(state.meta?.lastTagsSyncAt));
};

const updateSyncButton = () => {
  if (!els.syncBtn) return;
  const ready = Boolean(state.botId) && Boolean(state.hasAuth) && Boolean(getCanonicalMode()) && !state.syncing;
  els.syncBtn.disabled = !ready;
};

const getTagLabel = (rec) => String(rec?.label ?? rec?.payload?.tag ?? rec?.payload?.label ?? '').trim();

const getTagEntryLabel = (entry) => {
  if (entry === null || entry === undefined) return '';
  if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
    return String(entry).trim();
  }
  if (typeof entry !== 'object') return '';
  const raw =
    entry.name ??
    entry.label ??
    entry.tag ??
    entry.value ??
    entry.key ??
    entry._id ??
    entry.id ??
    '';
  return String(raw ?? '').trim();
};

const normalizeSearchText = (value) =>
  normalizeText(String(value ?? '').replace(/\r/g, '')).replace(/\s+/g, ' ');

const normalizeTagKey = (value) => normalizeSearchText(String(value ?? '').trim());

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const isPlainObject = (value) => Object.prototype.toString.call(value) === '[object Object]';

const getRecordType = (record) =>
  String(record?.type ?? record?.payload?.type ?? '')
    .trim()
    .toLowerCase();

const isScriptBlockRecord = (record) => SCRIPT_BLOCK_TYPE_REGEX.test(getRecordType(record));

const collectScriptTextValues = (value, path = [], out = []) => {
  if (value === null || value === undefined) return out;
  if (Array.isArray(value)) {
    value.forEach((entry) => collectScriptTextValues(entry, path, out));
    return out;
  }
  if (isPlainObject(value)) {
    Object.entries(value).forEach(([key, child]) => {
      collectScriptTextValues(child, [...path, key], out);
    });
    return out;
  }
  const lastKey = String(path[path.length - 1] ?? '');
  if (!SCRIPT_FIELD_KEY_REGEX.test(lastKey)) return out;

  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else {
    try {
      raw = JSON.stringify(value);
    } catch {
      raw = String(value);
    }
  }
  const normalized = normalizeSearchText(raw);
  if (normalized) out.push(normalized);
  return out;
};

const buildScriptTagMatchers = (records) => {
  const matchers = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const label = getTagLabel(record);
    const key = normalizeTagKey(label);
    if (!key || matchers.has(key)) return;
    const normalizedLabel = normalizeSearchText(label);
    if (!normalizedLabel) return;
    // Mantem bordas frouxas para nao confundir TAG1 com TAG10.
    matchers.set(key, new RegExp(`(^|[^a-z0-9_])${escapeRegExp(normalizedLabel)}(?=$|[^a-z0-9_])`, 'i'));
  });
  return matchers;
};

const getScriptTagIconUrl = () => globalThis.chrome?.runtime?.getURL?.(SCRIPT_TAG_ICON_PATH) ?? null;

const copyTextToClipboard = async (value) => {
  const text = String(value ?? '').trim();
  if (!text) return false;

  if (globalThis.navigator?.clipboard?.writeText) {
    try {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    } catch {
      // tenta fallback abaixo
    }
  }

  if (!document?.body) return false;

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', 'true');
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.pointerEvents = 'none';
  document.body.appendChild(input);
  input.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    input.remove();
  }
};

const toTimestamp = (value) => {
  const ms = new Date(value ?? '').getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const isFullSyncOlderThanTagsSync = (meta) => {
  const fullSyncAt = toTimestamp(meta?.lastItemsSyncAt);
  const tagsSyncAt = toTimestamp(meta?.lastTagsSyncAt);
  return Boolean(fullSyncAt && tagsSyncAt && fullSyncAt < tagsSyncAt);
};

const getSyncGapLabel = (meta) => {
  const fullSyncAt = toTimestamp(meta?.lastItemsSyncAt);
  const tagsSyncAt = toTimestamp(meta?.lastTagsSyncAt);
  if (!fullSyncAt || !tagsSyncAt || tagsSyncAt <= fullSyncAt) return '';

  const diffMs = tagsSyncAt - fullSyncAt;
  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  if (totalMinutes < 1) return '<1min';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${totalMinutes}min`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
};

const buildGroups = (records) => {
  const groups = new Map(); // chave -> { key, min, max, width, items: [] }
  const others = [];
  const buildGroupItem = (rec, label) => ({
    ...(rec && typeof rec === 'object' ? rec : {}),
    label,
    tagId: rec?.tagId ?? label,
  });

  records.forEach((rec) => {
    const label = getTagLabel(rec);
    if (!label) return;
    const match = TAG_GROUP_REGEX.exec(label);
    if (!match) {
      others.push(buildGroupItem(rec, label));
      return;
    }
    const key = match[1].toUpperCase();
    const rawNumber = match[2];
    const width = rawNumber.length;
    const value = Number.parseInt(rawNumber, 10);
    if (!groups.has(key)) {
      groups.set(key, { key, min: value, max: value, width, items: [] });
    }
    const g = groups.get(key);
    g.items.push(buildGroupItem(rec, label));
    g.width = Math.max(Number(g.width) || 0, width);
    if (value < g.min) g.min = value;
    if (value > g.max) g.max = value;
  });

  const out = Array.from(groups.values()).sort((a, b) => a.key.localeCompare(b.key));
  out.forEach((g) => {
    g.items.sort((a, b) => {
      const matchA = TAG_GROUP_REGEX.exec(a.label);
      const matchB = TAG_GROUP_REGEX.exec(b.label);
      const numA = matchA ? Number.parseInt(matchA[2], 10) : Number.POSITIVE_INFINITY;
      const numB = matchB ? Number.parseInt(matchB[2], 10) : Number.POSITIVE_INFINITY;
      if (numA !== numB) return numA - numB;
      return a.label.localeCompare(b.label);
    });
  });

  others.sort((a, b) => a.label.localeCompare(b.label));
  return { groups: out, others };
};

const buildMissingTagRecords = (records) => {
  const groups = new Map();

  (Array.isArray(records) ? records : []).forEach((record) => {
    const label = getTagLabel(record);
    if (!label) return;

    const match = TAG_GROUP_REGEX.exec(label);
    if (!match) return;

    const key = match[1].toUpperCase();
    const rawNumber = match[2];
    const width = rawNumber.length;
    const value = Number.parseInt(rawNumber, 10);
    if (!Number.isFinite(value)) return;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        min: value,
        max: value,
        width,
        values: new Set([value]),
      });
      return;
    }

    const group = groups.get(key);
    group.values.add(value);
    group.width = Math.max(Number(group.width) || 0, width);
    if (value < group.min) group.min = value;
    if (value > group.max) group.max = value;
  });

  const out = [];
  Array.from(groups.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .forEach((group) => {
      for (let value = group.min + 1; value < group.max; value += 1) {
        if (group.values.has(value)) continue;
        const label = `${group.key}.${String(value).padStart(group.width, '0')}`;
        out.push({ label, tagId: label, copyOnClick: true, copyValue: label });
      }
    });

  return out;
};

const buildTagRow = (item) => {
  const row = document.createElement('div');
  row.className = 'item-row';

  const title = document.createElement('div');
  title.className = 'item-title';

  const titleText = document.createElement('span');
  titleText.textContent = item?.label ?? 'Sem nome';
  if (item?.copyOnClick) {
    titleText.classList.add('item-title-copyable');
    titleText.title = 'Clique para copiar';
    titleText.setAttribute('role', 'button');
    titleText.setAttribute('tabindex', '0');

    const copyValue = String(item?.copyValue ?? item?.label ?? '').trim();
    const resetTitle = () => {
      if (!titleText.isConnected) return;
      titleText.title = 'Clique para copiar';
    };
    const handleCopy = async () => {
      if (!copyValue) return;
      const copied = await copyTextToClipboard(copyValue);
      titleText.title = copied ? 'Copiado' : 'Clique para copiar';
      globalThis.setTimeout(resetTitle, 1200);
    };

    titleText.addEventListener('click', () => {
      handleCopy();
    });
    titleText.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      handleCopy();
    });
  }
  title.appendChild(titleText);

  if (item?.scriptOnly) {
    const scriptIconUrl = getScriptTagIconUrl();
    if (scriptIconUrl) {
      const icon = document.createElement('img');
      icon.className = 'item-warning-icon';
      icon.alt = 'TAG usada apenas em script';
      icon.src = scriptIconUrl;
      icon.title = 'TAG usada apenas em bloco de script';
      icon.addEventListener('error', () => {
        icon.remove();
      });
      title.appendChild(icon);
    }
  }

  const actions = document.createElement('div');
  actions.className = 'actions-group';

  const right = document.createElement('strong');
  right.textContent = '';
  actions.appendChild(right);

  const query = String(item?.label ?? '').trim();
  const hasFullSync = Boolean(state.meta?.lastItemsSyncAt);
  if (hasFullSync && query) {
    const deepSearchButton = document.createElement('button');
    deepSearchButton.className = 'item-link';
    deepSearchButton.type = 'button';
    deepSearchButton.textContent = 'Buscar no payload';
    deepSearchButton.title = `Buscar "${query}" na busca avançada`;
    deepSearchButton.addEventListener('click', async () => {
      await saveConsultaIntent({
        kind: 'tag_payload_search',
        query,
        deep: true,
        type: '',
        autoRun: true,
      });
      await saveActiveScreenId('consulta');
      window.dispatchEvent(
        new CustomEvent(PANEL_EVENTS.NAVIGATE, {
          detail: { screenId: 'consulta' },
        }),
      );
    });
    actions.appendChild(deepSearchButton);
  }

  row.appendChild(title);
  row.appendChild(actions);
  return row;
};

const renderTagGroups = ({ target, records, scopePrefix, emptyMessage }) => {
  const { groups, others } = buildGroups(records);
  const allEmpty = groups.length === 0 && others.length === 0;
  if (allEmpty) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = emptyMessage;
    target.appendChild(empty);
    return;
  }

  const renderAccordion = ({ title, subtitle, count, rows }) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-group';

    const header = document.createElement('div');
    header.className = 'search-group-header';

    const left = document.createElement('span');
    left.textContent = title;

    const right = document.createElement('span');
    right.className = 'tag-group-meta';
    right.textContent = subtitle ? `${subtitle} (${count})` : String(count);

    header.appendChild(left);
    header.appendChild(right);

    const content = document.createElement('div');
    content.className = 'search-group-content';
    rows.forEach((row) => content.appendChild(buildTagRow(row)));

    const groupStateKey = `${scopePrefix}:${title}`;
    const isOpen = state.openGroups[groupStateKey] !== false;
    if (!isOpen) content.setAttribute('hidden', 'true');

    header.addEventListener('click', () => {
      const open = !content.hasAttribute('hidden');
      if (open) {
        content.setAttribute('hidden', 'true');
        state.openGroups[groupStateKey] = false;
      } else {
        content.removeAttribute('hidden');
        state.openGroups[groupStateKey] = true;
      }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(content);
    target.appendChild(wrapper);
  };

  groups.forEach((g) => {
    const pad = Math.max(Number(g.width) || 0, 3);
    const min = String(g.min).padStart(pad, '0');
    const max = String(g.max).padStart(pad, '0');
    const subtitle = `${min} → ${max}`;
    renderAccordion({ title: g.key, subtitle, count: g.items.length, rows: g.items });
  });

  if (others.length > 0) {
    renderAccordion({ title: 'Outros', subtitle: '', count: others.length, rows: others });
  }
};

const renderSyncedTags = () => {
  if (!els.usedResults) return;
  els.usedResults.innerHTML = '';

  if (!state.botId) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Selecione um bot no Boteria para ver as TAGs.';
    els.usedResults.appendChild(empty);
    return;
  }

  const items = Array.isArray(state.tags)
    ? state.tags.map((record) => ({
        ...record,
        scriptOnly: state.scriptOnlyTagKeys.has(normalizeTagKey(getTagLabel(record))),
      }))
    : [];
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Nenhuma TAG encontrada.';
    els.usedResults.appendChild(empty);
    return;
  }

  renderTagGroups({
    target: els.usedResults,
    records: items,
    scopePrefix: 'all',
    emptyMessage: 'Nenhuma TAG encontrada.',
  });
};

const renderMissingTags = () => {
  if (!els.missingResults) return;
  els.missingResults.innerHTML = '';

  if (!state.botId) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'Selecione um bot no Boteria para ver as TAGs não criadas.';
    els.missingResults.appendChild(empty);
    return;
  }

  const items = Array.isArray(state.missingTags) ? state.missingTags : [];
  renderTagGroups({
    target: els.missingResults,
    records: items,
    scopePrefix: 'missing',
    emptyMessage: 'Nenhuma TAG não criada encontrada.',
  });
};

const renderUnusedTags = () => {
  if (!els.unusedSection || !els.unusedResults) return;

  const hasFullSync = Boolean(state.meta?.lastItemsSyncAt);
  setHidden(els.unusedSection, !hasFullSync);
  if (!hasFullSync) return;

  els.unusedResults.innerHTML = '';

  if (state.usageScanError) {
    const warning = document.createElement('div');
    warning.className = 'muted';
    warning.textContent = `Erro ao validar uso das TAGs: ${state.usageScanError}`;
    els.unusedResults.appendChild(warning);
    return;
  }

  if (isFullSyncOlderThanTagsSync(state.meta)) {
    const warning = document.createElement('div');
    warning.className = 'muted tags-warning';
    const gapLabel = getSyncGapLabel(state.meta);
    warning.textContent =
      'Atenção: a sincronização completa é mais antiga que a sync de TAGs; o resultado pode estar desatualizado.' +
      (gapLabel ? ` (${gapLabel})` : '');
    els.unusedResults.appendChild(warning);
  }

  const unused = Array.isArray(state.unusedTags) ? state.unusedTags : [];
  renderTagGroups({
    target: els.unusedResults,
    records: unused,
    scopePrefix: 'unused',
    emptyMessage: 'Nenhuma TAG sem uso encontrada.',
  });
};

const renderTags = () => {
  renderSyncedTags();
  renderMissingTags();
  renderUnusedTags();
};

const buildMissingTags = () => {
  const sourceTags = Array.isArray(state.tags) ? state.tags : [];
  state.missingTags = buildMissingTagRecords(sourceTags);
};

const scanTagUsage = async (botId, sourceTags = []) => {
  const records = await searchFullItems(botId, { limit: 0 });
  const usedByFieldKeys = new Set();
  const usedByScriptKeys = new Set();
  const scriptTexts = [];

  records.forEach((record) => {
    const tags = record?.payload?.tags;
    if (Array.isArray(tags)) {
      tags.forEach((tag) => {
        const label = getTagEntryLabel(tag);
        const key = normalizeTagKey(label);
        if (key) usedByFieldKeys.add(key);
      });
    }

    if (!isScriptBlockRecord(record)) return;
    collectScriptTextValues(record?.payload ?? null).forEach((value) => {
      if (value) scriptTexts.push(value);
    });
  });

  if (scriptTexts.length) {
    const scriptSource = scriptTexts.join('\n');
    buildScriptTagMatchers(sourceTags).forEach((matcher, key) => {
      if (matcher.test(scriptSource)) usedByScriptKeys.add(key);
    });
  }

  return { usedByFieldKeys, usedByScriptKeys };
};

const buildUnusedTags = async () => {
  state.unusedTags = [];
  state.scriptOnlyTagKeys = new Set();
  state.usageScanError = null;

  if (!state.botId || !state.meta?.lastItemsSyncAt) return;

  try {
    const sourceTags = Array.isArray(state.tags) ? state.tags : [];
    if (!sourceTags.length) return;

    const { usedByFieldKeys, usedByScriptKeys } = await scanTagUsage(state.botId, sourceTags);
    if (disposed) return;
    state.scriptOnlyTagKeys = new Set(
      sourceTags
        .map((record) => normalizeTagKey(getTagLabel(record)))
        .filter((key) => key && usedByScriptKeys.has(key) && !usedByFieldKeys.has(key)),
    );
    state.unusedTags = sourceTags.filter((rec) => {
      const label = getTagLabel(rec);
      const key = normalizeTagKey(label);
      if (!key) return false;
      return !usedByFieldKeys.has(key) && !usedByScriptKeys.has(key);
    });
  } catch (error) {
    if (disposed) return;
    state.unusedTags = [];
    state.scriptOnlyTagKeys = new Set();
    state.usageScanError = String(error?.message ?? error);
  }
};

const initSectionToggles = () => {
  if (!Array.isArray(els.sectionToggles) || !els.sectionToggles.length) return;
  els.sectionToggles.forEach((button) => {
    const targetId = String(button?.dataset?.target ?? '').trim();
    if (!targetId) return;
    const target = rootEl?.querySelector(`#${targetId}`) ?? null;
    if (!target) return;

    const sectionKey =
      targetId === 'tags-status-content'
        ? 'status'
        : targetId === 'tags-used-content'
          ? 'used'
          : targetId === 'tags-missing-content'
            ? 'missing'
          : targetId === 'tags-unused-content'
            ? 'unused'
            : null;
    if (!sectionKey) return;

    if (state.collapsedSections[sectionKey]) {
      target.setAttribute('hidden', 'true');
      button.textContent = 'Exibir';
    } else {
      target.removeAttribute('hidden');
      button.textContent = 'Recolher';
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
    });
  });
};

const loadMetaAndTags = async () => {
  if (disposed) return;
  if (!state.botId) {
    state.meta = null;
    state.tags = [];
    state.missingTags = [];
    state.unusedTags = [];
    state.scriptOnlyTagKeys = new Set();
    state.usageScanError = null;
    return;
  }
  try {
    state.meta = await getMeta(state.botId);
  } catch {
    state.meta = null;
  }
  if (disposed) return;
  try {
    state.tags = await listBotTags(state.botId);
  } catch {
    state.tags = [];
  }
  if (disposed) return;
  buildMissingTags();
  await buildUnusedTags();
};

const loadContext = async () => {
  if (disposed) return;
  const response = await callBG(MessageType.GET_CONTEXT);
  if (disposed) return;
  if (!response.ok || !response.data?.context) return;

  const prevBotId = state.botId;
  const prevMeta = state.meta;
  const prevMode = getCanonicalMode();
  const prevTagsSyncAt = prevMeta?.lastTagsSyncAt ?? null;
  const prevItemsSyncAt = prevMeta?.lastItemsSyncAt ?? null;
  state.botId = response.data.context.botId ?? null;
  state.hasAuth = Boolean(response.data.hasAuth);

  if (state.botId !== prevBotId) {
    state.openGroups = {};
    await loadMetaAndTags();
    renderTags();
  } else if (state.botId) {
    try {
      state.meta = await getMeta(state.botId);
    } catch {
      state.meta = null;
    }
    if (disposed) return;

    const modeChanged = getCanonicalMode() !== prevMode;
    const tagsSyncChanged = (state.meta?.lastTagsSyncAt ?? null) !== prevTagsSyncAt;
    const itemsSyncChanged = (state.meta?.lastItemsSyncAt ?? null) !== prevItemsSyncAt;

    if (tagsSyncChanged) {
      try {
        state.tags = await listBotTags(state.botId);
      } catch {
        state.tags = [];
      }
      if (disposed) return;
      buildMissingTags();
    }
    if (tagsSyncChanged || itemsSyncChanged) {
      await buildUnusedTags();
    }
    if (tagsSyncChanged || itemsSyncChanged || modeChanged) {
      updateStats();
      renderTags();
    }
  }

  updateHeader();
  updateSyncButton();
  updateStatus();
  updateStats();
};

const startSync = async () => {
  if (!state.botId || !state.hasAuth || !getCanonicalMode() || state.syncing) return;
  state.syncing = true;
  state.lastError = null;
  updateSyncButton();
  updateStatus();

  const response = await callBG(MessageType.SYNC_TAGS, { botId: state.botId });
  state.syncing = false;
  if (!response.ok) {
    state.lastError = response.error?.message ?? 'Falha ao sincronizar.';
    updateSyncButton();
    updateStatus();
    return;
  }

  await loadMetaAndTags();
  updateHeader();
  updateStats();
  updateStatus();
  renderTags();
  updateSyncButton();
};

const init = async () => {
  if (els.syncBtn) on(els.syncBtn, 'click', () => startSync());
  initSectionToggles();

  await loadContext();

  updateHeader();
  updateStats();
  updateStatus();
  renderTags();
  updateSyncButton();

  const onMessage = (message) => {
    if (disposed) return;
    if (message?.type === MessageType.CONTEXT_CHANGED) {
      loadContext();
    }
  };
  chrome.runtime.onMessage.addListener(onMessage);
  cleanupFns.push(() => chrome.runtime.onMessage.removeListener(onMessage));

  const intervalId = setInterval(() => loadContext(), 2000);
  cleanupFns.push(() => clearInterval(intervalId));
};

export const screenTags = {
  id: 'tags',
  title: 'TAGs',
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
