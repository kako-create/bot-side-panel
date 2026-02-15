import { getEffectAdapter } from './registry.js';

const normalizeDescriptor = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const id = value.trim();
    return id ? { id } : null;
  }
  if (typeof value === 'object') {
    const id = String(value.id ?? '').trim();
    if (!id) return null;
    return { id, config: value.config };
  }
  return null;
};

export const createEffectManager = () => {
  /** @type {null | { id: string }} */
  let active = null;

  const disableActive = (ctx) => {
    if (!active) return;
    const adapter = getEffectAdapter(active.id);
    if (adapter && typeof adapter.disable === 'function') {
      try {
        adapter.disable(ctx);
      } catch {
        // ignorar
      }
    }
    active = null;
  };

  return {
    /**
     * Aplica uma lista de efeitos desejados.
     *
     * Nota de paridade: a UI legada sempre teve, no maximo, 1 efeito ativo.
     * Por enquanto mantemos esse comportamento e ativamos apenas o primeiro descritor valido.
     */
    apply: (effects = [], ctx = {}) => {
      const list = Array.isArray(effects) ? effects : [];
      const first = normalizeDescriptor(list[0]);
      const nextId = first?.id ?? null;

      if (!nextId) {
        disableActive(ctx);
        return;
      }

      const adapter = getEffectAdapter(nextId);
      if (!adapter || typeof adapter.enable !== 'function') {
        // ID de efeito desconhecido: por seguranca, desativa qualquer efeito ativo.
        disableActive(ctx);
        return;
      }

      if (active && active.id !== nextId) {
        disableActive(ctx);
      }

      active = { id: nextId };
      adapter.enable({ ...ctx, config: first.config });
    },
    disableAll: (ctx = {}) => {
      disableActive(ctx);
    },
    getActiveEffectId: () => active?.id ?? null,
  };
};

export const effectManager = createEffectManager();
