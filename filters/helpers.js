export const createRow = (labelText) => {
  const row = document.createElement('div');
  row.className = 'filter-specific-row';
  const label = document.createElement('label');
  label.textContent = labelText;
  row.appendChild(label);
  return { row, label };
};

export const createSectionTitle = (text) => {
  const title = document.createElement('div');
  title.className = 'filter-specific-section-title';
  title.textContent = text;
  return title;
};

export const createDivider = () => {
  const divider = document.createElement('div');
  divider.className = 'filter-specific-divider';
  return divider;
};

const normalizeTextFilterState = (raw) => {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const value = raw.value == null ? '' : String(raw.value);
    const blank = Boolean(raw.blank);
    return { value, blank };
  }
  return { value: raw == null ? '' : String(raw), blank: false };
};

export const createTextInput = ({ label, key, placeholder, state, onChange, allowBlank = true }) => {
  const { row } = createRow(label);

  const normalized = normalizeTextFilterState(state?.[key]);

  const wrap = document.createElement('div');
  wrap.className = 'filter-specific-text';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder || '';
  input.value = normalized.value;
  wrap.appendChild(input);

  let blankCheckbox = null;
  if (allowBlank) {
    const blankLabel = document.createElement('label');
    blankLabel.className = 'checkbox filter-specific-blank';

    blankCheckbox = document.createElement('input');
    blankCheckbox.type = 'checkbox';
    blankCheckbox.checked = Boolean(normalized.blank);
    blankLabel.appendChild(blankCheckbox);
    blankLabel.appendChild(document.createTextNode('Em branco'));
    wrap.appendChild(blankLabel);

    input.disabled = blankCheckbox.checked;

    blankCheckbox.addEventListener('change', () => {
      input.disabled = blankCheckbox.checked;
      const value = {
        value: input.value,
        blank: blankCheckbox.checked,
      };
      const autoEnable = value.blank || String(value.value || '').trim().length > 0;
      onChange(key, value, autoEnable);
    });
  }

  input.addEventListener('input', () => {
    const value = allowBlank
      ? {
          value: input.value,
          blank: Boolean(blankCheckbox?.checked),
        }
      : input.value;
    const autoEnable =
      typeof value === 'string'
        ? String(value || '').trim().length > 0
        : Boolean(value.blank) || String(value.value || '').trim().length > 0;
    onChange(key, value, autoEnable);
  });

  row.appendChild(wrap);
  return row;
};

export const createBooleanSelect = ({ label, key, state, onChange }) => {
  const { row } = createRow(label);
  const select = document.createElement('select');
  select.innerHTML = `
    <option value="">Qualquer</option>
    <option value="true">Sim</option>
    <option value="false">Não</option>
  `;
  select.value = state[key] ?? '';
  select.addEventListener('change', () => onChange(key, select.value, select.value.length > 0));
  row.appendChild(select);
  return row;
};

export const createMethodSelect = ({ label, key, state, onChange }) => {
  const { row } = createRow(label);
  const select = document.createElement('select');
  select.innerHTML = `
    <option value="">Qualquer</option>
    <option value="GET">GET</option>
    <option value="POST">POST</option>
    <option value="PUT">PUT</option>
    <option value="PATCH">PATCH</option>
    <option value="DELETE">DELETE</option>
    <option value="OPTIONS">OPTIONS</option>
    <option value="HEAD">HEAD</option>
  `;
  select.value = state[key] ?? '';
  select.addEventListener('change', () => onChange(key, select.value, select.value.length > 0));
  row.appendChild(select);
  return row;
};

export const createValidationSelect = ({ label, key, state, onChange }) => {
  const { row } = createRow(label);
  const select = document.createElement('select');
  select.innerHTML = `
    <option value="">Qualquer</option>
    <option value="any">Qualquer texto</option>
    <option value="dynamic_buttons">Exibir botões dinâmicos</option>
  `;
  select.value = state[key] ?? '';
  select.addEventListener('change', () => onChange(key, select.value, select.value.length > 0));
  row.appendChild(select);
  return row;
};

export const createConditionalTypeSelect = ({ label, key, state, onChange }) => {
  const { row } = createRow(label);
  const select = document.createElement('select');
  select.innerHTML = `
    <option value="">Qualquer</option>
    <option value="last_response">Última resposta</option>
    <option value="variable">Variável do fluxo</option>
  `;
  select.value = state[key] ?? '';
  select.addEventListener('change', () => onChange(key, select.value, select.value.length > 0));
  row.appendChild(select);
  return row;
};

