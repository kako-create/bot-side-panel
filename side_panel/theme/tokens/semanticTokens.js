// Lista canonica de tokens semanticos usados pelo side panel.
//
// Importante:
// - Este modulo e documentacao + "fonte da verdade" para refatoracoes futuras.
// - Mantemos intencionalmente os nomes atuais das variaveis CSS (sem renomear por enquanto).

export const SEMANTIC_TOKENS = Object.freeze({
  colorBg: '--color-bg',
  colorSurface: '--color-surface',
  colorSurface2: '--color-surface-2',
  colorText: '--color-text',
  colorTextMuted: '--color-text-muted',
  colorBorder: '--color-border',
  colorDanger: '--color-danger',
  shadow: '--shadow',

  colorPrimary: '--color-primary',
  colorPrimaryHover: '--color-primary-hover',
  colorPrimaryActive: '--color-primary-active',

  colorAccent: '--color-accent',
  colorAccentHover: '--color-accent-hover',
  colorHighlight: '--color-highlight',

  themeGradient: '--theme-gradient',
  themePattern: '--theme-pattern',
});

export const THEME_CSS_VARS = Object.freeze(Object.values(SEMANTIC_TOKENS));
