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

const CONDITIONS_ROOT_PATHS = withCommonRoots([
  'conditions',
  'conditionals',
  'rules',
  'conditionItems',
  'priorityConditions',
]);

const CONDITION_VARIABLE_PATHS = withCommonRoots([
  'conditions.variable',
  'conditions.variableName',
  'conditions.left',
  'conditions.context',
  'conditionals.variable',
  'conditionals.variableName',
  'conditionals.left',
  'conditionVariable',
  'variable',
]);

const CONDITION_OPERATOR_PATHS = withCommonRoots([
  'conditions.operator',
  'conditions.condition',
  'conditions.rule',
  'conditions.comparator',
  'conditionals.operator',
  'conditionals.condition',
  'conditionals.rule',
  'operator',
  'condition',
]);

const CONDITION_VALUE_PATHS = withCommonRoots([
  'conditions.value',
  'conditions.right',
  'conditions.compareValue',
  'conditionals.value',
  'conditionals.right',
  'value',
]);

const CONDITION_DESTINATION_PATHS = withCommonRoots([
  'conditions.destination',
  'conditions.destinationId',
  'conditions.connectedTo',
  'conditions.blockDestination',
  'conditions.itemDestination',
  'conditionals.destination',
  'conditionals.destinationId',
  'conditionals.connectedTo',
  'destination',
]);

const ESCAPE_DESTINATION_PATHS = withCommonRoots([
  'conditionEscape',
  'escape',
  'escape.destination',
  'escape.destinationId',
  'escape.block',
  'escape.blockId',
  'fallbackDestination',
  'defaultDestination',
  'destinationEscape',
]);

export const ivrConditionalFilterConfig = {
  type: 'IvrConditional',
  label: 'Condicional',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: ValidaFraseEmergencial',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: validacao',
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
    container.appendChild(createSectionTitle('Condicionais'));
    container.appendChild(
      createTextInput({
        label: 'Se variável',
        key: 'conditionVariable',
        placeholder: 'Ex: {FraseEmergencial}',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Condição / operador',
        key: 'conditionOperator',
        placeholder: 'Ex: Não é vazio',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor',
        key: 'conditionValue',
        placeholder: 'Buscar no valor',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Bloco de destino',
        key: 'conditionDestination',
        placeholder: 'Ex: DIG.001 ou ID do bloco',
        state,
        onChange,
      }),
    );

    container.appendChild(createDivider());
    container.appendChild(createSectionTitle('Escape'));
    container.appendChild(
      createTextInput({
        label: 'Bloco de escape',
        key: 'escapeDestination',
        placeholder: 'Ex: DIG.002 ou ID do bloco',
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
      (matchLooseText(CONDITION_VARIABLE_PATHS, state.conditionVariable) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.conditionVariable)) &&
      (matchLooseText(CONDITION_OPERATOR_PATHS, state.conditionOperator) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.conditionOperator)) &&
      (matchLooseText(CONDITION_VALUE_PATHS, state.conditionValue) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.conditionValue)) &&
      (matchLooseText(CONDITION_DESTINATION_PATHS, state.conditionDestination) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.conditionDestination)) &&
      matchLooseText(ESCAPE_DESTINATION_PATHS, state.escapeDestination)
    );
  },
};
