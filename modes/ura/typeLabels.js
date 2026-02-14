const normalizeTypeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const buildTypeLabelMap = (entries) => {
  const map = {};
  Object.entries(entries || {}).forEach(([key, label]) => {
    const normalized = normalizeTypeKey(key);
    if (normalized) map[normalized] = label;
  });
  return map;
};

export const TYPE_LABELS = buildTypeLabelMap({
  'Group': 'Grupo',
  'IvrAgentIA': 'Agente de IA',
  'IvrAPIV2': 'API',
  'IvrAudio': 'Áudio',
  'IvrCaptureAudioDTMF': 'Captura Áudio DTMF',
  'IvrConditional': 'Condicional',
  'IvrConditionalVariable': 'Condicional Variável',
  'IvrDeriveOmniService': 'Derivar Serviço Omni',
  'IvrLog': 'Log',
  'IvrNote': 'Anotação',
  'IvrRedirect': 'Redirecionar',
  'IvrTTSAudio': 'Áudio TTS',
  'IvrTurnOffCall': 'Desligar Chamada',
  'IvrVariableAssignment': 'Atribuição de Variável',
  'IvrAgentIAConversationSummary': 'Resumo da Conversação',
  'IvrAgentIAReturn': 'Retorno Agente de IA',
  'IvrAudioDTMF': 'Menu - Áudio',
  'IvrChatGPT': 'ChatGPT',
  'IvrCognitiveLira': 'Cognitivo Lira',
  'IvrCognitiveNama': 'Cognitivo Nama',
  'IvrDataOmniService': 'Dados Serviço Omni',
  'IvrDeriveQueueDS': 'Derivar Fila DS',
  'IvrDeriveToQueue': 'Derivar para Fila',
  'IvrHsm': 'WhatsApp HSM',
  'IvrTopdeskCheckTicket': 'Topdesk Consultar chamado',
  'IvrTopdeskCreateTicket': 'Topdesk Criar chamado',
  'IvrTopdeskOperatorGroup': 'Topdesk Grupo de Operadores',
  'IvrTopdeskRequesterValidation': 'Topdesk Validação do Solicitante',
  'IvrVoiceCognitiveChatGPTAudio': 'Áudio Cognitivo ChatGPT',
  'IvrVoiceCognitiveChatGPTTTS': 'TTS Cognitivo ChatGPT',
  'IvrVoiceToDigitalOmni': 'Voz para Digital Omni',
  'IvrVoiceTranscriptionAudio': 'Transcrição de voz - Áudio',
  'IvrVoiceTranscriptionTTS': 'Transcrição de voz - TTS',
  'IvrWebhookEndService': 'Webhook - final atendimento',
  'IvrZendeskCheckTicket': 'Zendesk Consultar chamado',
  'IvrZendeskCreateTicket': 'Zendesk Criar chamado',
  'IvrTransferCall': 'Transfer. Chamada',
  'IvrTransferCallBetweenOrganizationIvrs': 'Transferência entre URAs',
  'IvrTransferCallSipRefer': 'Transf. SIP REFER.',
  'IvrQueueDataDS': 'Dados Fila DS',
  'IvrTTSCaptureAudioDTMF': 'Captura variável - TTS',
  'IvrTTSAudioDTMF': 'Áudio - TTS',
  'IvrHsmCallbackServiceAbandonment': 'Callback Abandono HSM',
  'IvrSMS': 'SMS',
  'IvrMakeCall': 'Realizar Chamada',
  'IvrTimeConditional': 'Condicional de Tempo',
});

export const getTypeLabel = (type) => {
  const key = normalizeTypeKey(type);
  return TYPE_LABELS[key] ?? (type || 'Unknown');
};
