const CANVAS_ID = 'bot-sp-matrix-rain-canvas';
const SYSTEM_FPS = 30;
const FRAME_MS = 1000 / SYSTEM_FPS;
const FONT_SIZE = 12;
const COLUMN_STEP_FACTOR = 0.78;
const MIN_SPEED = 0.85;
const SPEED_SPAN = 1.6;
const MIN_INTERVAL = 0.35;
const INTERVAL_SPAN = 1.15;
const SYMBOLS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01ABCDEFGHIJKLMNOPQRSTUVWXYZ';

let enabled = false;
let canvas = null;
let ctx = null;
let rafId = 0;
let columns = [];
let fontSize = FONT_SIZE;
let columnStep = Math.max(1, Math.round(FONT_SIZE * COLUMN_STEP_FACTOR));
let width = 0;
let height = 0;
let rows = 0;
let lastFrameAt = 0;
let appearanceMode = 'dark';
let visibilityListenerBound = false;
let resizeListenerBound = false;
let visibilityHandler = null;

const randomInt = (max) => Math.floor(Math.random() * Math.max(1, max));
const randomFloat = (min, span) => min + Math.random() * span;

const createColumn = () => ({
  y: Math.random() * rows,
  speed: randomFloat(MIN_SPEED, SPEED_SPAN),
  interval: randomFloat(MIN_INTERVAL, INTERVAL_SPAN),
  tick: Math.random() * 2,
});

const pickSymbol = () => SYMBOLS[randomInt(SYMBOLS.length)];

const resolvePalette = () => {
  if (appearanceMode === 'light') {
    return {
      fade: 'rgba(247, 250, 252, 0.06)',
      text: 'rgba(16, 122, 58, 0.72)',
      lead: 'rgba(58, 170, 85, 0.92)',
      glow: 'rgba(97, 185, 118, 0.16)',
    };
  }
  return {
    fade: 'rgba(8, 16, 12, 0.12)',
    text: 'rgba(72, 255, 118, 0.68)',
    lead: 'rgba(201, 255, 214, 0.95)',
    glow: 'rgba(81, 247, 129, 0.22)',
  };
};

const ensureCanvas = () => {
  if (canvas && ctx) return;
  canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.className = 'matrix-rain-canvas';
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
  fontSize = FONT_SIZE;
  columnStep = Math.max(1, Math.round(fontSize * COLUMN_STEP_FACTOR));
  ctx.font = `${fontSize}px monospace`;
  ctx.textBaseline = 'top';
  rows = Math.ceil(height / fontSize) + 2;
  const columnsCount = Math.ceil(width / columnStep) + 1;
  columns = Array.from({ length: columnsCount }, () => createColumn());
  ctx.clearRect(0, 0, width, height);
};

const drawFrame = () => {
  if (!enabled || !ctx) return;
  const palette = resolvePalette();

  ctx.fillStyle = palette.fade;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.shadowBlur = 7;
  ctx.shadowColor = palette.glow;

  for (let idx = 0; idx < columns.length; idx += 1) {
    const col = columns[idx];
    col.tick += col.speed;
    if (col.tick < col.interval) continue;

    col.tick = 0;
    const x = idx * columnStep;
    const y = col.y * fontSize;
    const burst = Math.random() > 0.74 ? 2 : 1;
    for (let burstIdx = 0; burstIdx < burst; burstIdx += 1) {
      const symbol = pickSymbol();
      const yPos = y - burstIdx * fontSize * 0.9;
      ctx.fillStyle = burstIdx === 0 && Math.random() > 0.88 ? palette.lead : palette.text;
      ctx.fillText(symbol, x, yPos);
    }

    col.y += col.speed;
    if (col.y > rows + randomInt(12)) {
      col.y = -randomInt(22);
      col.speed = randomFloat(MIN_SPEED, SPEED_SPAN);
      col.interval = randomFloat(MIN_INTERVAL, INTERVAL_SPAN);
    }
  }
  ctx.restore();
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

const start = () => {
  if (enabled) return;
  enabled = true;
  ensureCanvas();
  bindListeners();
  resize();
  lastFrameAt = 0;
  rafId = window.requestAnimationFrame(tick);
};

const stop = () => {
  if (!enabled) return;
  enabled = false;
  if (rafId) {
    window.cancelAnimationFrame(rafId);
    rafId = 0;
  }
  unbindListeners();
  if (canvas) {
    canvas.remove();
  }
  canvas = null;
  ctx = null;
  columns = [];
};

const setEffectiveMode = (effectiveMode) => {
  const mode = String(effectiveMode ?? '').trim().toLowerCase();
  appearanceMode = mode === 'light' ? 'light' : 'dark';
};

const matrixEffect = {
  id: 'matrix',
  enable: ({ effectiveMode } = {}) => {
    setEffectiveMode(effectiveMode);
    start();
  },
  disable: ({ effectiveMode } = {}) => {
    setEffectiveMode(effectiveMode);
    stop();
  },
};

export default matrixEffect;

