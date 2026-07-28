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
    const { matchBoolean, matchBooleanAny, matchText, matchTextAny } = createMatchHelpers(
      item,
      helpers,
    );

    return (
      matchBoolean('quickAccess', state.quickAccess) &&
      matchBoolean('checkpoint', state.checkpoint) &&
      matchText('tags', state.tags) &&
      matchText('timeTypping', state.timeTypping) &&
      matchTextAny(
        ['scriptCode', 'script', 'code', 'data.scriptCode', 'config.scriptCode'],
        state.scriptCode,
      ) &&
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint) &&
      matchTextAny(
        ['errorMessageFinal', 'escape.errorMessageFinal', 'escape.message', 'escape.text'],
        state.errorMessageFinal,
      ) &&
      matchTextAny(
        [
          'escapeDestination',
          'escape.destination',
          'escape.destinationId',
          'escape.item',
          'escape.itemId',
          'redirectTo',
          'redirectToItem',
          'redirectTo.id',
          'redirectTo.item',
          'redirectToItemId',
        ],
        state.escapeDestination,
      ) &&
      matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText)
    );
  },
};
