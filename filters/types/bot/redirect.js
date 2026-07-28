import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

export const redirectFilterConfig = {
  type: 'Redirect',
  label: 'Direcionador',
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
    container.appendChild(createSectionTitle('Direcionador'));
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
      createBooleanSelect({
        label: 'Ativar último checkpoint',
        key: 'redirectToCheckpoint',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Bloco de destino (ID)',
        key: 'redirectTo',
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
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint) &&
      matchTextAny(
        [
          'redirectTo',
          'redirectToItem',
          'redirectTo.id',
          'redirectTo.item',
          'redirectTo.itemId',
          'redirectToItemId',
        ],
        state.redirectTo,
      ) &&
      matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText)
    );
  },
};
