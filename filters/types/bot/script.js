import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

export const scriptFilterConfig = {
  type: 'Script',
  label: 'Script',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createBooleanSelect({
        label: 'Acesso rápido',
        key: 'quickAccess',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Checkpoint',
        key: 'checkpoint',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Tags'));
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: TagErroMenu',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Script'));
    container.appendChild(
      createTextInput({
        label: 'Tempo de digitação (segundos)',
        key: 'timeTypping',
        placeholder: 'Ex: 5',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Código do script (buscar)',
        key: 'scriptCode',
        placeholder: 'Ex: tag =',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Escape'));
    container.appendChild(
      createBooleanSelect({
        label: 'Ativar último checkpoint',
        key: 'redirectToCheckpoint',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Mensagem de finalização',
        key: 'errorMessageFinal',
        placeholder: 'Ex: mensagem final',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Bloco de destino (ID)',
        key: 'escapeDestination',
        placeholder: 'Ex: 68b8518d4f4dc60c37ef84b1',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Descrição do evento'));
    container.appendChild(
      createBooleanSelect({
        label: 'Adicionar descrição de evento',
        key: 'eventDescriptionActive',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Descrição do evento',
        key: 'eventDescriptionText',
        placeholder: 'Ex: evento descrito',
        state,
        onChange,
      }),
    );
  },
  match: (item, state, helpers) => {
    const { matchBoolean, matchBooleanAny, matchText } = createMatchHelpers(item, helpers);

    return (
      matchBoolean('quickAccess', state.quickAccess) &&
      matchBoolean('checkpoint', state.checkpoint) &&
      matchText('tags', state.tags) &&
      matchText('timeTypping', state.timeTypping) &&
      matchText('scriptCode', state.scriptCode) &&
      matchText('script', state.scriptCode) &&
      matchText('code', state.scriptCode) &&
      matchText('data.scriptCode', state.scriptCode) &&
      matchText('config.scriptCode', state.scriptCode) &&
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint) &&
      matchText('errorMessageFinal', state.errorMessageFinal) &&
      matchText('escape.errorMessageFinal', state.errorMessageFinal) &&
      matchText('escape.message', state.errorMessageFinal) &&
      matchText('escape.text', state.errorMessageFinal) &&
      matchText('escapeDestination', state.escapeDestination) &&
      matchText('escape.destination', state.escapeDestination) &&
      matchText('escape.destinationId', state.escapeDestination) &&
      matchText('escape.item', state.escapeDestination) &&
      matchText('escape.itemId', state.escapeDestination) &&
      matchText('redirectTo', state.escapeDestination) &&
      matchText('redirectToItem', state.escapeDestination) &&
      matchText('redirectTo.id', state.escapeDestination) &&
      matchText('redirectTo.item', state.escapeDestination) &&
      matchText('redirectToItemId', state.escapeDestination) &&
      matchText('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText)
    );
  },
};
