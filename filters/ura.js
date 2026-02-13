import { ivrAgentIAFilterConfig } from './types/ura/ivrAgentIA.js';
import { ivrApiV2FilterConfig } from './types/ura/ivrApiV2.js';
import { ivrAudioFilterConfig } from './types/ura/ivrAudio.js';
import { ivrConditionalFilterConfig } from './types/ura/ivrConditional.js';
import { ivrConditionalVariableFilterConfig } from './types/ura/ivrConditionalVariable.js';
import { ivrDeriveOmniServiceFilterConfig } from './types/ura/ivrDeriveOmniService.js';
import { ivrRedirectFilterConfig } from './types/ura/ivrRedirect.js';
import { ivrTTSCaptureAudioDTMFFilterConfig } from './types/ura/ivrTTSCaptureAudioDTMF.js';
import { ivrTTSAudioFilterConfig } from './types/ura/ivrTTSAudio.js';
import { ivrVariableAssignmentFilterConfig } from './types/ura/ivrVariableAssignment.js';

export const uraSpecificFilterConfigsByType = {
  ivrapiv2: ivrApiV2FilterConfig,
  IvrAPIV2: ivrApiV2FilterConfig,
  IvrApiV2: ivrApiV2FilterConfig,
  API: ivrApiV2FilterConfig,
  Api: ivrApiV2FilterConfig,
  IvrAudio: ivrAudioFilterConfig,
  Audio: ivrAudioFilterConfig,
  Áudio: ivrAudioFilterConfig,
  IvrConditional: ivrConditionalFilterConfig,
  IvrConditionalVariable: ivrConditionalVariableFilterConfig,
  Condicional: ivrConditionalFilterConfig,
  'Condicional Variável': ivrConditionalVariableFilterConfig,
  'Condicional variável': ivrConditionalVariableFilterConfig,
  IvrDeriveOmniService: ivrDeriveOmniServiceFilterConfig,
  'Derivar Serviço Omni': ivrDeriveOmniServiceFilterConfig,
  'Derivar Servico Omni': ivrDeriveOmniServiceFilterConfig,
  IvrRedirect: ivrRedirectFilterConfig,
  Redirecionar: ivrRedirectFilterConfig,
  Direcionador: ivrRedirectFilterConfig,
  Redirect: ivrRedirectFilterConfig,
  IvrTTSCaptureAudioDTMF: ivrTTSCaptureAudioDTMFFilterConfig,
  IvrCaptureAudioDTMF: ivrTTSCaptureAudioDTMFFilterConfig,
  'Captura variável - TTS': ivrTTSCaptureAudioDTMFFilterConfig,
  'Captura variável - Áudio': ivrTTSCaptureAudioDTMFFilterConfig,
  'Captura váriavel - Áudio': ivrTTSCaptureAudioDTMFFilterConfig,
  'Captura Áudio DTMF': ivrTTSCaptureAudioDTMFFilterConfig,
  IvrTTSAudio: ivrTTSAudioFilterConfig,
  IvrTtsAudio: ivrTTSAudioFilterConfig,
  'Áudio TTS': ivrTTSAudioFilterConfig,
  'Audio TTS': ivrTTSAudioFilterConfig,
  IvrAgentIA: ivrAgentIAFilterConfig,
  'Agente de IA': ivrAgentIAFilterConfig,
  IvrVariableAssignment: ivrVariableAssignmentFilterConfig,
  'Atribuição de Variável': ivrVariableAssignmentFilterConfig,
  'Atribuição de variável': ivrVariableAssignmentFilterConfig,
};
