import { screenConsulta } from './consulta.js';
import { screenVariaveis } from './variaveis.js';
import { screenTags } from './tags.js';
import { screenIa } from './ia.js';
import { screenFuncoes } from './funcoes.js';
import { screenComparacao } from './comparacao.js';
import { screenArmazenamento } from './armazenamento.js';
import { screenAcessoRapido } from './acessoRapido.js';
import { screenConfiguracoes } from './configuracoes.js';
import { screenDebug } from './debug.js';

export const screens = [
  screenConsulta,
  screenVariaveis,
  screenTags,
  screenIa,
  screenFuncoes,
  screenComparacao,
  screenArmazenamento,
  screenAcessoRapido,
  screenConfiguracoes,
  screenDebug,
];

export const getScreenById = (id) => screens.find((screen) => screen.id === id) ?? null;
