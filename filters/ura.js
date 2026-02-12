import { ivrAgentIAFilterConfig } from './types/ura/ivrAgentIA.js';
import { ivrVariableAssignmentFilterConfig } from './types/ura/ivrVariableAssignment.js';

export const uraSpecificFilterConfigsByType = {
  IvrAgentIA: ivrAgentIAFilterConfig,
  'Agente de IA': ivrAgentIAFilterConfig,
  IvrVariableAssignment: ivrVariableAssignmentFilterConfig,
  'Atribuição de Variável': ivrVariableAssignmentFilterConfig,
  'Atribuição de variável': ivrVariableAssignmentFilterConfig,
};
