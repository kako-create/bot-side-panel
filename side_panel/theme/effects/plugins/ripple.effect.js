import { createPointerBus } from '../../input/pointerBus.js';

const CANVAS_ID = 'bot-sp-ripple-lake-canvas';
const SYSTEM_FPS = 30;
const FRAME_MS = 1000 / SYSTEM_FPS;

const MAX_RIPPLES = 16;
const DEFAULT_INTERVAL_MS = 5000;

let enabled = false;
let canvas = null;
let ctx = null;
let rafId = 0;
let ripples = [];

let width = 0;
let height = 0;
let lastFrameAt = 0;
let appearanceMode = 'dark';

let intervalId = 0;
let pointerBus = null;
let pointerUnsub = null;
let lastPointer = { x: 0, y: 0, at: 0 };

let visibilityListenerBound = false;
let resizeListenerBound = false;
let visibilityHandler = null;

const randomFloat = (min, span) => min + Math.random() * span;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseHexColor = (raw) => {
  const value = String(raw ?? '').trim();
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  const hex = match[1].toLowerCase();
  const expand = (c) => parseInt(c + c, 16);
  if (hex.length === 3) {
    return { r: expand(hex[0]), g: expand(hex[1]), b: expand(hex[2]) };
  }
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

const readCssVar = (name) => {
  try {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    return String(value ?? '').trim() || null;
  } catch {
    return null;
  }
};

const mix = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

const rgba = (c, a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${clamp(a, 0, 1)})`;

const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

const ensureCanvas = () => {
  if (canvas && ctx) return;
  canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.className = 'ripple-lake-canvas';
    document.body.prepend(canvas);
  }
  ctx = canvas.getContext('2d');
};

const resize = () => {
  if (!canvas || !ctx) return;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  width = Math.max(1, Math.floor(window.innerWidth));
  height = Math.max(1, Math.floor(window.innerHeight));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
};

const resolveColors = () => {
  const primary = parseHexColor(readCssVar('--color-primary')) || { r: 37, g: 99, b: 235 };
  const accent = parseHexColor(readCssVar('--color-accent')) || { r: 6, g: 182, b: 212 };
  const highlight = parseHexColor(readCssVar('--color-highlight')) || { r: 125, g: 211, b: 252 };
  const ring = mix(primary, accent, 0.45);
  const ring2 = mix(accent, highlight, 0.55);
  const drop = mix(highlight, primary, 0.5);

  // No modo claro, preferimos tons mais "frios" e discretos para nao atrapalhar a leitura.
  const baseAlpha = appearanceMode === 'light' ? 0.22 : 0.28;
  const shadowAlpha = appearanceMode === 'light' ? 0.10 : 0.14;
  return {
    ring,
    ring2,
    drop,
    baseAlpha,
    shadowAlpha,
  };
};

const createRipple = (x, y, { strength = 1 } = {}) => {
  const minDim = Math.min(width || window.innerWidth || 1, height || window.innerHeight || 1);
  const maxRadius = clamp(minDim * randomFloat(0.22, 0.22), 140, 320) * strength;
  const lifeMs = clamp(1100 + maxRadius * 2.1, 1100, 1900);
  const now = performance.now();
  return {
    x: clamp(x, 0, width || window.innerWidth || 1),
    y: clamp(y, 0, height || window.innerHeight || 1),
    startAt: now,
    lifeMs,
    maxRadius,
  };
};

const pushRipple = (x, y, options = {}) => {
  if (!enabled) return;
  ripples.push(createRipple(x, y, options));
  if (ripples.length > MAX_RIPPLES) {
    ripples = ripples.slice(ripples.length - MAX_RIPPLES);
  }
};

const getAutoDropPoint = () => {
  if (lastPointer.at) {
    return { x: lastPointer.x, y: lastPointer.y };
  }
  return { x: (width || window.innerWidth || 1) / 2, y: (height || window.innerHeight || 1) / 2 };
};

const drawRipple = (r, colors) => {
  const now = performance.now();
  const age = now - r.startAt;
  const t = clamp(age / r.lifeMs, 0, 1);
  const eased = easeOutCubic(t);
  const radius = r.maxRadius * eased;
  const alpha = (1 - t) * colors.baseAlpha;

  const ringWidth = clamp(2.2 - eased * 1.2, 0.8, 2.2);
  const ringGap = r.maxRadius * 0.18;

  ctx.save();
  ctx.lineWidth = ringWidth;
  ctx.shadowBlur = 10;
  ctx.shadowColor = rgba(colors.ring, colors.shadowAlpha);

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = rgba(colors.ring, 1);
  ctx.beginPath();
  ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.globalAlpha = alpha * 0.72;
  ctx.strokeStyle = rgba(colors.ring2, 1);
  ctx.beginPath();
  ctx.arc(r.x, r.y, Math.max(0, radius - ringGap), 0, Math.PI * 2);
  ctx.stroke();

  // "Gota" inicial (splash simples)
  if (t < 0.18) {
    const splashT = t / 0.18;
    const splashA = (1 - splashT) * (colors.baseAlpha + 0.12);
    ctx.globalAlpha = splashA;
    ctx.fillStyle = rgba(colors.drop, 1);
    ctx.beginPath();
    ctx.arc(r.x, r.y, clamp(6 - splashT * 4, 2, 6), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
};

const drawFrame = () => {
  if (!enabled || !ctx) return;
  ctx.clearRect(0, 0, width, height);
  if (ripples.length === 0) return;

  const colors = resolveColors();

  const now = performance.now();
  ripples = ripples.filter((r) => now - r.startAt <= r.lifeMs);
  for (const r of ripples) {
    drawRipple(r, colors);
  }
};

const tick = (timestamp) => {
  if (!enabled) return;
  if (document.hidden) {
    rafId = window.requestAnimationFrame(tick);
    return;
  }
  if (!lastFrameAt || timestamp - lastFrameAt >= FRAME_MS) {
    lastFrameAt = timestamp;
    drawFrame();
  }
  rafId = window.requestAnimationFrame(tick);
};

const bindListeners = () => {
  if (!resizeListenerBound) {
    window.addEventListener('resize', resize);
    resizeListenerBound = true;
  }
  if (!visibilityListenerBound) {
    visibilityHandler = () => {
      if (!enabled) return;
      if (!document.hidden) lastFrameAt = 0;
    };
    document.addEventListener('visibilitychange', visibilityHandler);
    visibilityListenerBound = true;
  }
};

const unbindListeners = () => {
  if (resizeListenerBound) {
    window.removeEventListener('resize', resize);
    resizeListenerBound = false;
  }
  if (visibilityListenerBound && visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
  }
  visibilityListenerBound = false;
  visibilityHandler = null;
};

const startPointer = () => {
  if (pointerBus) return;
  pointerBus = createPointerBus({ target: document });
  pointerUnsub = pointerBus.subscribe((msg) => {
    if (!enabled) return;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'move') {
      lastPointer = { x: msg.state?.x ?? lastPointer.x, y: msg.state?.y ?? lastPointer.y, at: Date.now() };
      return;
    }
    if (msg.type === 'down') {
      const x = msg.state?.x ?? 0;
      const y = msg.state?.y ?? 0;
      lastPointer = { x, y, at: Date.now() };
      pushRipple(x, y, { strength: 1 });
    }
  });
};

const stopPointer = () => {
  if (pointerUnsub) {
    try {
      pointerUnsub();
    } catch {
      // ignorar
    }
  }
  pointerUnsub = null;
  if (pointerBus) {
    try {
      pointerBus.stop();
    } catch {
      // ignorar
    }
  }
  pointerBus = null;
};

const startInterval = (intervalMs) => {
  const ms = clamp(Number(intervalMs) || DEFAULT_INTERVAL_MS, 500, 60_000);
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = 0;
  }
  intervalId = window.setInterval(() => {
    if (!enabled) return;
    const p = getAutoDropPoint();
    pushRipple(p.x, p.y, { strength: 0.95 });
  }, ms);
};

const stopInterval = () => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = 0;
};

const start = (config = {}) => {
  if (enabled) return;
  enabled = true;
  ensureCanvas();
  bindListeners();
  ripples = [];
  resize();
  lastFrameAt = 0;
  startPointer();
  startInterval(config.intervalMs);
  rafId = window.requestAnimationFrame(tick);
};

const stop = () => {
  if (!enabled) return;
  enabled = false;
  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }
  stopInterval();
  stopPointer();
  unbindListeners();
  if (canvas) canvas.remove();
  canvas = null;
  ctx = null;
  ripples = [];
};

const setEffectiveMode = (effectiveMode) => {
  const mode = String(effectiveMode ?? '').trim().toLowerCase();
  appearanceMode = mode === 'light' ? 'light' : 'dark';
};

const rippleEffect = {
  id: 'ripple',
  enable: ({ effectiveMode, config } = {}) => {
    setEffectiveMode(effectiveMode);
    start(config || {});
  },
  disable: ({ effectiveMode } = {}) => {
    setEffectiveMode(effectiveMode);
    stop();
  },
};

export default rippleEffect;
