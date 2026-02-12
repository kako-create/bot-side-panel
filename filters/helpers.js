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

export const createTextInput = ({ label, key, placeholder, state, onChange }) => {
  const { row } = createRow(label);
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder || '';
  input.value = state[key] ?? '';
  input.addEventListener('input', () => onChange(key, input.value, input.value.length > 0));
  row.appendChild(input);
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
  const matchText = (path, value) => {
    if (!value) return true;
    const fieldValue = helpers.getItemFieldValue(item, path).toLowerCase();
    return fieldValue.includes(String(value).toLowerCase());
  };

  const matchTextAny = (paths, value) => {
    if (!value) return true;
    if (!Array.isArray(paths) || paths.length === 0) return true;
    return paths.some((path) => matchText(path, value));
  };

  const normalizeToken = (value) =>
    String(value ?? '')
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
    if (!value) return true;
    const normalizedValue = normalizeToken(value);
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
