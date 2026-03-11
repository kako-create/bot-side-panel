import { normalizeText } from '../shared/utils.js';

const DB_NAME = 'bot_side_panel_db_v1';
const DB_VERSION = 7;

const STORE_META = 'meta';
const STORE_GROUPS = 'groups';
const STORE_SUMMARY = 'summary_items';
const STORE_FULL = 'full_items';
const STORE_VARIABLES = 'bot_variables';
const STORE_TAGS = 'bot_tags';
const STORE_INTENTS = 'bot_intents';
const STORE_LEX_INTENTS = 'bot_lex_intents';
const STORE_DEBUG = 'debug_network_logs';
const STORE_TECH_REVIEW = 'tech_review_snapshots';

const TECH_REVIEW_META_RECORD_KEY = '__meta__';
const TECH_REVIEW_KIND_META = 'meta';
const TECH_REVIEW_KIND_ITEM = 'item';

let dbPromise = null;

const openDb = () => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const idbFactory = globalThis.indexedDB || (typeof self !== 'undefined' ? self.indexedDB : null);
      if (!idbFactory) {
        reject(new Error('IndexedDB indisponível neste contexto.'));
        return;
      }
      const request = idbFactory.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'botId' });
        }
        if (!db.objectStoreNames.contains(STORE_GROUPS)) {
          const store = db.createObjectStore(STORE_GROUPS, { keyPath: ['botId', 'groupId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_level', ['botId', 'level'], { unique: false });
          store.createIndex('by_bot_title', ['botId', 'titleFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SUMMARY)) {
          const store = db.createObjectStore(STORE_SUMMARY, { keyPath: ['botId', 'itemId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_group', ['botId', 'groupId'], { unique: false });
          store.createIndex('by_bot_group_type', ['botId', 'groupId', 'typeFold'], { unique: false });
          store.createIndex('by_bot_type', ['botId', 'typeFold'], { unique: false });
          store.createIndex('by_bot_title', ['botId', 'titleFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_FULL)) {
          const store = db.createObjectStore(STORE_FULL, { keyPath: ['botId', 'itemId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_group', ['botId', 'groupId'], { unique: false });
          store.createIndex('by_bot_type', ['botId', 'typeFold'], { unique: false });
          store.createIndex('by_bot_title', ['botId', 'titleFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_VARIABLES)) {
          const store = db.createObjectStore(STORE_VARIABLES, { keyPath: ['botId', 'varId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_group', ['botId', 'groupFold'], { unique: false });
          store.createIndex('by_bot_label', ['botId', 'labelFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TAGS)) {
          const store = db.createObjectStore(STORE_TAGS, { keyPath: ['botId', 'tagId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_label', ['botId', 'labelFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_INTENTS)) {
          const store = db.createObjectStore(STORE_INTENTS, { keyPath: ['botId', 'intentId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_group', ['botId', 'groupFold'], { unique: false });
          store.createIndex('by_bot_label', ['botId', 'labelFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_LEX_INTENTS)) {
          const store = db.createObjectStore(STORE_LEX_INTENTS, { keyPath: ['botId', 'intentId'] });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_label', ['botId', 'labelFold'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_DEBUG)) {
          const store = db.createObjectStore(STORE_DEBUG, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_created_at', 'createdAt', { unique: false });
          store.createIndex('by_kind', 'kind', { unique: false });
          store.createIndex('by_url', 'url', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_TECH_REVIEW)) {
          const store = db.createObjectStore(STORE_TECH_REVIEW, {
            keyPath: ['botId', 'snapshotId', 'recordKey'],
          });
          store.createIndex('by_bot', 'botId', { unique: false });
          store.createIndex('by_bot_kind', ['botId', 'kind'], { unique: false });
          store.createIndex('by_bot_snapshot', ['botId', 'snapshotId'], { unique: false });
          store.createIndex('by_bot_snapshot_kind', ['botId', 'snapshotId', 'kind'], { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('IDB_OPEN_ERROR'));
    } catch (error) {
      reject(error);
    }
  });
  return dbPromise;
};

const deleteByIndex = async (db, storeName, indexName, key) =>
  new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const range = IDBKeyRange.only(key);
    const req = index.openCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve();
        return;
      }
      cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error || new Error('IDB_CURSOR_ERROR'));
  });

const withStore = async (storeName, mode, callback) => {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store, tx);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error || new Error('IDB_TX_ERROR'));
    tx.onabort = () => reject(tx.error || new Error('IDB_TX_ABORT'));
  });
};

const cursorToArray = (request) =>
  new Promise((resolve, reject) => {
    const out = [];
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        out.push(cursor.value);
        cursor.continue();
        return;
      }
      resolve(out);
    };
    request.onerror = () => reject(request.error || new Error('IDB_CURSOR_ERROR'));
  });

export const saveMeta = async (meta) =>
  withStore(STORE_META, 'readwrite', (store) => {
    store.put(meta);
  });

export const getMeta = async (botId) =>
  withStore(STORE_META, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const req = store.get(botId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IDB_GET_ERROR'));
    }),
  );

export const listMetas = async () =>
  withStore(STORE_META, 'readonly', (store) => cursorToArray(store.openCursor()));

export const saveGroups = async (botId, groups) =>
  withStore(STORE_GROUPS, 'readwrite', (store) => {
    for (const group of groups) {
      store.put({ ...group, botId });
    }
  });

export const saveSummaryItems = async (botId, items) =>
  withStore(STORE_SUMMARY, 'readwrite', (store) => {
    for (const item of items) {
      store.put({ ...item, botId });
    }
  });

export const saveFullItems = async (botId, items) =>
  withStore(STORE_FULL, 'readwrite', (store) => {
    for (const item of items) {
      store.put({ ...item, botId });
    }
  });

export const saveBotVariables = async (botId, variables) =>
  withStore(STORE_VARIABLES, 'readwrite', (store) => {
    for (const variable of variables) {
      store.put({ ...variable, botId });
    }
  });

export const saveBotTags = async (botId, tags) =>
  withStore(STORE_TAGS, 'readwrite', (store) => {
    for (const tag of tags) {
      store.put({ ...tag, botId });
    }
  });

export const saveBotIntents = async (botId, intents) =>
  withStore(STORE_INTENTS, 'readwrite', (store) => {
    for (const intent of intents) {
      store.put({ ...intent, botId });
    }
  });

export const saveBotLexIntents = async (botId, intents) =>
  withStore(STORE_LEX_INTENTS, 'readwrite', (store) => {
    for (const intent of intents) {
      store.put({ ...intent, botId });
    }
  });

export const getGroupsByBot = async (botId) =>
  withStore(STORE_GROUPS, 'readonly', (store) => {
    const index = store.index('by_bot');
    return cursorToArray(index.openCursor(IDBKeyRange.only(botId)));
  });

export const listBotVariables = async (botId) =>
  withStore(STORE_VARIABLES, 'readonly', (store) => {
    const index = store.index('by_bot');
    return cursorToArray(index.openCursor(IDBKeyRange.only(botId)));
  });

export const listBotTags = async (botId) =>
  withStore(STORE_TAGS, 'readonly', (store) => {
    const index = store.index('by_bot');
    return cursorToArray(index.openCursor(IDBKeyRange.only(botId)));
  });

export const listBotIntents = async (botId) =>
  withStore(STORE_INTENTS, 'readonly', (store) => {
    const index = store.index('by_bot');
    return cursorToArray(index.openCursor(IDBKeyRange.only(botId)));
  });

export const listBotLexIntents = async (botId) =>
  withStore(STORE_LEX_INTENTS, 'readonly', (store) => {
    const index = store.index('by_bot');
    return cursorToArray(index.openCursor(IDBKeyRange.only(botId)));
  });

export const searchFullItems = async (
  botId,
  { type, query, deep = false, limit = 1000, filterFn } = {},
) => {
  const typeFold = type ? normalizeText(type) : null;
  const queryFold = normalizeText(query);
  return withStore(STORE_FULL, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const results = [];
      const index = typeFold ? store.index('by_bot_type') : store.index('by_bot');
      const range = typeFold ? IDBKeyRange.only([botId, typeFold]) : IDBKeyRange.only(botId);

      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        const value = cursor.value;
        if (queryFold) {
          const titleMatch = value.titleFold?.includes(queryFold);
          let deepMatch = false;
          if (!titleMatch && deep) {
            try {
              const json = JSON.stringify(value.payload ?? {});
              deepMatch = normalizeText(json).includes(queryFold);
            } catch {
              deepMatch = false;
            }
          }
          if (!titleMatch && !deepMatch) {
            cursor.continue();
            return;
          }
        }
        if (typeof filterFn === 'function') {
          let matched = false;
          try {
            matched = Boolean(filterFn(value));
          } catch {
            matched = false;
          }
          if (!matched) {
            cursor.continue();
            return;
          }
        }
        results.push(value);
        if (limit && results.length >= limit) {
          resolve(results);
          return;
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('IDB_CURSOR_ERROR'));
    }),
  );
};

export const getFullItemById = async (botId, itemId) => {
  const resolvedBotId = String(botId ?? '').trim();
  const resolvedItemId = String(itemId ?? '').trim();
  if (!resolvedBotId || !resolvedItemId) return null;
  return withStore(STORE_FULL, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const req = store.get([resolvedBotId, resolvedItemId]);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error('IDB_GET_ERROR'));
    }),
  );
};

export const getSummaryItemsByGroup = async (botId, groupId, { type, query, limit } = {}) => {
  const typeFold = type ? normalizeText(type) : null;
  const queryFold = normalizeText(query);
  return withStore(STORE_SUMMARY, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const results = [];
      const index = typeFold ? store.index('by_bot_group_type') : store.index('by_bot_group');
      const range = typeFold
        ? IDBKeyRange.only([botId, groupId, typeFold])
        : IDBKeyRange.only([botId, groupId]);

      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        const value = cursor.value;
        if (queryFold) {
          const titleMatch = value.titleFold?.includes(queryFold);
          const typeMatch = value.typeFold?.includes(queryFold);
          if (!(titleMatch || typeMatch)) {
            cursor.continue();
            return;
          }
        }
        results.push(value);
        if (limit && results.length >= limit) {
          resolve(results);
          return;
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('IDB_CURSOR_ERROR'));
    }),
  );
};

export const countSummaryItemsByGroup = async (botId, groupId, { type, query } = {}) => {
  const typeFold = type ? normalizeText(type) : null;
  const queryFold = normalizeText(query);
  return withStore(STORE_SUMMARY, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      let count = 0;
      const index = typeFold ? store.index('by_bot_group_type') : store.index('by_bot_group');
      const range = typeFold
        ? IDBKeyRange.only([botId, groupId, typeFold])
        : IDBKeyRange.only([botId, groupId]);

      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(count);
          return;
        }
        const value = cursor.value;
        if (queryFold) {
          const titleMatch = value.titleFold?.includes(queryFold);
          const typeMatch = value.typeFold?.includes(queryFold);
          if (!(titleMatch || typeMatch)) {
            cursor.continue();
            return;
          }
        }
        count += 1;
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('IDB_CURSOR_ERROR'));
    }),
  );
};

export const clearSummaryData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_GROUPS, 'by_bot', botId);
  await deleteByIndex(db, STORE_SUMMARY, 'by_bot', botId);
};

