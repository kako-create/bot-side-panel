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

const TITLE_PATHS = withCommonRoots(['title', 'name', 'label', 'code', 'logCode']);
const TAG_PATHS = withCommonRoots(['tags', 'tags.name', 'tags.label']);
const CUSTOM_STATUS_PATHS = withCommonRoots([
  'customStatus',
  'customizedStatus',
  'statusCustom',
  'status',
]);

const LOG_TEXT_PATHS = withCommonRoots([
  'log',
  'logs',
  'logList',
  'logsList',
  'ivrLogs',
  'ivrSettings.ivrLogs',
  'ivrSettings.logs',
  'log.key',
  'log.name',
  'log.value',
  'log.text',
  'log.message',
  'log.variable',
  'log.variableName',
  'logs.key',
  'logs.name',
  'logs.value',
  'logs.text',
  'logs.message',
  'logs.variable',
  'logs.variableName',
  'ivrLogs.key',
  'ivrLogs.name',
  'ivrLogs.value',
  'ivrLogs.text',
  'ivrLogs.message',
  'ivrLogs.variable',
  'ivrLogs.variableName',
  'ivrSettings.ivrLogs.key',
  'ivrSettings.ivrLogs.name',
  'ivrSettings.ivrLogs.value',
  'ivrSettings.ivrLogs.text',
  'ivrSettings.ivrLogs.message',
  'ivrSettings.ivrLogs.variable',
  'ivrSettings.ivrLogs.variableName',
]);

export const ivrLogFilterConfig = {
  type: 'IvrLog',
  label: 'Log',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Titulo',
        key: 'title',
        placeholder: 'Ex: DIG.002',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: DIG.002',
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
    container.appendChild(createSectionTitle('Logs'));
    container.appendChild(
      createTextInput({
        label: 'Log (buscar)',
        key: 'logText',
        placeholder: 'Buscar no log',
        state,
        onChange,
      }),
    );
  },
  match: (item, state, helpers) => {
    const { matchTextAny, matchItemToken } = createMatchHelpers(item, helpers);

    const matchLooseText = (paths, value) => matchTextAny(paths, value) || matchItemToken(value);

    return (
      matchLooseText(TITLE_PATHS, state.title) &&
      matchLooseText(TAG_PATHS, state.tags) &&
      matchLooseText(CUSTOM_STATUS_PATHS, state.customStatus) &&
      matchLooseText(LOG_TEXT_PATHS, state.logText)
    );
  },
};

