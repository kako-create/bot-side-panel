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

const QUEUE_PATHS = withCommonRoots([
  'queue',
  'queueName',
  'queueCode',
  'queueId',
  'queue.name',
  'queue.code',
  'queue.id',
  'omniQueue',
  'omniQueueName',
  'omniQueueCode',
  'serviceQueue',
  'serviceQueueName',
  'serviceQueueCode',
  'destinationQueue',
  'targetQueue',
  'selectedQueue',
  'selectQueueCode',
]);

const TIMEOUT_PATHS = withCommonRoots([
  'timeout',
  'timeoutSec',
  'timeoutSeconds',
  'timeoutInSeconds',
  'omniTimeout',
  'serviceTimeout',
]);

const ENABLE_VOICE_TO_DIGITAL_PATHS = withCommonRoots([
  'enableVoiceToDigital',
  'voiceToDigital',
  'enableVoiceDigital',
  'enableVoiceToOmni',
  'allowVoiceToDigital',
]);

const SEND_TAGS_PATHS = withCommonRoots([
  'tagsToSend',
  'sendTags',
  'sendingTags',
  'transferTags',
  'omniTags',
  'serviceTags',
  'tagsForSend',
  'tagsToTransfer',
  'send.tags',
  'send.tags.name',
  'send.tags.label',
]);

export const ivrDeriveOmniServiceFilterConfig = {
  type: 'IvrDeriveOmniService',
  label: 'Derivar Serviço Omni',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: Financeiro',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: relacionamento',
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
    container.appendChild(createSectionTitle('Configuração'));
    container.appendChild(
      createTextInput({
        label: 'Fila',
        key: 'queue',
        placeholder: 'Ex: URA - Relacionamento Financeiro',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Timeout (s)',
        key: 'timeout',
        placeholder: 'Ex: 3600',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Habilitar Voz para Digital',
        key: 'enableVoiceToDigital',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags para envio',
        key: 'tagsToSend',
        placeholder: 'Ex: financeiro',
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
      matchLooseText(QUEUE_PATHS, state.queue) &&
      matchLooseText(TIMEOUT_PATHS, state.timeout) &&
      matchBooleanAny(ENABLE_VOICE_TO_DIGITAL_PATHS, state.enableVoiceToDigital) &&
      matchLooseText(SEND_TAGS_PATHS, state.tagsToSend)
    );
  },
};
