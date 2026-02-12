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

const ASSIGNMENT_ROOT_PATHS = withCommonRoots([
  'variables',
  'menuIvrVariables',
  'variableAssignments',
  'variablesForAssignment',
  'assignments',
]);

const VARIABLE_PATHS = withCommonRoots([
  'variable',
  'variables.variable',
  'variables.name',
  'variables.key',
  'variables.variableName',
  'menuIvrVariables.variable',
  'menuIvrVariables.name',
  'variableAssignments.variable',
  'variableAssignments.name',
  'assignments.variable',
  'assignments.name',
]);

const CONDITION_PATHS = withCommonRoots([
  'condition',
  'operator',
  'rule',
  'variables.condition',
  'variables.operator',
  'variables.rule',
  'menuIvrVariables.condition',
  'menuIvrVariables.operator',
  'menuIvrVariables.rule',
  'variableAssignments.condition',
  'variableAssignments.operator',
  'variableAssignments.rule',
  'assignments.condition',
  'assignments.operator',
  'assignments.rule',
]);

const VALUE_PATHS = withCommonRoots([
  'value',
  'text',
  'content',
  'variables.value',
  'variables.text',
  'variables.content',
  'menuIvrVariables.value',
  'menuIvrVariables.text',
  'menuIvrVariables.content',
  'variableAssignments.value',
  'variableAssignments.text',
  'variableAssignments.content',
  'assignments.value',
  'assignments.text',
  'assignments.content',
]);

export const ivrVariableAssignmentFilterConfig = {
  type: 'IvrVariableAssignment',
  label: 'Atribuição de variável',
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
    container.appendChild(createSectionTitle('Variáveis para atribuição'));
    container.appendChild(
      createTextInput({
        label: 'Variável',
        key: 'assignmentVariable',
        placeholder: 'Ex: global.minute',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Condição',
        key: 'assignmentCondition',
        placeholder: 'Ex: igual, contém',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Valor',
        key: 'assignmentValue',
        placeholder: 'Buscar no valor',
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
      (matchLooseText(VARIABLE_PATHS, state.assignmentVariable) ||
        matchLooseText(ASSIGNMENT_ROOT_PATHS, state.assignmentVariable)) &&
      matchLooseText(CONDITION_PATHS, state.assignmentCondition) &&
      matchLooseText(VALUE_PATHS, state.assignmentValue)
    );
  },
};