export const clearFullData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_FULL, 'by_bot', botId);
};

export const clearVariablesData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_VARIABLES, 'by_bot', botId);
};

export const clearTagsData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_TAGS, 'by_bot', botId);
};

export const clearIntentsData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_INTENTS, 'by_bot', botId);
};

export const clearLexIntentsData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_LEX_INTENTS, 'by_bot', botId);
};

const stripTechReviewRecord = (record) => {
  if (!record || typeof record !== 'object') return record;
  const { recordKey, kind, ...rest } = record;
  return rest;
};

export const saveTechReviewSnapshot = async (
  botId,
  { snapshotId = crypto.randomUUID(), meta = {}, items = [] } = {},
) => {
  const resolvedBotId = String(botId ?? '').trim();
  const resolvedSnapshotId = String(snapshotId ?? '').trim() || crypto.randomUUID();
  if (!resolvedBotId) throw new Error('botId ausente para salvar snapshot técnico.');

  const createdAt = meta?.createdAt ? String(meta.createdAt) : new Date().toISOString();
  const itemsCount = Number(meta?.itemsCount);
  const bytes = Number(meta?.bytes);
  const blocksCount = Number(meta?.blocksCount);
  const variablesCount = Number(meta?.variablesCount);
  const tagsCount = Number(meta?.tagsCount);

  return withStore(STORE_TECH_REVIEW, 'readwrite', (store) => {
    store.put({
      botId: resolvedBotId,
      snapshotId: resolvedSnapshotId,
      recordKey: TECH_REVIEW_META_RECORD_KEY,
      kind: TECH_REVIEW_KIND_META,
      createdAt,
      botTitle: meta?.botTitle ? String(meta.botTitle) : null,
      mode: meta?.mode ? String(meta.mode) : null,
      label: meta?.label ? String(meta.label) : null,
      itemsCount: Number.isFinite(itemsCount) ? itemsCount : (Array.isArray(items) ? items.length : 0),
      bytes: Number.isFinite(bytes) ? bytes : 0,
      blocksCount: Number.isFinite(blocksCount) ? blocksCount : null,
      variablesCount: Number.isFinite(variablesCount) ? variablesCount : null,
      tagsCount: Number.isFinite(tagsCount) ? tagsCount : null,
      sourceLastItemsSyncAt: meta?.sourceLastItemsSyncAt ? String(meta.sourceLastItemsSyncAt) : null,
      sourceLastSummarySyncAt: meta?.sourceLastSummarySyncAt ? String(meta.sourceLastSummarySyncAt) : null,
    });

    (Array.isArray(items) ? items : []).forEach((item, index) => {
      const baseKey = String(item?.itemId ?? '').trim() || crypto.randomUUID();
      store.put({
        ...item,
        botId: resolvedBotId,
        snapshotId: resolvedSnapshotId,
        recordKey: `item:${baseKey}:${index}`,
        kind: TECH_REVIEW_KIND_ITEM,
      });
    });
  });
};

