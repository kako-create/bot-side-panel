import {
  createBooleanSelect,
  createDivider,
  createMatchHelpers,
  createSectionTitle,
  createTextInput,
} from '../../helpers.js';

const appendSection = (container, title) => {
  if (container.childElementCount > 0) container.appendChild(createDivider());
  container.appendChild(createSectionTitle(title));
};

const appendBoolean = (container, state, onChange, { label, key }) => {
  container.appendChild(
    createBooleanSelect({
      label,
      key,
      state,
      onChange,
    }),
  );
};

const appendText = (
  container,
  state,
  onChange,
  { label, key, placeholder, allowBlank, allowFilled },
) => {
  container.appendChild(
    createTextInput({
      label,
      key,
      placeholder,
      state,
      onChange,
      allowBlank,
      allowFilled,
    }),
  );
};

const renderGeneralFields = ({ container, state, onChange }) => {
  appendSection(container, 'Geral');
  appendBoolean(container, state, onChange, {
    label: 'Checkpoint',
    key: 'checkpoint',
  });

  appendSection(container, 'Tags');
  appendText(container, state, onChange, {
    label: 'Tags (buscar)',
    key: 'tags',
    placeholder: 'Ex: Topdesk',
  });

  appendSection(container, 'Variáveis');
  appendText(container, state, onChange, {
    label: 'Variável utilizada',
    key: 'variableReference',
    placeholder: 'Ex: {topdesk.ticket.number}',
    allowBlank: false,
    allowFilled: false,
  });
};

const renderTopdeskSettings = (
  { container, state, onChange },
  { includeLogin = true } = {},
) => {
  appendSection(container, 'Configurações TOPdesk');
  appendBoolean(container, state, onChange, {
    label: 'Autenticação TOPdesk',
    key: 'hasTopdeskAuthentication',
  });
  appendBoolean(container, state, onChange, {
    label: 'Usar Manager API',
    key: 'useManagerApi',
  });
  appendBoolean(container, state, onChange, {
    label: 'Invisível para o chamador',
    key: 'invisibleForCaller',
  });
  if (includeLogin) {
    appendText(container, state, onChange, {
      label: 'Login',
      key: 'login',
      placeholder: 'Buscar login ou variável',
    });
  }
};

const renderCustomFields = ({ container, state, onChange }) => {
  appendSection(container, 'Campos customizados');
  appendText(container, state, onChange, {
    label: 'Campo da API',
    key: 'customFieldApiField',
    placeholder: 'Ex: processingStatus.name',
  });
  appendText(container, state, onChange, {
    label: 'Variável / valor mapeado',
    key: 'customFieldVariable',
    placeholder: 'Buscar variável ou valor',
  });
};

const renderFlowFields = ({ container, state, onChange }) => {
  appendSection(container, 'Escape e erro');
  appendText(container, state, onChange, {
    label: 'Rota de fuga (conditionEscape)',
    key: 'conditionEscape',
    placeholder: 'Buscar ID do bloco',
  });
  appendBoolean(container, state, onChange, {
    label: 'Ativar último checkpoint',
    key: 'redirectToCheckpoint',
  });
  appendText(container, state, onChange, {
    label: 'Mensagem de finalização',
    key: 'errorMessageFinal',
    placeholder: 'Buscar mensagem de erro',
  });

  appendSection(container, 'Descrição do evento');
  appendBoolean(container, state, onChange, {
    label: 'Adicionar descrição de evento',
    key: 'eventDescriptionActive',
  });
  appendText(container, state, onChange, {
    label: 'Descrição do evento',
    key: 'eventDescriptionText',
    placeholder: 'Buscar na descrição',
  });
};

const matchesCommonFields = (matchers, state) =>
  matchers.matchBoolean('checkpoint', state.checkpoint) &&
  matchers.matchText('tags', state.tags) &&
  matchers.matchText('conditionEscape', state.conditionEscape) &&
  matchers.matchBoolean('redirectToCheckpoint', state.redirectToCheckpoint) &&
  matchers.matchText('errorMessageFinal', state.errorMessageFinal) &&
  matchers.matchBoolean('eventDescription.active', state.eventDescriptionActive) &&
  matchers.matchText('eventDescription.description', state.eventDescriptionText);

