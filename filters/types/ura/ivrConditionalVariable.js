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
  'variable',
  'conditionVariable',
  'conditions.variable',
  'conditions.variableName',
  'conditions.left',
  'conditions.context',
  'conditionals.variable',
  'conditionals.variableName',
  'conditionals.left',
  'rules.variable',
  'rules.left',
]);

const CONDITION_OPERATOR_PATHS = withCommonRoots([
  'operator',
  'conditionOperator',
  'comparisonOperator',
  'conditions.operator',
  'conditions.condition',
  'conditions.rule',
  'conditions.comparator',
  'conditionals.operator',
  'conditionals.condition',
  'conditionals.rule',
  'rules.operator',
  'rules.comparator',
]);

const CONDITION_VALUE_PATHS = withCommonRoots([
  'value',
  'conditionValue',
  'conditions.value',
  'conditions.right',
  'conditions.compareValue',
  'conditionals.value',
  'conditionals.right',
  'rules.value',
  'rules.right',
]);

const NEXT_VARIABLE_PATHS = withCommonRoots([
  'nextVariable',
  'targetVariable',
  'outputVariable',
  'conditions.nextVariable',
  'conditions.targetVariable',
  'conditions.outputVariable',
  'conditions.assignmentVariable',
  'conditionals.nextVariable',
  'conditionals.targetVariable',
  'conditionals.outputVariable',
  'rules.nextVariable',
  'rules.targetVariable',
]);

const ASSIGNMENT_OPERATOR_PATHS = withCommonRoots([
  'condition',
  'assignmentCondition',
  'assignmentOperator',
  'nextCondition',
  'nextOperator',
  'conditions.nextCondition',
  'conditions.assignmentCondition',
  'conditions.assignmentOperator',
  'conditions.nextOperator',
  'conditionals.nextCondition',
  'conditionals.assignmentCondition',
  'conditionals.assignmentOperator',
  'conditionals.nextOperator',
  'rules.nextCondition',
  'rules.assignmentCondition',
]);

const ASSIGNED_VALUE_PATHS = withCommonRoots([
  'variableValue',
  'assignedValue',
  'nextValue',
  'targetValue',
  'outputValue',
  'conditions.variableValue',
  'conditions.assignedValue',
  'conditions.nextValue',
  'conditions.targetValue',
  'conditions.outputValue',
  'conditions.result',
  'conditionals.variableValue',
  'conditionals.assignedValue',
  'conditionals.nextValue',
  'conditionals.targetValue',
  'conditionals.outputValue',
  'conditionals.result',
  'rules.variableValue',
  'rules.assignedValue',
  'rules.nextValue',
  'rules.targetValue',
]);

export const ivrConditionalVariableFilterConfig = {
  type: 'IvrConditionalVariable',
  label: 'Condicional Variável',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: AtribuiFila',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: fila',
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
        placeholder: 'Ex: {TipoCliente}',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Operador',
        key: 'conditionOperator',
        placeholder: 'Ex: é igual (==)',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor da condição',
        key: 'conditionValue',
        placeholder: 'Ex: residencial',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Variável de destino',
        key: 'nextVariable',
        placeholder: 'Ex: {Fila}',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Condição de atribuição',
        key: 'assignmentOperator',
        placeholder: 'Ex: recebe (=)',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor atribuído',
        key: 'assignedValue',
        placeholder: 'Ex: Comercial',
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
      (matchLooseText(NEXT_VARIABLE_PATHS, state.nextVariable) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.nextVariable)) &&
      (matchLooseText(ASSIGNMENT_OPERATOR_PATHS, state.assignmentOperator) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.assignmentOperator)) &&
      (matchLooseText(ASSIGNED_VALUE_PATHS, state.assignedValue) ||
        matchLooseText(CONDITIONS_ROOT_PATHS, state.assignedValue))
    );
  },
};
