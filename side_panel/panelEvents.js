// Nomes canonicos de eventos usados para comunicacao interna do painel.
//
// Sao `CustomEvent`s disparados no `window` pelo runtime do side panel e
// consumidos pelas telas/bootstrap do app.

export const PANEL_EVENTS = Object.freeze({
  SETTINGS_CHANGED: 'bot-sp:settings-changed',
  NAVIGATE: 'bot-sp:navigate',
});