const matchesVariableReference = (matchers, state, topdeskPaths = []) =>
  matchers.matchTextAny(
    [
      ...topdeskPaths,
      'errorMessageFinal',
      'eventDescription.description',
    ],
    state.variableReference,
  );

const matchesTopdeskSettings = (matchers, state, { includeLogin = true } = {}) =>
  matchers.matchBoolean(
    'topdesk.hasTopdeskAuthentication',
    state.hasTopdeskAuthentication,
  ) &&
  matchers.matchBoolean('topdesk.useManagerApi', state.useManagerApi) &&
  matchers.matchBoolean('topdesk.invisibleForCaller', state.invisibleForCaller) &&
  (!includeLogin || matchers.matchText('topdesk.login', state.login));

export const topdeskCreateTicketFilterConfig = {
  type: 'TopdeskCreateTicket',
  label: 'TopdeskCreateTicket',
  render: (context) => {
    const { container, state, onChange } = context;
    renderGeneralFields(context);
    renderTopdeskSettings(context);

    appendSection(container, 'Solicitante');
    appendText(container, state, onChange, {
      label: 'ID do solicitante / variável',
      key: 'requesterId',
      placeholder: 'Ex: {topdesk.requesterId}',
    });
    appendText(container, state, onChange, {
      label: 'Nome do cliente',
      key: 'clientName',
      placeholder: 'Buscar nome ou variável',
    });
    appendText(container, state, onChange, {
      label: 'Telefone',
      key: 'phoneNumber',
      placeholder: 'Buscar telefone ou variável',
    });
    appendText(container, state, onChange, {
      label: 'E-mail',
      key: 'email',
      placeholder: 'Buscar e-mail ou variável',
    });

    appendSection(container, 'Chamado');
    appendText(container, state, onChange, {
      label: 'Título do chamado',
      key: 'ticketTitle',
      placeholder: 'Buscar no título',
    });
    appendText(container, state, onChange, {
      label: 'Descrição do chamado',
      key: 'ticketDescription',
      placeholder: 'Buscar na descrição',
    });
    appendText(container, state, onChange, {
      label: 'Grupo de operadores (ID)',
      key: 'operatorsGroupId',
      placeholder: 'Buscar ID ou variável',
    });
    appendText(container, state, onChange, {
      label: 'Categoria (ID)',
      key: 'categoryId',
      placeholder: 'Buscar ID ou variável',
    });
    appendText(container, state, onChange, {
      label: 'Subcategoria (ID)',
      key: 'subCategoryId',
      placeholder: 'Buscar ID ou variável',
    });
    appendText(container, state, onChange, {
      label: 'Tipo de incidente (ID)',
      key: 'callTypeId',
      placeholder: 'Buscar ID ou variável',
    });
    appendText(container, state, onChange, {
      label: 'Tipo de registro (ID)',
      key: 'entryTypeId',
      placeholder: 'Buscar ID ou variável',
    });

    renderCustomFields(context);
    renderFlowFields(context);
  },
  match: (item, state, helpers) => {
    const matchers = createMatchHelpers(item, helpers);

    return (
      matchesCommonFields(matchers, state) &&
      matchesTopdeskSettings(matchers, state) &&
      matchesVariableReference(matchers, state, [
        'topdesk.login',
        'topdesk.requesterId',
        'topdesk.clientName',
        'topdesk.phoneNumber',
        'topdesk.email',
        'topdesk.ticketTitle',
        'topdesk.ticketDescription',
        'topdesk.operatorsGroupId',
        'topdesk.categoryId',
        'topdesk.subCategoryId',
        'topdesk.callTypeId',
        'topdesk.entryTypeId',
        'topdesk.customFields.apiField',
        'topdesk.customFields.variable',
      ]) &&
      matchers.matchText('topdesk.requesterId', state.requesterId) &&
      matchers.matchText('topdesk.clientName', state.clientName) &&
      matchers.matchText('topdesk.phoneNumber', state.phoneNumber) &&
      matchers.matchText('topdesk.email', state.email) &&
      matchers.matchText('topdesk.ticketTitle', state.ticketTitle) &&
      matchers.matchText('topdesk.ticketDescription', state.ticketDescription) &&
      matchers.matchText('topdesk.operatorsGroupId', state.operatorsGroupId) &&
      matchers.matchText('topdesk.categoryId', state.categoryId) &&
      matchers.matchText('topdesk.subCategoryId', state.subCategoryId) &&
      matchers.matchText('topdesk.callTypeId', state.callTypeId) &&
      matchers.matchText('topdesk.entryTypeId', state.entryTypeId) &&
      matchers.matchText('topdesk.customFields.apiField', state.customFieldApiField) &&
      matchers.matchText('topdesk.customFields.variable', state.customFieldVariable)
    );
  },
};

