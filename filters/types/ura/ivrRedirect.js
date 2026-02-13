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

const REDIRECT_ROOT_PATHS = withCommonRoots([
  'redirect',
  'redirectTo',
  'destination',
  'target',
]);

const DESTINATION_PATHS = withCommonRoots([
  'redirectTo',
  'redirectTo.id',
  'redirectTo.item',
  'redirectTo.itemId',
  'redirectTo.name',
  'redirectTo.label',
  'redirectToItem',
  'redirectToItemId',
  'destination',
  'destination.id',
  'destination.item',
  'destination.itemId',
  'destination.name',
  'destination.label',
  'destinationId',
  'destinationItem',
  'destinationItemId',
  'blockDestination',
  'targetBlock',
  'targetBlockId',
  'itemDestination',
  'item.id',
  'item.name',
  'item.label',
]);

export const ivrRedirectFilterConfig = {
  type: 'IvrRedirect',
  label: 'Direcionador',
  render: ({ container, state, onChange }) => {
    container.appendChild(createSectionTitle('Geral'));
    container.appendChild(
      createTextInput({
        label: 'Título',
        key: 'title',
        placeholder: 'Ex: DirFluxoClienteLocalizado',
        state,
        onChange,
      }),
    );
    container.appendChild(
      createTextInput({
        label: 'Tags (buscar)',
        key: 'tags',
        placeholder: 'Ex: menu',
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
    container.appendChild(createSectionTitle('Direcionador'));
    container.appendChild(
      createTextInput({
        label: 'Bloco de destino',
        key: 'redirectTo',
        placeholder: 'Ex: FluxoClienteLocalizado ou ID',
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
      (matchLooseText(DESTINATION_PATHS, state.redirectTo) ||
        matchLooseText(REDIRECT_ROOT_PATHS, state.redirectTo))
    );
  },
};
