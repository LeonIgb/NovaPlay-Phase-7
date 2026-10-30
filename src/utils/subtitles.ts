export type TrackLike = { id?: string; label?: string; language?: string } | null | undefined;

const key = (t: NonNullable<TrackLike>) => `${t.id ?? ''}|${t.language ?? ''}|${t.label ?? ''}`;

export function sameTrack(a: TrackLike, b: TrackLike): boolean {
  if (!a || !b) return !a && !b;
  return key(a) === key(b);
}

export function trackLabel(t: NonNullable<TrackLike>, index: number): string {
  const label = t.label?.trim();
  if (label && t.language && !label.toLowerCase().includes(t.language.toLowerCase())) return `${label} (${t.language})`;
  return label || (t.language ? t.language.toUpperCase() : `Track ${index + 1}`);
}
