import { emptyUserData, sanitizeUserData, UserData } from '../utils/userData';
import { StorageMod } from './native';

const KEY = 'novaplay:userdata:v1';
const CORRUPT_KEY = 'novaplay:userdata:corrupt';

export type LoadResult = { data: UserData; warning: string | null };

/** Never throws: unreadable or damaged data is set aside and the app starts with a clean slate. */
export async function loadUserData(): Promise<LoadResult> {
  const S = StorageMod.mod;
  if (!S) return { data: emptyUserData(), warning: StorageMod.error ?? 'Storage is unavailable' };
  let raw: string | null = null;
  try {
    raw = await S.getItem(KEY);
  } catch (e: any) {
    return { data: emptyUserData(), warning: e?.message ?? 'Could not read saved data' };
  }
  if (!raw) return { data: emptyUserData(), warning: null };
  try {
    return { data: sanitizeUserData(JSON.parse(raw)), warning: null };
  } catch {
    try { await S.setItem(CORRUPT_KEY, raw); } catch { /* best effort backup of the damaged data */ }
    return { data: emptyUserData(), warning: 'Saved favorites and history were damaged and have been reset.' };
  }
}

export async function saveUserData(data: UserData): Promise<string | null> {
  const S = StorageMod.mod;
  if (!S) return StorageMod.error ?? 'Storage is unavailable';
  try {
    await S.setItem(KEY, JSON.stringify(data));
    return null;
  } catch (e: any) {
    return e?.message ?? 'Could not save data';
  }
}
