import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
  createMethodSelect,
  createRow,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

export const apiV2FilterConfig = {
  type: 'ApiV2',
  label: 'API v2',
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
        placeholder: 'Ex: SuccessAPI',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Requisição'));
    container.appendChild(
      createTextInput({
        label: 'URL endpoint',
        key: 'urlEndpoint',
        placeholder: 'Ex: /bot/integrator-server/change-service',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createMethodSelect({
        label: 'Método HTTP',
        key: 'methodType',
        state,
        onChange,
      }),
    );
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
        label: 'JSON payload',
        key: 'jsonPayload',
        placeholder: 'Buscar no payload',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Headers'));
    container.appendChild(
      createTextInput({
        label: 'Header (chave/valor)',
        key: 'headers',
        placeholder: 'Ex: Authorization',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Variáveis'));
    container.appendChild(
      createTextInput({
        label: 'Variável',
        key: 'variableName',
        placeholder: 'Ex: SuccessAPI',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor',
        key: 'variableValue',
        placeholder: 'Ex: isSuccess',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Resposta'));
    container.appendChild(
      createBooleanSelect({
        label: 'Aguardar resposta da API',
        key: 'waitResponse',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Timeout (milissegundos)',
        key: 'timeout',
        placeholder: 'Ex: 60000',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Mensagem durante processamento',
        key: 'waitingResponseMessage',
        placeholder: 'Ex: aguarde...',
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
      matchText('urlEndpoint', state.urlEndpoint) &&
      matchTextAny(['methodType', 'method', 'httpMethod'], state.methodType) &&
      matchText('jsonPayload', state.jsonPayload) &&
      matchTextAny(['headers', 'headers.key', 'headers.value'], state.headers) &&
      matchTextAny(['apiV2Variables.variable', 'apiV2Variables.name', 'apiV2Variables.key'], state.variableName) &&
      matchTextAny(['apiV2Variables.value', 'apiV2Variables.result'], state.variableValue) &&
      matchBoolean('waitResponse', state.waitResponse) &&
      matchText('timeout', state.timeout) &&
      matchText('waitingResponseMessage', state.waitingResponseMessage) &&
      matchText('conditionEscape', state.conditionEscape) &&
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint) &&
      matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText)
    );
  },
};
