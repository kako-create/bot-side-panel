import {
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

export const ivrAudioFilterConfig = {
  type: 'IvrAudio',
  label: 'Áudio',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: AudioSaudacao',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: boas-vindas',
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
        placeholder: 'Ex: TTS-Olá! Bem vindo...',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável',
        key: 'variable',
        placeholder: 'Ex: NomeVariavelAudio',
        state,
        onChange,
      }),
    );
  },
  match: (item, state, helpers) => {
    const { matchTextAny, matchItemToken } = createMatchHelpers(item, helpers);

    const matchLooseText = (paths, value) => {
      if (!value) return true;
      return matchTextAny(paths, value) || matchItemToken(value);
    };

    return (
      matchLooseText(TITLE_PATHS, state.title) &&
      matchLooseText(TAG_PATHS, state.tags) &&
      matchLooseText(CUSTOM_STATUS_PATHS, state.customStatus) &&
      matchLooseText(AUDIO_PATHS, state.audio) &&
      matchLooseText(VARIABLE_PATHS, state.variable)
    );
  },
};
