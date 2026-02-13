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

const AUDIO_TEXT_PATHS = withCommonRoots([
  'audio',
  'audio.text',
  'audio.message',
  'audio.content',
  'audio.value',
  'tts',
  'tts.text',
  'tts.message',
  'ttsAudio',
  'ttsAudio.text',
  'text',
  'description',
  'message',
  'content',
]);

const AUDIO_ASSET_PATHS = withCommonRoots([
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
  'audios.audio.text',
  'audioList',
  'selectedAudios',
  'selectedAudio',
  'orderAudios',
  'audioOrder',
]);

export const ivrTTSAudioFilterConfig = {
  type: 'IvrTTSAudio',
  label: 'Áudio TTS',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: AudioFraseEmergencial',
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
    container.appendChild(createSectionTitle('Áudio TTS'));
    container.appendChild(
      createTextInput({
        label: 'Áudio (texto/TTS)',
        key: 'audioText',
        placeholder: 'Ex: {FraseEmergencial}',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Áudio cadastrado',
        key: 'audioAsset',
        placeholder: 'Ex: TTS-Olá! Bem vindo...',
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
      matchLooseText(AUDIO_TEXT_PATHS, state.audioText) &&
      matchLooseText(AUDIO_ASSET_PATHS, state.audioAsset)
    );
  },
};