export const topdeskInsertAttachmentFilterConfig = {
  type: 'TopdeskInsertAttachment',
  label: 'TopdeskInsertAttachment',
  render: (context) => {
    const { container, state, onChange } = context;
    renderGeneralFields(context);
    renderTopdeskSettings(context);

    appendSection(container, 'Anexo');
    appendText(container, state, onChange, {
      label: 'Número do chamado / variável',
      key: 'ticketNumber',
      placeholder: 'Buscar número ou variável',
    });
    appendText(container, state, onChange, {
      label: 'ID do solicitante / variável',
      key: 'requesterId',
      placeholder: 'Ex: {topdesk.requesterId}',
    });

    renderCustomFields(context);
    renderFlowFields(context);
  },
  match: (item, state, helpers) => {
    const matchers = createMatchHelpers(item, helpers);

    return (
      matchesCommonFields(matchers, state) &&
      matchesTopdeskSettings(matchers, state) &&
      matchesVariableReference(matchers, state, [
        'topdesk.login',
        'topdesk.ticketNumber',
        'topdesk.requesterId',
        'topdesk.customFields.apiField',
        'topdesk.customFields.variable',
      ]) &&
      matchers.matchText('topdesk.ticketNumber', state.ticketNumber) &&
      matchers.matchText('topdesk.requesterId', state.requesterId) &&
      matchers.matchText('topdesk.customFields.apiField', state.customFieldApiField) &&
      matchers.matchText('topdesk.customFields.variable', state.customFieldVariable)
    );
  },
};

export const topdeskRequesterValidationFilterConfig = {
  type: 'TopdeskRequesterValidation',
  label: 'TopdeskRequesterValidation',
  render: (context) => {
    const { container, state, onChange } = context;
    renderGeneralFields(context);
    renderTopdeskSettings(context, { includeLogin: false });

    appendSection(container, 'Validação do solicitante');
    appendText(container, state, onChange, {
      label: 'Campo da API / referência',
      key: 'apiField',
      placeholder: 'Buscar campo da API',
    });
    appendText(container, state, onChange, {
      label: 'Valor de validação / variável',
      key: 'validationValue',
      placeholder: 'Buscar valor ou variável',
    });

    renderCustomFields(context);
    renderFlowFields(context);
  },
  match: (item, state, helpers) => {
    const matchers = createMatchHelpers(item, helpers);

    return (
      matchesCommonFields(matchers, state) &&
      matchesTopdeskSettings(matchers, state, { includeLogin: false }) &&
      matchesVariableReference(matchers, state, [
        'topdesk.apiField',
        'topdesk.validationValue',
        'topdesk.customFields.apiField',
        'topdesk.customFields.variable',
      ]) &&
      matchers.matchText('topdesk.apiField', state.apiField) &&
      matchers.matchText('topdesk.validationValue', state.validationValue) &&
      matchers.matchText('topdesk.customFields.apiField', state.customFieldApiField) &&
      matchers.matchText('topdesk.customFields.variable', state.customFieldVariable)
    );
  },
};
