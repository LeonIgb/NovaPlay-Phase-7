// Shared text styles and sizing so every screen reads the same way.
export const type = {
  title: { fontSize: 22, fontWeight: '800' as const, letterSpacing: 0.3 },
  heading: { fontSize: 18, fontWeight: '700' as const },
  section: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  body: { fontSize: 15, fontWeight: '600' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 17 },
};

export const MIN_TOUCH = 48; // minimum comfortable touch target (dp)
export const MAX_CONTENT_WIDTH = 640; // keeps forms readable on tablets and in landscape
