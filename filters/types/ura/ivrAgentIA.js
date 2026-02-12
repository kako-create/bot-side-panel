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
const START_AUDIO_PATHS = withCommonRoots([
  'audioStartConversation',
  'startConversationAudio',
  'initialAudio',
  'audioMessage',
  'audio',
  'audio.text',
  'greetingAudio',
  'startAudio',
]);
const PROMPT_PATHS = withCommonRoots([
  'prompt',
  'prompt.text',
  'prompt.value',
  'agentPrompt',
  'chatgptPrompt',
  'iaPrompt',
  'aiPrompt',
  'ia.prompt',
  'ai.prompt',
]);
const INSTRUCTION_PROMPT_PATHS = withCommonRoots([
  'instructionPrompt',
  'promptInstruction',
  'systemPrompt',
  'assistantPrompt',
  'instruction',
  'instructions',
]);
const FUNCTIONS_PATHS = withCommonRoots([
  'functions',
  'functionList',
  'functionCalling',
  'tools',
  'agentFunctions',
  'iaFunctions',
]);
const VARIABLE_RETURN_PATHS = withCommonRoots([
  'iaAgentVariableToSaveReturn',
  'variableToSaveReturn',
  'returnVariable',
  'outputVariable',
  'resultVariable',
]);
const ADVANCED_VOICE_SETTINGS_PATHS = withCommonRoots([
  'enableAdvancedVoiceRecognitionSettings',
  'advancedVoiceRecognitionSettings',
  'voiceRecognitionSettings.enabled',
  'voiceRecognition.enabled',
  'advancedVoiceRecognition',
]);

export const ivrAgentIAFilterConfig = {
  type: 'IvrAgentIA',
  label: 'Agente de IA',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: Título',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: TagURA',
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
    container.appendChild(createSectionTitle('IA'));
    container.appendChild(
      createTextInput({
        label: 'Áudio para início da conversa',
        key: 'startAudio',
        placeholder: 'Buscar no conteúdo do áudio',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Prompt',
        key: 'prompt',
        placeholder: 'Buscar no prompt',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Prompt de instrução',
        key: 'instructionPrompt',
        placeholder: 'Buscar no prompt de instrução',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Funções',
        key: 'functions',
        placeholder: 'Ex: function_name',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável de retorno',
        key: 'variableToSaveReturn',
        placeholder: 'Ex: iaAgentVariableToSaveReturn',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Mostrar config. avançadas',
        key: 'advancedVoiceSettings',
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
      matchLooseText(START_AUDIO_PATHS, state.startAudio) &&
      matchLooseText(PROMPT_PATHS, state.prompt) &&
      matchLooseText(INSTRUCTION_PROMPT_PATHS, state.instructionPrompt) &&
      matchLooseText(FUNCTIONS_PATHS, state.functions) &&
      matchLooseText(VARIABLE_RETURN_PATHS, state.variableToSaveReturn) &&
      matchBooleanAny(ADVANCED_VOICE_SETTINGS_PATHS, state.advancedVoiceSettings)
    );
  },
};