export const listTechReviewSnapshots = async (botId) => {
  const resolvedBotId = String(botId ?? '').trim();
  if (!resolvedBotId) return [];
  return withStore(STORE_TECH_REVIEW, 'readonly', (store) => {
    const index = store.index('by_bot_kind');
    return cursorToArray(index.openCursor(IDBKeyRange.only([resolvedBotId, TECH_REVIEW_KIND_META]))).then((rows) =>
      rows
        .map((row) => stripTechReviewRecord(row))
        .sort((a, b) => new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime()),
    );
  });
};

export const getTechReviewSnapshotMeta = async (botId, snapshotId) => {
  const resolvedBotId = String(botId ?? '').trim();
  const resolvedSnapshotId = String(snapshotId ?? '').trim();
  if (!resolvedBotId || !resolvedSnapshotId) return null;
  return withStore(STORE_TECH_REVIEW, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const req = store.get([resolvedBotId, resolvedSnapshotId, TECH_REVIEW_META_RECORD_KEY]);
      req.onsuccess = () => resolve(stripTechReviewRecord(req.result || null));
      req.onerror = () => reject(req.error || new Error('IDB_GET_ERROR'));
    }),
  );
};

export const listTechReviewSnapshotItems = async (botId, snapshotId) => {
  const resolvedBotId = String(botId ?? '').trim();
  const resolvedSnapshotId = String(snapshotId ?? '').trim();
  if (!resolvedBotId || !resolvedSnapshotId) return [];
  return withStore(STORE_TECH_REVIEW, 'readonly', (store) => {
    const index = store.index('by_bot_snapshot_kind');
    return cursorToArray(
      index.openCursor(IDBKeyRange.only([resolvedBotId, resolvedSnapshotId, TECH_REVIEW_KIND_ITEM])),
    ).then((rows) => rows.map((row) => stripTechReviewRecord(row)));
  });
};

