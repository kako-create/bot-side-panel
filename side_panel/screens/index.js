import { screenConsulta } from './consulta.js';
import { screenVariaveis } from './variaveis.js';
import { screenTags } from './tags.js';
import { screenArmazenamento } from './armazenamento.js';

export const screens = [screenConsulta, screenVariaveis, screenTags, screenArmazenamento];

export const getScreenById = (id) => screens.find((screen) => screen.id === id) ?? null;
