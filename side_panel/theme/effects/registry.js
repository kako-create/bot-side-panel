import confettiEffect from './plugins/confetti.effect.js';
import matrixEffect from './plugins/matrix.effect.js';
import rippleEffect from './plugins/ripple.effect.js';

export const EFFECT_REGISTRY = Object.freeze({
  matrix: matrixEffect,
  confetti: confettiEffect,
  ripple: rippleEffect,
});

export const getEffectAdapter = (effectId) => {
  const key = String(effectId ?? '').trim();
  return EFFECT_REGISTRY[key] || null;
};
