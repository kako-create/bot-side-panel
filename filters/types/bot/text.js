import {
  createBooleanSelect,
  createDivider,
  createValidationSelect,
  createMatchHelpers,
  createRow,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

export const textFilterConfig = {
  type: 'Text',
  label: 'Texto',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createBooleanSelect({
        label: 'IA',
        key: 'useIA',
        state,
        onChange,
      }),
    );
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
    container.appendChild(createSectionTitle('Texto'));
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
        label: 'Mensagem',
        key: 'description',
        placeholder: 'Buscar no texto',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Salvar resposta'));
    container.appendChild(
      createBooleanSelect({
        label: 'Armazenar a resposta',
        key: 'captureAnswer',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável',
        key: 'variable',
        placeholder: 'Ex: RespostaCliente',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createValidationSelect({
        label: 'Validação',
        key: 'validationType',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Validação (regex)',
        key: 'validation',
        placeholder: 'Ex: ^[0-9]+$ ',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Não salvar resposta no histórico',
        key: 'isPrivateResponse',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Comportamento de erro'));
    container.appendChild(
      createTextInput({
        label: 'Mensagem de erro de validação',
        key: 'errorMessage',
        placeholder: 'Ex: mensagem de erro',
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
        label: 'Quantidade máx. de tentativas',
        key: 'maxTries',
        placeholder: 'Ex: 3',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Botões de resposta'));
    container.appendChild(
      createValidationSelect({
        label: 'Exibição de botões',
        key: 'buttonsType',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável de botões',
        key: 'buttonsVariable',
        placeholder: 'Ex: OpcoesResposta',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Ociosidade'));
    container.appendChild(
      createBooleanSelect({
        label: 'Ligar temporizador',
        key: 'idleTimeOn',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Minutos para ativação',
        key: 'idleTimeTimer',
        placeholder: 'Ex: 5',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Selecionar bloco (ID)',
        key: 'idleTimeItem',
        placeholder: 'Ex: 6981dd20f4e7b522571de307',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Rota de fuga'));
    container.appendChild(
      createBooleanSelect({
        label: 'Tempo de inatividade',
        key: 'triggerTime',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Gatilho de texto',
        key: 'triggerMessage',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Mídia de áudio',
        key: 'triggerAudio',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Outras mídias',
        key: 'triggerMedia',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Escape'));
    container.appendChild(
      createTextInput({
        label: 'Rota de fuga (conditionEscape)',
        key: 'conditionEscape',
        placeholder: 'Ex: 68bec9fb478ba1fc4bf91141',
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

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Texto alternativo'));
    container.appendChild(
      createTextInput({
        label: 'Texto alternativo',
        key: 'alternativeText',
        placeholder: 'Ex: Olá! Tudo certo?',
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
    const {
      matchBoolean,
      matchBooleanAny,
      matchItemToken,
      matchOptionAny,
      matchText,
    } = createMatchHelpers(item, helpers);

    return (
      matchBoolean('useIA', state.useIA) &&
      matchBoolean('quickAccess', state.quickAccess) &&
      matchBoolean('checkpoint', state.checkpoint) &&
      matchText('tags', state.tags) &&
      matchText('timeTypping', state.timeTypping) &&
      matchText('description', state.description) &&
      matchText('text', state.description) &&
      matchText('label', state.description) &&
      matchBoolean('captureAnswer', state.captureAnswer) &&
      matchText('variable', state.variable) &&
      matchText('validation', state.validation) &&
      (matchOptionAny(
        [
          'validationType',
          'validation.type',
          'validationType.value',
          'validation.type.value',
          'validation',
          'data.validationType',
          'data.validation.type',
          'data.validationType.value',
          'data.validation.type.value',
          'config.validationType',
          'config.validation.type',
        ],
        state.validationType,
      ) || matchItemToken(state.validationType)) &&
      matchBoolean('isPrivateResponse', state.isPrivateResponse) &&
      matchText('errorMessage', state.errorMessage) &&
      matchText('errorMessageFinal', state.errorMessageFinal) &&
      matchText('maxTries', state.maxTries) &&
      (matchOptionAny(
        [
          'validationType',
          'validation.type',
          'buttons.type',
          'buttons.mode',
          'buttons.display',
          'buttons.type.value',
          'buttons.display.value',
          'data.validationType',
          'data.validation.type',
          'data.buttons.type',
          'data.buttons.mode',
          'data.buttons.display',
          'config.validationType',
          'config.validation.type',
          'config.buttons.type',
        ],
        state.buttonsType,
      ) || matchItemToken(state.buttonsType)) &&
      matchText('buttons.variable', state.buttonsVariable) &&
      matchText('buttons.variableName', state.buttonsVariable) &&
      matchText('buttonsVariable', state.buttonsVariable) &&
      matchText('data.buttons.variable', state.buttonsVariable) &&
      matchText('data.buttons.variableName', state.buttonsVariable) &&
      matchText('config.buttons.variable', state.buttonsVariable) &&
      matchBoolean('idleTime.on', state.idleTimeOn) &&
      matchText('idleTime.timer', state.idleTimeTimer) &&
      matchText('idleTime.item', state.idleTimeItem) &&
      matchBoolean('ignoreTriggers.time', state.triggerTime) &&
      matchBoolean('ignoreTriggers.message', state.triggerMessage) &&
      matchBoolean('ignoreTriggers.audio', state.triggerAudio) &&
      matchBoolean('ignoreTriggers.media', state.triggerMedia) &&
      matchText('conditionEscape', state.conditionEscape) &&
      matchText('alternativeText', state.alternativeText) &&
      matchText('alternativeTexts', state.alternativeText) &&
      matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText) &&
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint)
    );
  },
};
