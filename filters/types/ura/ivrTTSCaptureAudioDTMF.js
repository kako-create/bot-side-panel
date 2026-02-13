import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
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

const AUDIO_PATHS = withCommonRoots([
  'audio',
  'audio.name',
  'audio.title',
  'audio.description',
  'audios',
  'audios.name',
  'audios.title',
  'audios.audio',
  'audios.audio.name',
  'audios.audio.title',
  'audios.audio.description',
  'audioList',
  'selectedAudios',
  'orderAudios',
  'audioOrder',
]);

const VARIABLE_PATHS = withCommonRoots([
  'variable',
  'variableName',
  'audioVariable',
  'ivrAudioVariable',
  'selectedVariable',
  'variableToSave',
]);

const REPEAT_AUDIO_PATHS = withCommonRoots([
  'repeatAudio',
  'audioRepeat',
  'repeatAudios',
  'audiosRepeat',
  'audiosForRepeat',
  'repeatAudioList',
  'audioForRepeat',
  'repeat.audio',
  'repeat.audio.name',
  'repeat.audio.title',
]);

const REPEAT_VARIABLE_PATHS = withCommonRoots([
  'repeatVariable',
  'audioRepeatVariable',
  'repeat.variable',
  'repeat.variableName',
  'repeatAudioVariable',
]);

const MAX_REPEAT_AUDIO_ERROR_PATHS = withCommonRoots([
  'qtMaxRepeatAudioError',
  'maxRepeatAudioError',
  'maxRepeatAudio',
  'maxRepeat',
  'repeat.max',
  'repeatAudioErrorCount',
  'retryCount',
]);

const DTMF_TIMEOUT_PATHS = withCommonRoots([
  'qtSecTimeoutDtmf',
  'dtmfTimeout',
  'timeoutDtmf',
  'dtmf.timeout',
  'dtmf.timeoutSeconds',
  'timeoutSeconds',
]);

const DTMF_MIN_DIGITS_PATHS = withCommonRoots([
  'qtMinDigitsDtmf',
  'minDigitsDtmf',
  'dtmf.minDigits',
  'dtmfMinDigits',
  'minDigits',
]);

const DTMF_MAX_DIGITS_PATHS = withCommonRoots([
  'qtMaxDigitsDtmf',
  'maxDigitsDtmf',
  'dtmf.maxDigits',
  'dtmfMaxDigits',
  'maxDigits',
]);

const SAVE_RESPONSE_VARIABLE_PATHS = withCommonRoots([
  'nmIvrData',
  'variableToSaveResponse',
  'saveResponseVariable',
  'responseVariable',
  'resultVariable',
  'outputVariable',
]);

const CALL_NO_ANSWER_PATHS = withCommonRoots([
  'callNoAnswer',
  'noAnswer',
  'withoutAnswer',
  'routeNoAnswer',
  'routeOnNoAnswer',
  'onNoInput',
]);

export const ivrTTSCaptureAudioDTMFFilterConfig = {
  type: 'IvrTTSCaptureAudioDTMF',
  label: 'Captura variável - TTS',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: CapturaCPFCNPJ',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: captura',
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
    container.appendChild(createSectionTitle('Áudio'));
    container.appendChild(
      createTextInput({
        label: 'Áudio',
        key: 'audio',
        placeholder: 'Ex: TTS-Digite o cpf...',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável',
        key: 'variable',
        placeholder: 'Ex: TipoDocumento',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Áudio para repetição',
        key: 'repeatAudio',
        placeholder: 'Ex: TTS-Desculpa...',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável (repetição)',
        key: 'repeatVariable',
        placeholder: 'Ex: TipoDocumento',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('DTMF'));
    container.appendChild(
      createTextInput({
        label: 'Nº de repetições de áudio (erro/sem digitação)',
        key: 'maxRepeatAudioError',
        placeholder: 'Ex: 2',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tempo de digitação (segundos)',
        key: 'dtmfTimeout',
        placeholder: 'Ex: 5',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Qtd. mínima de dígitos',
        key: 'minDigitsDtmf',
        placeholder: 'Ex: 11',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Qtd. máxima de dígitos',
        key: 'maxDigitsDtmf',
        placeholder: 'Ex: 14',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável para salvar resposta',
        key: 'saveResponseVariable',
        placeholder: 'Ex: {CPFouCNPJ}',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Ligar "Sem resposta"',
        key: 'callNoAnswer',
        state,
        onChange,
      }),
    );
  },
  match: (item, state, helpers) => {
    const { matchBooleanAny, matchTextAny, matchItemToken } = createMatchHelpers(item, helpers);

    const matchLooseText = (paths, value) => {
      if (!value) return true;
      return matchTextAny(paths, value) || matchItemToken(value);
    };

    return (
      matchLooseText(TITLE_PATHS, state.title) &&
      matchLooseText(TAG_PATHS, state.tags) &&
      matchLooseText(CUSTOM_STATUS_PATHS, state.customStatus) &&
      matchLooseText(AUDIO_PATHS, state.audio) &&
      matchLooseText(VARIABLE_PATHS, state.variable) &&
      matchLooseText(REPEAT_AUDIO_PATHS, state.repeatAudio) &&
      matchLooseText(REPEAT_VARIABLE_PATHS, state.repeatVariable) &&
      matchLooseText(MAX_REPEAT_AUDIO_ERROR_PATHS, state.maxRepeatAudioError) &&
      matchLooseText(DTMF_TIMEOUT_PATHS, state.dtmfTimeout) &&
      matchLooseText(DTMF_MIN_DIGITS_PATHS, state.minDigitsDtmf) &&
      matchLooseText(DTMF_MAX_DIGITS_PATHS, state.maxDigitsDtmf) &&
      matchLooseText(SAVE_RESPONSE_VARIABLE_PATHS, state.saveResponseVariable) &&
      matchBooleanAny(CALL_NO_ANSWER_PATHS, state.callNoAnswer)
    );
  },
};