export const clearTechReviewSnapshot = async (botId, snapshotId) => {
  const resolvedBotId = String(botId ?? '').trim();
  const resolvedSnapshotId = String(snapshotId ?? '').trim();
  if (!resolvedBotId || !resolvedSnapshotId) return;
  const db = await openDb();
  await deleteByIndex(db, STORE_TECH_REVIEW, 'by_bot_snapshot', [resolvedBotId, resolvedSnapshotId]);
};

export const clearTechReviewSnapshotsByBot = async (botId) => {
  const resolvedBotId = String(botId ?? '').trim();
  if (!resolvedBotId) return;
  const db = await openDb();
  await deleteByIndex(db, STORE_TECH_REVIEW, 'by_bot', resolvedBotId);
};

export const clearBotData = async (botId) => {
  const db = await openDb();
  await deleteByIndex(db, STORE_GROUPS, 'by_bot', botId);
  await deleteByIndex(db, STORE_SUMMARY, 'by_bot', botId);
  await deleteByIndex(db, STORE_FULL, 'by_bot', botId);
  await deleteByIndex(db, STORE_VARIABLES, 'by_bot', botId);
  await deleteByIndex(db, STORE_TAGS, 'by_bot', botId);
  await deleteByIndex(db, STORE_INTENTS, 'by_bot', botId);
  await deleteByIndex(db, STORE_LEX_INTENTS, 'by_bot', botId);
  await deleteByIndex(db, STORE_TECH_REVIEW, 'by_bot', botId);
  await withStore(STORE_META, 'readwrite', (store) => store.delete(botId));
};

