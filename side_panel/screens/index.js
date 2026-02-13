import { screenConsulta } from './consulta.js';
import { screenVariaveis } from './variaveis.js';
import { screenTags } from './tags.js';
import { screenComparacao } from './comparacao.js';
import { screenArmazenamento } from './armazenamento.js';

export const screens = [screenConsulta, screenVariaveis, screenTags, screenComparacao, screenArmazenamento];

export const getScreenById = (id) => screens.find((screen) => screen.id === id) ?? null;
