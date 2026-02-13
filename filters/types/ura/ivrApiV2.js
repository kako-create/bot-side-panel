import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
  createMethodSelect,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

const withCommonRoots = (paths) =>
  Array.from(
    new Set(
      (paths || []).flatMap((path) => [
        path,
        `data.${path}`,
        `config.${path}`,
      ]),
    ),
  );

const TITLE_PATHS = withCommonRoots(['title', 'name', 'label']);
const TAG_PATHS = withCommonRoots(['tags', 'tags.name', 'tags.label']);
const CUSTOM_STATUS_PATHS = withCommonRoots([
  'customStatus',
  'customizedStatus',
  'statusCustom',
  'status',
]);

const URL_ENDPOINT_PATHS = withCommonRoots([
  'urlEndpoint',
  'url',
  'endpoint',
  'apiUrl',
  'request.url',
]);

const HTTP_METHOD_PATHS = withCommonRoots([
  'methodType',
  'method',
  'httpMethod',
  'request.method',
]);

const HEADER_PATHS = withCommonRoots([
  'headers',
  'headers.key',
  'headers.name',
  'headers.value',
  'customHeaders',
  'customHeaders.key',
  'customHeaders.name',
  'customHeaders.value',
]);

const VARIABLE_ROOT_PATHS = withCommonRoots([
  'variables',
  'apiV2Variables',
  'menuIvrVariables',
]);

const VARIABLE_NAME_PATHS = withCommonRoots([
  'variables.key',
  'variables.variable',
  'variables.name',
  'variables.variableName',
  'apiV2Variables.key',
  'apiV2Variables.variable',
  'apiV2Variables.name',
  'apiV2Variables.variableName',
  'menuIvrVariables.key',
  'menuIvrVariables.variable',
  'menuIvrVariables.name',
  'menuIvrVariables.variableName',
]);

const VARIABLE_VALUE_PATHS = withCommonRoots([
  'variables.value',
  'variables.result',
  'apiV2Variables.value',
  'apiV2Variables.result',
  'menuIvrVariables.value',
  'menuIvrVariables.result',
]);

const JSON_PAYLOAD_PATHS = withCommonRoots([
  'jsonPayload',
  'payload',
  'body',
  'request.payload',
  'request.body',
]);

const PLAY_AUDIO_DURING_API_PATHS = withCommonRoots([
  'playAudioDuringApiExecution',
  'playAudioDuringAPIExecution',
  'playAudioDuringExecution',
  'playBackgroundAudio',
]);

const TIMEOUT_PATHS = withCommonRoots([
  'timeout',
  'timeoutMs',
  'request.timeout',
]);

export const ivrApiV2FilterConfig = {
  type: 'IvrAPIV2',
  label: 'API',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: APIIdentificaClienteCPFCNPJ',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: atendimento',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Status customizado',
        key: 'customStatus',
        placeholder: 'Ex: Ativo',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Requisicao'));
    container.appendChild(
      createTextInput({
        label: 'URL endpoint',
        key: 'urlEndpoint',
        placeholder: 'Ex: /ura/list/client-exists/client-find-cpf',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createMethodSelect({
        label: 'Metodo HTTP',
        key: 'methodType',
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
        placeholder: 'Ex: uuid ou {UUID}',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Variaveis'));
    container.appendChild(
      createTextInput({
        label: 'Variavel',
        key: 'variableName',
        placeholder: 'Ex: {NomeCliente}',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor',
        key: 'variableValue',
        placeholder: 'Ex: responseData.nome',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Execucao'));
    container.appendChild(
      createBooleanSelect({
        label: 'Tocar audio de fundo',
        key: 'playAudioDuringApiExecution',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Timeout (milissegundos)',
        key: 'timeout',
        placeholder: 'Ex: 10000',
        state,
        onChange,
      }),
    );
  },
  match: (item, state, helpers) => {
    const { matchBooleanAny, matchOptionAny, matchTextAny, matchItemToken } = createMatchHelpers(item, helpers);

    const matchLooseText = (paths, value) => {
      if (!value) return true;
      return matchTextAny(paths, value) || matchItemToken(value);
    };

    return (
      matchLooseText(TITLE_PATHS, state.title) &&
      matchLooseText(TAG_PATHS, state.tags) &&
      matchLooseText(CUSTOM_STATUS_PATHS, state.customStatus) &&
      matchLooseText(URL_ENDPOINT_PATHS, state.urlEndpoint) &&
      matchOptionAny(HTTP_METHOD_PATHS, state.methodType) &&
      matchLooseText(JSON_PAYLOAD_PATHS, state.jsonPayload) &&
      matchLooseText(HEADER_PATHS, state.headers) &&
      (matchLooseText(VARIABLE_NAME_PATHS, state.variableName) ||
        matchLooseText(VARIABLE_ROOT_PATHS, state.variableName)) &&
      (matchLooseText(VARIABLE_VALUE_PATHS, state.variableValue) ||
        matchLooseText(VARIABLE_ROOT_PATHS, state.variableValue)) &&
      matchBooleanAny(PLAY_AUDIO_DURING_API_PATHS, state.playAudioDuringApiExecution) &&
      matchLooseText(TIMEOUT_PATHS, state.timeout)
    );
  },
};
