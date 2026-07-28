import {
  createBooleanSelect,
  createConditionalTypeSelect,
  createDivider,
  createMatchHelpers,
  createOperatorSelect,
  createRow,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

export const conditionalFilterConfig = {
  type: 'Conditional',
  label: 'Condicional',
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
    container.appendChild(createSectionTitle('Condicionais'));
    container.appendChild(
      createConditionalTypeSelect({
        label: 'Tipo de condicional',
        key: 'conditionType',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createOperatorSelect({
        label: 'Se (operador)',
        key: 'operator',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor',
        key: 'value',
        placeholder: 'Ex: 1',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Bloco de destino (ID)',
        key: 'destination',
        placeholder: 'Ex: 68b8518d4f4dc60c37ef84b1',
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
      matchTextAny(
        ['conditions.type', 'conditions.context', 'conditionType'],
        state.conditionType,
      ) &&
      matchTextAny(
        ['conditions.operator', 'conditions.rule', 'operator'],
        state.operator,
      ) &&
      matchTextAny(['conditions.value', 'value'], state.value) &&
      matchTextAny(
        [
          'conditions.destination',
          'destination',
          'conditions.destinationId',
          'destinationId',
        ],
        state.destination,
      ) &&
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint) &&
      matchText('errorMessageFinal', state.errorMessageFinal) &&
      matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText)
    );
  },
};
