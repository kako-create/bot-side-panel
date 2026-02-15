export default {
  id: 'lago',
  label: 'Lago',
  fun: true,
  swatch: ['#2563eb', '#06b6d4', '#7dd3fc', '#1e40af'],
  effects: [{ id: 'ripple', config: { intervalMs: 5000 } }],
  palette: {
    primary: '#2563eb',
    primaryHover: '#1d4ed8',
    primaryActive: '#1e40af',
    accent: '#06b6d4',
    accentHover: '#0891b2',
    highlight: '#7dd3fc',
    gradientLight: 'linear-gradient(180deg, rgba(6, 182, 212, 0.16) 0%, rgba(125, 211, 252, 0.10) 42%, rgba(247, 250, 252, 1) 78%)',
    gradientDark: 'linear-gradient(180deg, rgba(6, 52, 82, 0.72) 0%, rgba(6, 28, 47, 0.86) 44%, rgba(6, 18, 30, 1) 78%)',
    patternLight:
      'radial-gradient(circle at 18% 22%, rgba(37, 99, 235, 0.10) 0 7px, transparent 8px), radial-gradient(circle at 72% 26%, rgba(6, 182, 212, 0.10) 0 6px, transparent 7px), radial-gradient(circle at 62% 78%, rgba(125, 211, 252, 0.10) 0 7px, transparent 8px), radial-gradient(circle at 28% 74%, rgba(37, 99, 235, 0.08) 0 6px, transparent 7px)',
    patternDark:
      'radial-gradient(circle at 18% 22%, rgba(37, 99, 235, 0.16) 0 6px, transparent 7px), radial-gradient(circle at 72% 26%, rgba(6, 182, 212, 0.14) 0 5px, transparent 6px), radial-gradient(circle at 62% 78%, rgba(125, 211, 252, 0.12) 0 6px, transparent 7px), radial-gradient(circle at 28% 74%, rgba(37, 99, 235, 0.12) 0 5px, transparent 6px)',
  },
};

