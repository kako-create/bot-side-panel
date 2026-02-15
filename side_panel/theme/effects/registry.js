import confettiEffect from './plugins/confetti.effect.js';
import matrixEffect from './plugins/matrix.effect.js';

export const EFFECT_REGISTRY = Object.freeze({
  matrix: matrixEffect,
  confetti: confettiEffect,
});

export const getEffectAdapter = (effectId) => {
  const key = String(effectId ?? '').trim();
  return EFFECT_REGISTRY[key] || null;
};