export const createOperatorSelect = ({ label, key, state, onChange }) => {
  const { row } = createRow(label);
  const select = document.createElement('select');
  select.innerHTML = `
    <option value="">Qualquer</option>
    <option value="eq">é igual (==)</option>
    <option value="neq">é diferente (!=)</option>
    <option value="contains">contém</option>
    <option value="not_contains">não contém</option>
    <option value="gt">maior que</option>
    <option value="gte">maior ou igual</option>
    <option value="lt">menor que</option>
    <option value="lte">menor ou igual</option>
  `;
  select.value = state[key] ?? '';
  select.addEventListener('change', () => onChange(key, select.value, select.value.length > 0));
  row.appendChild(select);
  return row;
};

export const createMatchHelpers = (item, helpers) => {
  const normalizeTextFilter = (raw) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return { value: raw.value == null ? '' : String(raw.value), blank: Boolean(raw.blank) };
    }
    return { value: raw == null ? '' : String(raw), blank: false };
  };

  const unwrapFilterValue = (raw) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      if (raw.blank) return null;
      return raw.value;
    }
    return raw;
  };

  const isBlankText = (value) => String(value ?? '').trim().length === 0;

  const matchBlank = (path) => {
    const fieldValue = helpers.getItemFieldValue(item, path);
    return isBlankText(fieldValue);
  };

  const matchContains = (path, needle) => {
    if (!needle) return true;
    const fieldValue = helpers.getItemFieldValue(item, path).toLowerCase();
    return fieldValue.includes(String(needle).toLowerCase());
  };

  const matchText = (path, value) => {
    const filter = normalizeTextFilter(value);
    if (filter.blank) return matchBlank(path);
    const needle = String(filter.value ?? '').trim();
    if (!needle) return true;
    return matchContains(path, needle);
  };

  const matchTextAny = (paths, value) => {
    if (!Array.isArray(paths) || paths.length === 0) return true;

    const filter = normalizeTextFilter(value);
    const needle = String(filter.value ?? '').trim();
    if (!needle && !filter.blank) return true;

    // For "blank", all candidates must be blank (keys are alternatives for the same concept).
    if (filter.blank) {
      return paths.every((path) => matchBlank(path));
    }

    return paths.some((path) => matchContains(path, needle));
  };

  const normalizeToken = (value) =>
    String(unwrapFilterValue(value) ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');

  const matchOptionAny = (paths, value) => {
    if (!value) return true;
    if (!Array.isArray(paths) || paths.length === 0) return true;
    const normalizedValue = normalizeToken(value);
    if (!normalizedValue) return true;
    return paths.some((path) => {
      const fieldValue = helpers.getItemFieldValue(item, path);
      const normalizedField = normalizeToken(fieldValue);
      return normalizedField.includes(normalizedValue);
    });
  };

  const matchItemToken = (value) => {
    // If the filter is explicitly "blank", token matching would be too loose.
    if (value && typeof value === 'object' && !Array.isArray(value) && value.blank) return false;

    const unwrapped = unwrapFilterValue(value);
    if (unwrapped === null || unwrapped === undefined) return true;

    const normalizedValue = normalizeToken(unwrapped);
    if (!normalizedValue) return true;
    try {
      const normalizedItem = normalizeToken(JSON.stringify(item));
      return normalizedItem.includes(normalizedValue);
    } catch {
      return false;
    }
  };

  const trueValues = ['true', '1', 'yes', 'y', 'on'];
  const falseValues = ['false', '0', 'no', 'n', 'off', '', 'null', 'undefined'];

  const isTrueValue = (path) => {
    const fieldValue = helpers.getItemFieldValue(item, path).toLowerCase().trim();
    return trueValues.includes(fieldValue);
  };

  const matchBoolean = (path, value) => {
    if (value !== 'true' && value !== 'false') return true;
    const fieldValue = helpers.getItemFieldValue(item, path).toLowerCase().trim();
    const isTrue = trueValues.includes(fieldValue);
    if (value === 'true') return isTrue;
    return falseValues.includes(fieldValue) || !isTrue;
  };

  const matchBooleanAny = (paths, value) => {
    if (!Array.isArray(paths) || paths.length === 0) return true;
    if (value !== 'true' && value !== 'false') return true;
    if (value === 'true') {
      return paths.some((path) => isTrueValue(path));
    }
    return paths.every((path) => !isTrueValue(path));
  };

  return {
    matchText,
    matchTextAny,
    matchBoolean,
    matchBooleanAny,
    matchOptionAny,
    matchItemToken,
    normalizeToken,
    isTrueValue,
  };
};
