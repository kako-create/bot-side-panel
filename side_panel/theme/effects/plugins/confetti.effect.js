const CANVAS_ID = 'bot-sp-confetti-rain-canvas';
const SYSTEM_FPS = 30;
const FRAME_MS = 1000 / SYSTEM_FPS;

const MIN_PIECES = 32;
const MAX_PIECES = 140;
const PIECE_DENSITY = 9000; // lower = more confetti

let enabled = false;
let canvas = null;
let ctx = null;
let rafId = 0;
let pieces = [];
let width = 0;
let height = 0;
let lastFrameAt = 0;
let appearanceMode = 'dark';
let visibilityListenerBound = false;
let resizeListenerBound = false;
let visibilityHandler = null;

let wind = 0;
let windTarget = 0;
let windTimer = 0;
let palette = [];

const randomInt = (max) => Math.floor(Math.random() * Math.max(1, max));
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

const mix = (a, b, t) => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

const rgb = (c) => `rgb(${c.r}, ${c.g}, ${c.b})`;

const readCssVar = (name) => {
  try {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    return String(value ?? '').trim() || null;
  } catch {
    return null;
  }
};

const resolvePalette = () => {
  // Usa as cores do preset Confete como fallback se as CSS vars estiverem ausentes.
  const primary = parseHexColor(readCssVar('--color-primary')) || { r: 77, g: 122, b: 255 };
  const accent = parseHexColor(readCssVar('--color-accent')) || { r: 255, g: 111, b: 165 };
  const highlight = parseHexColor(readCssVar('--color-highlight')) || { r: 255, g: 213, b: 74 };

  const extras = [
    mix(primary, accent, 0.5),
    mix(accent, highlight, 0.55),
    mix(primary, highlight, 0.52),
    mix(primary, accent, 0.25),
    mix(accent, highlight, 0.25),
  ];

  const unique = new Map();
  [primary, accent, highlight, ...extras].forEach((c) => {
    unique.set(`${c.r},${c.g},${c.b}`, c);
  });
  palette = Array.from(unique.values()).map((c) => ({ ...c, fill: rgb(c) }));
};

const ensureCanvas = () => {
  if (canvas && ctx) return;
  canvas = document.getElementById(CANVAS_ID);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = CANVAS_ID;
    canvas.className = 'confetti-rain-canvas';
    document.body.prepend(canvas);
  }
  ctx = canvas.getContext('2d');
};

const createPiece = ({ spawnAbove = true } = {}) => {
  const size = randomFloat(6, 12);
  const w = size * randomFloat(0.75, 1.05);
  const h = size * randomFloat(0.55, 1.25);
  const shapeRoll = Math.random();
  const shape = shapeRoll > 0.88 ? 'circle' : shapeRoll > 0.72 ? 'ribbon' : 'rect';
  const color = palette.length ? palette[randomInt(palette.length)] : { fill: 'rgb(255, 111, 165)' };

  const baseAlpha = appearanceMode === 'light' ? randomFloat(0.45, 0.30) : randomFloat(0.55, 0.30);
  const vy = randomFloat(55, 140);
  const vx = randomFloat(-18, 36);
  const swingAmp = randomFloat(10, 26);
  const swingSpeed = randomFloat(1.4, 2.8);
  const rotation = randomFloat(0, Math.PI * 2);
  const rotationSpeed = randomFloat(-3.2, 6.2);
  const flipPhase = randomFloat(0, Math.PI * 2);

  return {
    x: randomFloat(-width * 0.1, width * 1.2),
    y: spawnAbove ? randomFloat(-height, height) : randomFloat(-40, height + 40),
    vx,
    vy,
    swingAmp,
    swingSpeed,
    swingPhase: randomFloat(0, Math.PI * 2),
    rotation,
    rotationSpeed,
    flipPhase,
    w,
    h,
    shape,
    fill: color.fill,
    baseAlpha,
  };
};

const resize = () => {
  if (!canvas || !ctx) return;
  resolvePalette();

  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  width = Math.max(1, Math.floor(window.innerWidth));
  height = Math.max(1, Math.floor(window.innerHeight));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const targetCount = clamp(Math.floor((width * height) / PIECE_DENSITY), MIN_PIECES, MAX_PIECES);
  if (pieces.length < targetCount) {
    const toAdd = targetCount - pieces.length;
    for (let i = 0; i < toAdd; i += 1) pieces.push(createPiece({ spawnAbove: false }));
  } else if (pieces.length > targetCount) {
    pieces = pieces.slice(0, targetCount);
  }

  // Mantem as particulas dentro dos limites apos um resize.
  for (const piece of pieces) {
    if (!piece) continue;
    if (piece.x > width + 140 || piece.x < -140) piece.x = randomFloat(-width * 0.1, width * 1.2);
  }
};

