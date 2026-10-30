export function formatTime(totalSec: number): string {
  const s = Number.isFinite(totalSec) ? Math.max(0, Math.floor(totalSec)) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(ms: number | undefined, now: number = Date.now()): string | undefined {
  if (!ms || ms <= 0) return undefined;
  const d = new Date(ms);
  const n = new Date(now);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(n) - day(d)) / 86400000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** One-line metadata summary that only includes what is actually known. */
export function metaLine(v: { folder: string; sizeMb?: number; createdAt?: number; width?: number; height?: number }): string {
  const parts = [v.folder];
  if (v.sizeMb && v.sizeMb > 0) parts.push(formatSize(v.sizeMb));
  if (v.width && v.height) parts.push(`${Math.min(v.width, v.height)}p`);
  const date = formatDate(v.createdAt);
  if (date) parts.push(date);
  return parts.join(' · ');
}
