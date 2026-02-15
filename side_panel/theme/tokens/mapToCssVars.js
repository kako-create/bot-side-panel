const setCssVar = (rootStyle, name, value) => {
  if (!value) return;
  rootStyle.setProperty(name, String(value));
};

export const mapToCssVars = (rootStyle, vars = {}) => {
  if (!rootStyle || !vars) return;
  for (const [name, value] of Object.entries(vars)) {
    setCssVar(rootStyle, name, value);
  }
};

