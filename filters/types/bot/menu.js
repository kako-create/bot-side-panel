import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';
import { hasMenuOptionOverLength } from '../../../shared/menuWarning.js';

const matchMenuOptionOver20Chars = (item, value) => {
  if (value !== 'true' && value !== 'false') return true;
  const hasLongOption = hasMenuOptionOverLength(item, 20);
  return value === 'true' ? hasLongOption : !hasLongOption;
};

export const menuFilterConfig = {
  type: 'Menu',
  label: 'Menu',
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
    container.appendChild(createSectionTitle('Menu'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: Nome do menu',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Descrição',
        key: 'description',
        placeholder: 'Ex: Texto exibido',
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
        label: 'Mensagem (texto)',
        key: 'descriptionText',
        placeholder: 'Buscar no campo de mensagem',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável',
        key: 'variable',
        placeholder: 'Ex: nomeVariavel',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Validação',
        key: 'validation',
        placeholder: 'Ex: ^[0-9]+$',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tipo de validação',
        key: 'validationType',
        placeholder: 'Ex: 5',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Menu opções: NumberOp',
        key: 'menuOptionsNumberOp',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Menu opções: SuggestionOp',
        key: 'menuOptionsSuggestionOp',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Itens do menu (descrição)',
        key: 'menuItemsDescription',
        placeholder: 'Ex: UTC+02:00',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createBooleanSelect({
        label: 'Existe opção com mais de 20 caracteres',
        key: 'menuOptionOver20Chars',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Salvar resposta'));
    container.appendChild(
      createBooleanSelect({
        label: 'Armazenar a opção escolhida',
        key: 'captureAnswer',
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
        placeholder: 'Ex: 69302c0023587a01176837fa',
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
    const { matchBoolean, matchBooleanAny, matchText } = createMatchHelpers(item, helpers);

    return (
      matchBoolean('useIA', state.useIA) &&
      matchBoolean('quickAccess', state.quickAccess) &&
      matchBoolean('checkpoint', state.checkpoint) &&
      matchText('tags', state.tags) &&
      matchText('title', state.title) &&
      matchText('description', state.description) &&
      matchText('description', state.descriptionText) &&
      matchText('timeTypping', state.timeTypping) &&
      matchText('variable', state.variable) &&
      matchText('validation', state.validation) &&
      matchText('validationType', state.validationType) &&
      matchBoolean('menuOptions.NumberOp', state.menuOptionsNumberOp) &&
      matchBoolean('menuOptions.SuggestionOp', state.menuOptionsSuggestionOp) &&
      matchText('menuItems.description', state.menuItemsDescription) &&
      matchMenuOptionOver20Chars(item, state.menuOptionOver20Chars) &&
      matchBoolean('captureAnswer', state.captureAnswer) &&
      matchText('errorMessage', state.errorMessage) &&
      matchText('errorMessageFinal', state.errorMessageFinal) &&
      matchText('maxTries', state.maxTries) &&
      matchBoolean('idleTime.on', state.idleTimeOn) &&
      matchText('idleTime.timer', state.idleTimeTimer) &&
      matchText('idleTime.item', state.idleTimeItem) &&
      matchBoolean('ignoreTriggers.time', state.triggerTime) &&
      matchBoolean('ignoreTriggers.message', state.triggerMessage) &&
      matchBoolean('ignoreTriggers.audio', state.triggerAudio) &&
      matchBoolean('ignoreTriggers.media', state.triggerMedia) &&
      matchText('conditionEscape', state.conditionEscape) &&
      matchBooleanAny(['redirectToCheckpoint', 'checkpoint'], state.redirectToCheckpoint) &&
      matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
      matchText('eventDescription.description', state.eventDescriptionText)
    );
  },
};