const updateWind = (dt) => {
  windTimer -= dt;
  if (windTimer <= 0) {
    windTarget = randomFloat(-28, 70);
    windTimer = randomFloat(1.8, 2.8);
  }
  wind += (windTarget - wind) * Math.min(1, dt * 0.6);
  wind *= 0.995;
};

const step = (dt, t) => {
  updateWind(dt);

  for (const piece of pieces) {
    piece.y += piece.vy * dt;
    piece.x += (piece.vx + wind) * dt;
    piece.swingPhase += piece.swingSpeed * dt;
    piece.rotation += piece.rotationSpeed * dt;

    if (piece.y > height + 70 || piece.x < -180 || piece.x > width + 180) {
      const next = createPiece({ spawnAbove: true });
      piece.x = next.x;
      piece.y = -randomFloat(10, height * 0.25);
      piece.vx = next.vx;
      piece.vy = next.vy;
      piece.swingAmp = next.swingAmp;
      piece.swingSpeed = next.swingSpeed;
      piece.swingPhase = next.swingPhase;
      piece.rotation = next.rotation;
      piece.rotationSpeed = next.rotationSpeed;
      piece.flipPhase = next.flipPhase;
      piece.w = next.w;
      piece.h = next.h;
      piece.shape = next.shape;
      piece.fill = next.fill;
      piece.baseAlpha = next.baseAlpha;
    }
  }
};

const drawFrame = (t) => {
  if (!enabled || !ctx) return;
  ctx.clearRect(0, 0, width, height);

  // Reduz levemente a opacidade no modo claro para manter a legibilidade.
  const globalBoost = appearanceMode === 'light' ? 0.85 : 1;

  for (const piece of pieces) {
    const wobbleX = Math.sin(piece.swingPhase) * piece.swingAmp;
    const wobbleY = Math.cos(piece.swingPhase * 0.6) * (piece.swingAmp * 0.12);
    const x = piece.x + wobbleX;
    const y = piece.y + wobbleY;

    const flip = Math.abs(Math.cos(piece.rotation + piece.flipPhase));
    const alpha = piece.baseAlpha * (0.55 + 0.45 * flip) * globalBoost;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(piece.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = piece.fill;

    if (piece.shape === 'circle') {
      const r = Math.max(2, Math.min(10, (piece.w + piece.h) * 0.25));
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (piece.shape === 'ribbon') {
      // Poligono simples de fita para dar mais movimento.
      const w = piece.w * 1.25;
      const h = piece.h * 0.9;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.35);
      ctx.lineTo(w * 0.5, -h * 0.5);
      ctx.lineTo(w * 0.4, h * 0.45);
      ctx.lineTo(-w * 0.55, h * 0.35);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(-piece.w * 0.5, -piece.h * 0.5, piece.w, piece.h);
    }

    ctx.restore();
  }
};

const tick = (timestamp) => {
  if (!enabled) return;
  if (document.hidden) {
    rafId = window.requestAnimationFrame(tick);
    return;
  }

  const now = Number(timestamp) || 0;
  const elapsed = lastFrameAt ? now - lastFrameAt : FRAME_MS;
  if (!lastFrameAt || elapsed >= FRAME_MS) {
    lastFrameAt = now;
    const dt = Math.min(0.06, Math.max(0.012, elapsed / 1000));
    step(dt, now / 1000);
    drawFrame(now / 1000);
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
  wind = 0;
  windTarget = 0;
  windTimer = 0;
  lastFrameAt = 0;
  pieces = [];
  resize();
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
  if (canvas) canvas.remove();
  canvas = null;
  ctx = null;
  pieces = [];
};

const setEffectiveMode = (effectiveMode) => {
  const mode = String(effectiveMode ?? '').trim().toLowerCase();
  appearanceMode = mode === 'light' ? 'light' : 'dark';
};

const confettiEffect = {
  id: 'confetti',
  enable: ({ effectiveMode } = {}) => {
    setEffectiveMode(effectiveMode);
    start();
  },
  disable: ({ effectiveMode } = {}) => {
    setEffectiveMode(effectiveMode);
    stop();
  },
};

export default confettiEffect;