export const addDebugLog = async (entry) =>
  withStore(STORE_DEBUG, 'readwrite', (store) => {
    store.add(entry);
  });

export const listDebugLogs = async ({ limit = 0, newestFirst = true } = {}) =>
  withStore(STORE_DEBUG, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const results = [];
      const direction = newestFirst ? 'prev' : 'next';
      const req = store.openCursor(null, direction);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) {
          resolve(results);
          return;
        }
        results.push(cursor.value);
        if (limit && results.length >= limit) {
          resolve(results);
          return;
        }
        cursor.continue();
      };
      req.onerror = () => reject(req.error || new Error('IDB_CURSOR_ERROR'));
    }),
  );

export const clearDebugLogs = async () =>
  withStore(STORE_DEBUG, 'readwrite', (store) => {
    store.clear();
  });

export const countDebugLogs = async () =>
  withStore(STORE_DEBUG, 'readonly', (store) =>
    new Promise((resolve, reject) => {
      const req = store.count();
      req.onsuccess = () => resolve(Number(req.result ?? 0));
      req.onerror = () => reject(req.error || new Error('IDB_COUNT_ERROR'));
    }),
  );

export const buildSummaryItemRecord = (item, { groupId, level } = {}) => {
  const title = item?.title ?? '';
  const type = item?.type ?? '';
  return {
    itemId: item?._id ?? item?.id ?? item?.itemId ?? crypto.randomUUID(),
    title,
    titleFold: normalizeText(title),
    type,
    typeFold: normalizeText(type),
    groupId,
    level: level ?? null,
    subflowFor: item?.subflowFor ?? null,
    positionOnScreen: item?.positionOnScreen ?? null,
  };
};

export const buildFullItemRecord = (item, { groupId } = {}) => {
  const title = item?.title ?? '';
  const type = item?.type ?? '';
  return {
    itemId: item?._id ?? item?.id ?? item?.itemId ?? crypto.randomUUID(),
    title,
    titleFold: normalizeText(title),
    type,
    typeFold: normalizeText(type),
    groupId,
    payload: item ?? null,
  };
};

export const buildVariableRecord = (variable, { groupKey } = {}) => {
  const item = variable && typeof variable === 'object' ? variable : { value: variable };
  const labelRaw =
    item.name ??
    item.key ??
    item.variable ??
    item.title ??
    item.label ??
    item.tag ??
    item.value ??
    item._id ??
    item.id ??
    '';
  const label = String(labelRaw ?? '').trim();
  const rawId = item._id ?? item.id ?? null;
  const baseId = rawId ? String(rawId) : label ? String(label) : null;
  const resolvedGroupKey = groupKey ?? item.__group ?? item.type ?? '';
  const groupMap = {
    local: 'Local',
    bot: 'Bot',
    global: 'Global',
    vtex: 'VTEX',
    ads: 'ADS',
    human: 'Human',
    outros: 'Outros',
  };
  const groupLabel = groupMap[String(resolvedGroupKey).toLowerCase()] ?? String(resolvedGroupKey || 'Outros');
  const labelText = label || 'Sem nome';

  return {
    varId: baseId ? `${resolvedGroupKey || 'outros'}:${baseId}` : crypto.randomUUID(),
    label: labelText,
    labelFold: normalizeText(labelText),
    group: String(resolvedGroupKey || ''),
    groupLabel: groupLabel.trim() || 'Outros',
    groupFold: normalizeText(groupLabel),
    payload: item ?? null,
  };
};

