export const parseMaybeJson = (value) => {
  if (typeof value !== 'string') {
    return { ok: true, value };
  }
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value };
  }
};

export const renderDiffValue = (value) => {
  if (typeof value !== 'string') {
    return JSON.stringify(value ?? '', null, 2);
  }
  try {
    const parsed = JSON.parse(value);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
};

const buildInlineDiffParts = (oldText, newText) => {
  const oldStr = String(oldText ?? '');
  const newStr = String(newText ?? '');
  const minLen = Math.min(oldStr.length, newStr.length);
  let start = 0;
  while (start < minLen && oldStr[start] === newStr[start]) {
    start += 1;
  }
  let endOld = oldStr.length - 1;
  let endNew = newStr.length - 1;
  while (endOld >= start && endNew >= start && oldStr[endOld] === newStr[endNew]) {
    endOld -= 1;
    endNew -= 1;
  }
  return {
    prefix: oldStr.slice(0, start),
    oldChange: oldStr.slice(start, endOld + 1),
    newChange: newStr.slice(start, endNew + 1),
    suffix: oldStr.slice(endOld + 1),
  };
};

export const appendDiffContent = (pre, text, type, counterpartText) => {
  pre.textContent = '';
  if (!counterpartText) {
    pre.appendChild(document.createTextNode(String(text ?? '')));
    return;
  }
  const parts = buildInlineDiffParts(text, counterpartText);
  pre.appendChild(document.createTextNode(parts.prefix));
  const highlight = document.createElement('span');
  highlight.className = type === 'old' ? 'diff-removed' : 'diff-added';
  highlight.textContent = type === 'old' ? parts.oldChange : parts.newChange;
  if (highlight.textContent) {
    pre.appendChild(highlight);
  }
  pre.appendChild(document.createTextNode(parts.suffix));
};

export const buildKeyDiff = (oldValue, newValue) => {
  if (!oldValue && !newValue) return [];
  if (!oldValue && newValue && typeof newValue === 'object') {
    return Object.keys(newValue)
      .sort()
      .map((key) => ({
        key,
        type: 'added',
        oldValue: undefined,
        newValue: newValue[key],
      }));
  }
  if (oldValue && !newValue && typeof oldValue === 'object') {
    return Object.keys(oldValue)
      .sort()
      .map((key) => ({
        key,
        type: 'removed',
        oldValue: oldValue[key],
        newValue: undefined,
      }));
  }
  if (typeof oldValue !== 'object' || typeof newValue !== 'object') {
    return [
      {
        key: 'value',
        type: oldValue === undefined ? 'added' : newValue === undefined ? 'removed' : 'changed',
        oldValue,
        newValue,
      },
    ];
  }
  const changes = [];
  const keys = new Set([...Object.keys(oldValue), ...Object.keys(newValue)]);
  keys.forEach((key) => {
    const hasOld = Object.prototype.hasOwnProperty.call(oldValue, key);
    const hasNew = Object.prototype.hasOwnProperty.call(newValue, key);
    if (!hasOld && hasNew) {
      changes.push({ key, type: 'added', oldValue: undefined, newValue: newValue[key] });
      return;
    }
    if (hasOld && !hasNew) {
      changes.push({ key, type: 'removed', oldValue: oldValue[key], newValue: undefined });
      return;
    }
    const oldStr = JSON.stringify(oldValue[key]);
    const newStr = JSON.stringify(newValue[key]);
    if (oldStr !== newStr) {
      changes.push({ key, type: 'changed', oldValue: oldValue[key], newValue: newValue[key] });
    }
  });
  return changes.sort((left, right) => left.key.localeCompare(right.key, 'pt-BR'));
};
