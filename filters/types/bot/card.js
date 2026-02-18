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
const IMAGE_URL_PATHS = withCommonRoots([
  'image',
  'imageUrl',
  'image.url',
  'imageUrlCard',
  'cardImage',
  'cardImageUrl',
  'cardImage.url',
  'urlImage',
  'hero.image',
  'hero.imageUrl',
]);
const CARD_TITLE_PATHS = withCommonRoots([
  'cardTitle',
  'title',
  'card.title',
  'header',
  'label',
]);
const CARD_DESCRIPTION_PATHS = withCommonRoots([
  'cardDescription',
  'description',
  'card.description',
  'text',
  'body',
]);
const SINGLE_URL_MODE_PATHS = withCommonRoots([
  'cardIsUrlButton',
  'isUrlButton',
  'singleButton.isUrl',
  'singleButton.urlMode',
  'singleButton.mode',
]);
const SINGLE_BUTTON_LABEL_PATHS = withCommonRoots([
  'singleButtonLabel',
  'singleButton.label',
  'singleButton.text',
  'singleButton.title',
  'buttons.0.label',
  'buttons.0.text',
  'buttons.0.title',
]);
const SINGLE_BUTTON_URL_PATHS = withCommonRoots([
  'singleButtonValue',
  'singleButton.url',
  'singleButton.value',
  'singleButton.link',
  'buttonUrl',
  'url',
]);
const BUTTON_LABEL_PATHS = withCommonRoots([
  'buttons.label',
  'buttons.text',
  'buttons.title',
  'buttons.description',
  'menuItems.description',
  'options.label',
  'options.text',
]);
const BUTTON_VALUE_PATHS = withCommonRoots([
  'buttons.value',
  'buttons.url',
  'buttons.link',
  'buttons.payload',
  'menuItems.value',
  'menuItems.redirectTo',
  'options.value',
  'options.payload',
]);
const CAPTURE_ANSWER_PATHS = withCommonRoots([
  'captureAnswer',
  'saveAnswer',
  'storeAnswer',
]);
const IDLE_TIME_ON_PATHS = withCommonRoots([
  'idleTime.on',
  'idleTime.enabled',
  'idle.on',
]);
const IDLE_TIME_TIMER_PATHS = withCommonRoots([
  'idleTime.timer',
  'idleTime.minutes',
  'idle.timer',
  'idle.minutes',
]);
const IDLE_TIME_ITEM_PATHS = withCommonRoots([
  'idleTime.item',
  'idleTime.itemId',
  'idleTime.destination',
  'idle.item',
  'idle.destination',
]);
const EVENT_DESCRIPTION_ACTIVE_PATHS = withCommonRoots([
  'eventDescription.active',
  'switchEventDescription',
]);
const EVENT_DESCRIPTION_TEXT_PATHS = withCommonRoots([
  'eventDescription.description',
  'eventDescription.text',
  'eventDescriptionText',
]);

export const cardFilterConfig = {
  type: 'Card',
  label: 'Card',
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
        placeholder: 'Ex: HorariosDengo',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Card'));
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
        label: 'URL da imagem',
        key: 'imageUrl',
        placeholder: 'Ex: https://...',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Título do card',
        key: 'cardTitle',
        placeholder: 'Ex: Informações',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Descrição',
        key: 'cardDescription',
        placeholder: 'Buscar na descrição',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Botões'));
    container.appendChild(
      createBooleanSelect({
        label: 'Botão único de URL',
        key: 'cardIsUrlButton',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Texto do botão único',
        key: 'singleButtonLabel',
        placeholder: 'Ex: Acessar lojas',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'URL do botão único',
        key: 'singleButtonValue',
        placeholder: 'Ex: https://dengo.com/...',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Texto dos botões',
        key: 'buttonsLabel',
        placeholder: 'Ex: Botão 1',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor/URL dos botões',
        key: 'buttonsValue',
        placeholder: 'Ex: https://...',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Salvar resposta'));
    container.appendChild(
      createBooleanSelect({
        label: 'Armazenar resposta em variável',
        key: 'captureAnswer',
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
    const {
      matchBoolean,
      matchBooleanAny,
      matchItemToken,
      matchOptionAny,
      matchTextAny,
    } = createMatchHelpers(item, helpers);

    const matchLooseText = (paths, value) => {
      if (!value) return true;
      return matchTextAny(paths, value) || matchItemToken(value);
    };

    const matchSingleUrlMode = () => {
      if (state.cardIsUrlButton !== 'true' && state.cardIsUrlButton !== 'false') return true;
      if (matchBooleanAny(SINGLE_URL_MODE_PATHS, state.cardIsUrlButton)) return true;
      if (state.cardIsUrlButton === 'true') return matchOptionAny(SINGLE_URL_MODE_PATHS, 'url');
      return matchOptionAny(SINGLE_URL_MODE_PATHS, 'button');
    };

    return (
      matchBoolean('useIA', state.useIA) &&
      matchBoolean('quickAccess', state.quickAccess) &&
      matchBoolean('checkpoint', state.checkpoint) &&
      matchLooseText(TAG_PATHS, state.tags) &&
      matchLooseText(TYPING_TIME_PATHS, state.timeTypping) &&
      matchLooseText(IMAGE_URL_PATHS, state.imageUrl) &&
      matchLooseText(CARD_TITLE_PATHS, state.cardTitle) &&
      matchLooseText(CARD_DESCRIPTION_PATHS, state.cardDescription) &&
      matchSingleUrlMode() &&
      matchLooseText(SINGLE_BUTTON_LABEL_PATHS, state.singleButtonLabel) &&
      matchLooseText(SINGLE_BUTTON_URL_PATHS, state.singleButtonValue) &&
      matchLooseText(BUTTON_LABEL_PATHS, state.buttonsLabel) &&
      matchLooseText(BUTTON_VALUE_PATHS, state.buttonsValue) &&
      matchBooleanAny(CAPTURE_ANSWER_PATHS, state.captureAnswer) &&
      matchBooleanAny(IDLE_TIME_ON_PATHS, state.idleTimeOn) &&
      matchLooseText(IDLE_TIME_TIMER_PATHS, state.idleTimeTimer) &&
      matchLooseText(IDLE_TIME_ITEM_PATHS, state.idleTimeItem) &&
      matchBooleanAny(EVENT_DESCRIPTION_ACTIVE_PATHS, state.eventDescriptionActive) &&
      matchLooseText(EVENT_DESCRIPTION_TEXT_PATHS, state.eventDescriptionText)
    );
  },
};
