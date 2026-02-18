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

const TAG_PATHS = withCommonRoots(['tags', 'tags.name', 'tags.label']);
const TYPING_TIME_PATHS = withCommonRoots([
  'timeTypping',
  'typingTime',
  'typing.time',
  'typing.seconds',
]);
const QUEUE_PATHS = withCommonRoots([
  'humanAttendance',
  'humanAttendanceId',
  'humanAttendanceName',
  'queue',
  'queue.id',
  'queue.name',
  'queueId',
  'queueName',
  'selectedQueue',
  'human.queue',
  'attendance.queue',
]);
const PRE_TRANSFER_TEXT_PATHS = withCommonRoots([
  'description',
  'preTransferText',
  'preTransferMessage',
  'messageBeforeTransfer',
  'phraseTransfer',
  'transferText',
]);
const SHOW_AGENT_NAME_PATHS = withCommonRoots([
  'showAgentName',
  'showAgent',
  'displayAgentName',
]);
const RESPECT_SCHEDULE_PATHS = withCommonRoots([
  'respectSchedule',
  'checkSchedule',
  'scheduleValidation',
  'validateSchedule',
]);
const CHECK_AGENT_PATHS = withCommonRoots([
  'checkAgent',
  'checkOnlineAgent',
  'checkAgentsOnline',
  'validateAgentOnline',
]);
const ESCAPE_CHECKPOINT_PATHS = withCommonRoots([
  'checkpointEscape',
  'redirectToCheckpoint',
  'escape.checkpoint',
  'escape.redirectToCheckpoint',
]);
const ESCAPE_BLOCK_PATHS = withCommonRoots([
  'humanEscape',
  'escape.item',
  'escape.itemId',
  'escape.destination',
  'escape.destinationId',
  'redirectTo',
  'redirectToItem',
  'redirectTo.id',
  'redirectTo.item',
  'redirectTo.itemId',
]);
const EVENT_DESCRIPTION_ACTIVE_PATHS = withCommonRoots([
  'switchEventDescription',
  'eventDescription.active',
]);
const EVENT_DESCRIPTION_TEXT_PATHS = withCommonRoots([
  'eventDescription.description',
  'eventDescription.text',
  'eventDescriptionText',
]);

export const humanFilterConfig = {
  type: 'Human',
  label: 'Humano',
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
        placeholder: 'Ex: AtendimentoHumano',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Atendimento humano'));
    container.appendChild(
      createTextInput({
        label: 'Tempo de digitação (segundos)',
        key: 'timeTypping',
        placeholder: 'Ex: 1',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Fila de atendimento',
        key: 'humanAttendance',
        placeholder: 'Ex: Fila Comercial',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Frase de pré-transferência',
        key: 'description',
        placeholder: 'Buscar na frase',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Comportamento'));
    container.appendChild(
      createBooleanSelect({
        label: 'Exibir nome do agente',
        key: 'showAgentName',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Checar dia e horário de atendimento',
        key: 'respectSchedule',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Checar se há atendentes online',
        key: 'checkAgent',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Escape'));
    container.appendChild(
      createBooleanSelect({
        label: 'Ativar último checkpoint',
        key: 'checkpointEscape',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Bloco de escape (ID)',
        key: 'humanEscape',
        placeholder: 'Ex: 68f79b0e5afefd340bb9b9fe',
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
    const { matchBoolean, matchBooleanAny, matchItemToken, matchTextAny } = createMatchHelpers(
      item,
      helpers,
    );

    const matchLooseText = (paths, value) => {
      if (!value) return true;
      return matchTextAny(paths, value) || matchItemToken(value);
    };

    return (
      matchBoolean('quickAccess', state.quickAccess) &&
      matchBoolean('checkpoint', state.checkpoint) &&
      matchLooseText(TAG_PATHS, state.tags) &&
      matchLooseText(TYPING_TIME_PATHS, state.timeTypping) &&
      matchLooseText(QUEUE_PATHS, state.humanAttendance) &&
      matchLooseText(PRE_TRANSFER_TEXT_PATHS, state.description) &&
      matchBooleanAny(SHOW_AGENT_NAME_PATHS, state.showAgentName) &&
      matchBooleanAny(RESPECT_SCHEDULE_PATHS, state.respectSchedule) &&
      matchBooleanAny(CHECK_AGENT_PATHS, state.checkAgent) &&
      matchBooleanAny(ESCAPE_CHECKPOINT_PATHS, state.checkpointEscape) &&
      matchLooseText(ESCAPE_BLOCK_PATHS, state.humanEscape) &&
      matchBooleanAny(EVENT_DESCRIPTION_ACTIVE_PATHS, state.eventDescriptionActive) &&
      matchLooseText(EVENT_DESCRIPTION_TEXT_PATHS, state.eventDescriptionText)
    );
  },
};
