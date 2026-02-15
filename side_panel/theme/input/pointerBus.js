const createState = () => ({
  x: 0,
  y: 0,
  pointerId: null,
  pointerType: null,
  buttons: 0,
  isPrimary: false,
  inside: true,
  timeStamp: 0,
});

const toPointerSnapshot = (event, fallback = {}) => {
  if (!event) return fallback;
  return {
    x: Number(event.clientX) || 0,
    y: Number(event.clientY) || 0,
    pointerId: Number.isFinite(event.pointerId) ? event.pointerId : fallback.pointerId ?? null,
    pointerType: event.pointerType || fallback.pointerType || null,
    buttons: Number.isFinite(event.buttons) ? event.buttons : fallback.buttons ?? 0,
    isPrimary: Boolean(event.isPrimary),
    timeStamp: Number(event.timeStamp) || Date.now(),
  };
};

export const createPointerBus = ({ target: initialTarget } = {}) => {
  /** @type {EventTarget | null} */
  let target = initialTarget || (typeof document !== 'undefined' ? document : null);

  const subscribers = new Set();
  let listening = false;
  let rafId = 0;
  let moveQueued = false;
  let lastMoveEvent = null;
  let state = createState();

  const notify = (type, event) => {
    if (subscribers.size === 0) return;
    const snapshot = { ...state };
    for (const handler of subscribers) {
      try {
        handler({ type, event, state: snapshot });
      } catch {
        // ignorar
      }
    }
  };

  const flushMove = () => {
    rafId = 0;
    moveQueued = false;
    const event = lastMoveEvent;
    lastMoveEvent = null;
    if (!event) return;
    const next = toPointerSnapshot(event, state);
    state = { ...state, ...next };
    notify('move', event);
  };

  const onMove = (event) => {
    lastMoveEvent = event;
    if (moveQueued) return;
    moveQueued = true;
    rafId = window.requestAnimationFrame(flushMove);
  };

  const onEnter = (event) => {
    state = { ...state, ...toPointerSnapshot(event, state), inside: true };
    notify('enter', event);
  };

  const onLeave = (event) => {
    state = { ...state, ...toPointerSnapshot(event, state), inside: false };
    notify('leave', event);
  };

  const onDown = (event) => {
    state = { ...state, ...toPointerSnapshot(event, state) };
    notify('down', event);
  };

  const onUp = (event) => {
    state = { ...state, ...toPointerSnapshot(event, state) };
    notify('up', event);
  };

  const onCancel = (event) => {
    state = { ...state, ...toPointerSnapshot(event, state) };
    notify('cancel', event);
  };

  const bind = () => {
    if (listening || !target) return;
    listening = true;
    target.addEventListener('pointermove', onMove, { passive: true });
    target.addEventListener('pointerdown', onDown, { passive: true });
    target.addEventListener('pointerup', onUp, { passive: true });
    target.addEventListener('pointercancel', onCancel, { passive: true });
    // pointerenter/leave nao propagam (bubble); usamos over/out como aproximacao de melhor esforco.
    target.addEventListener('pointerover', onEnter, { passive: true });
    target.addEventListener('pointerout', onLeave, { passive: true });
  };

  const unbind = () => {
    if (!listening || !target) return;
    listening = false;
    target.removeEventListener('pointermove', onMove, { passive: true });
    target.removeEventListener('pointerdown', onDown, { passive: true });
    target.removeEventListener('pointerup', onUp, { passive: true });
    target.removeEventListener('pointercancel', onCancel, { passive: true });
    target.removeEventListener('pointerover', onEnter, { passive: true });
    target.removeEventListener('pointerout', onLeave, { passive: true });
  };

  const stop = () => {
    unbind();
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    moveQueued = false;
    lastMoveEvent = null;
  };

  const start = () => {
    if (subscribers.size === 0) return;
    bind();
  };

  const setTarget = (nextTarget) => {
    if (nextTarget === target) return;
    const wasListening = listening;
    stop();
    target = nextTarget || null;
    if (wasListening) start();
  };

  const subscribe = (handler) => {
    if (typeof handler !== 'function') return () => {};
    subscribers.add(handler);
    if (subscribers.size === 1) start();
    return () => {
      subscribers.delete(handler);
      if (subscribers.size === 0) stop();
    };
  };

  return {
    subscribe,
    start,
    stop,
    setTarget,
    getState: () => ({ ...state }),
    getSubscriberCount: () => subscribers.size,
  };
};