export const buildTagRecord = (tag) => {
  const item = tag && typeof tag === 'object' ? tag : { value: tag };
  const labelRaw =
    item.name ??
    item.key ??
    item.variable ??
    item.title ??
    item.label ??
    item.tag ??
    item.value ??
    item._id ??
    item.id ??
    '';
  const label = String(labelRaw ?? '').trim() || 'Sem nome';
  const rawId = item._id ?? item.id ?? null;
  const baseId = rawId ? String(rawId) : label ? String(label) : null;
  return {
    tagId: baseId ?? crypto.randomUUID(),
    label,
    labelFold: normalizeText(label),
    payload: item ?? null,
  };
};

export const buildIntentRecord = (intent) => {
  const item = intent && typeof intent === 'object' ? intent : { value: intent };
  const labelRaw =
    item.intent ??
    item.name ??
    item.label ??
    item.title ??
    item.value ??
    item._id ??
    item.id ??
    '';
  const label = String(labelRaw ?? '').trim() || 'Sem intenção';
  const rawId = item._id ?? item.id ?? null;
  const destinationId = String(item.destination ?? item.destinationId ?? '').trim();
  const title = String(item.title ?? item.destinationTitle ?? '').trim();
  const type = String(item.type ?? '').trim() || 'Sem tipo';
  const groupLabel = title || destinationId || 'Sem destino';
  const groupKey = `${type}:${groupLabel}`;
  const baseId = rawId ? String(rawId) : `${groupKey}:${label}`;
  const confidence = Number(item.confidence);
  const entity = String(item.entity ?? '').trim();
  const when = item.when ? String(item.when) : null;

  return {
    intentId: baseId || crypto.randomUUID(),
    label,
    labelFold: normalizeText(label),
    group: groupKey,
    groupLabel,
    groupFold: normalizeText(groupLabel),
    type,
    typeFold: normalizeText(type),
    destinationId: destinationId || null,
    confidence: Number.isFinite(confidence) ? confidence : null,
    active: item.active == null ? null : Boolean(item.active),
    entity: entity || null,
    when,
    payload: item ?? null,
  };
};

export const buildLexIntentRecord = (intent) => {
  const item = intent && typeof intent === 'object' ? intent : { value: intent };
  const label = String(item.name ?? item.intent ?? item.label ?? item.value ?? item.id ?? '').trim() || 'Sem nome';
  const rawSamples = Array.isArray(item.samples) ? item.samples : [];
  const samples = rawSamples
    .map((sample) => {
      if (sample && typeof sample === 'object') {
        const text = String(sample.text ?? sample.value ?? '').trim();
        return {
          text,
          entities: Array.isArray(sample.entities) ? sample.entities : [],
          traits: Array.isArray(sample.traits) ? sample.traits : [],
          payload: sample,
        };
      }
      const text = String(sample ?? '').trim();
      return { text, entities: [], traits: [], payload: sample };
    })
    .filter((sample) => sample.text);

  return {
    intentId: String(item.id ?? item.intentId ?? label),
    label,
    labelFold: normalizeText(label),
    qtdSamples: item.qtdSamples == null ? null : String(item.qtdSamples),
    samples,
    samplesCount: samples.length,
    token: item.token == null ? null : String(item.token),
    payload: item ?? null,
  };
};

export const buildGroupRecord = (group, { itemsCount, typeCounts } = {}) => {
  const title = group?.title ?? '';
  return {
    groupId: group?._id ?? group?.id ?? group?.groupId ?? crypto.randomUUID(),
    title,
    titleFold: normalizeText(title),
    level: group?.level ?? null,
    itemsCount: itemsCount ?? 0,
    typeCounts: typeCounts ?? {},
  };
};

export const STORE_NAMES = {
  META: STORE_META,
  GROUPS: STORE_GROUPS,
  SUMMARY: STORE_SUMMARY,
  FULL: STORE_FULL,
  VARIABLES: STORE_VARIABLES,
  TAGS: STORE_TAGS,
  INTENTS: STORE_INTENTS,
  LEX_INTENTS: STORE_LEX_INTENTS,
  DEBUG: STORE_DEBUG,
  TECH_REVIEW: STORE_TECH_REVIEW,
};
