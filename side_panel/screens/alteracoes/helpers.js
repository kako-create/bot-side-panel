const getItemId = (item) => {
  const raw = item?.itemId ?? item?._id ?? item?.id ?? '';
  return String(raw ?? '').trim();
};

const getItemTitle = (item) =>
  String(
    item?.title ??
      item?.label ??
      item?.name ??
      item?.text ??
      item?.description ??
      item?.type ??
      '',
  ).trim() || 'Sem título';

const getItemDescription = (item) =>
  String(
    item?.description ??
      item?.subtitle ??
      item?.helpText ??
      item?.text ??
      item?.label ??
      item?.name ??
      item?.title ??
      '',
  ).trim();

const toTimestamp = (value) => {
  const ms = new Date(value ?? '').getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const toText = (value) => String(value ?? '').trim();

const getDocTargetId = (doc) => toText(doc?.targetModelId ?? doc?.id ?? doc?._id ?? '');

const getDocApiId = (doc) => toText(doc?._id ?? '');

const getDocDescription = (doc, indexedDescription) =>
  toText(
    indexedDescription ??
      doc?.description ??
      doc?.desc ??
      doc?.text ??
      doc?.content ??
      doc?.message ??
      '',
  );

const getDocTitle = (doc, indexedTitle, description, targetId) =>
  toText(
    indexedTitle ??
      doc?.title ??
      doc?.docTitle ??
      doc?.label ??
      doc?.name ??
      doc?.fieldName ??
      doc?.fieldLabel ??
      doc?.documentTitle ??
      doc?.documentName ??
      doc?.itemTitle ??
      doc?.blockTitle ??
      description ??
      targetId ??
      '',
  ) || 'Sem título';

const getDocType = (doc) =>
  toText(doc?.itemType ?? doc?.type ?? doc?.docType ?? doc?.documentType ?? doc?.blockType ?? '');

const getDocUpdatedAt = (doc) =>
  toText(doc?.when ?? doc?.updatedAt ?? doc?.createdAt ?? doc?.date ?? doc?.timestamp ?? '');

const getDocUserName = (doc) => toText(doc?.userName ?? doc?.user ?? '') || 'Desconhecido';

const getDocAction = (doc) => toText(doc?.action ?? doc?.event ?? '') || 'unknown';

export const buildPendingItemIndex = (items = []) => {
  const index = new Map();
  (Array.isArray(items) ? items : []).forEach((item) => {
    const itemId = getItemId(item);
    if (!itemId || index.has(itemId)) return;
    index.set(itemId, {
      title: getItemTitle(item),
      description: getItemDescription(item),
    });
  });
  return index;
};

export const groupPendingChangesByUserAndAction = (docs, itemIndex = new Map()) => {
  const users = new Map();

  (Array.isArray(docs) ? docs : []).forEach((doc) => {
    const userName = getDocUserName(doc);
    const action = getDocAction(doc);
    const targetId = getDocTargetId(doc);
    const apiId = getDocApiId(doc);
    const indexedItem = targetId ? itemIndex.get(targetId) : null;
    const description = getDocDescription(doc, indexedItem?.description);
    const title = getDocTitle(doc, indexedItem?.title, description, targetId);
    const type = getDocType(doc);
    const updatedAt = getDocUpdatedAt(doc);

    const normalizedDoc = {
      id: targetId,
      apiId,
      title,
      description,
      type,
      updatedAt,
      updatedAtTs: toTimestamp(updatedAt),
    };

    const userKey = `user:${userName}`;
    const actionKey = `${userKey}::action:${action}`;

    if (!users.has(userKey)) {
      users.set(userKey, {
        key: userKey,
        userName,
        count: 0,
        actionsMap: new Map(),
      });
    }

    const userGroup = users.get(userKey);
    if (!userGroup.actionsMap.has(actionKey)) {
      userGroup.actionsMap.set(actionKey, {
        key: actionKey,
        action,
        count: 0,
        docs: [],
      });
    }

    const actionGroup = userGroup.actionsMap.get(actionKey);
    actionGroup.docs.push(normalizedDoc);
    actionGroup.count += 1;
    userGroup.count += 1;
  });

  return Array.from(users.values())
    .map((userGroup) => {
      const actions = Array.from(userGroup.actionsMap.values())
        .map((actionGroup) => ({
          ...actionGroup,
          docs: actionGroup.docs
            .slice()
            .sort((left, right) => {
              const tsDiff = right.updatedAtTs - left.updatedAtTs;
              if (tsDiff !== 0) return tsDiff;
              return left.title.localeCompare(right.title, 'pt-BR');
            }),
        }))
        .sort((left, right) => left.action.localeCompare(right.action, 'pt-BR'));

      return {
        key: userGroup.key,
        userName: userGroup.userName,
        count: userGroup.count,
        actions,
      };
    })
    .sort((left, right) => left.userName.localeCompare(right.userName, 'pt-BR'));
};

export const countPendingActionGroups = (groupedChanges) =>
  (Array.isArray(groupedChanges) ? groupedChanges : []).reduce(
    (acc, userGroup) => acc + (Array.isArray(userGroup?.actions) ? userGroup.actions.length : 0),
    0,
  );
