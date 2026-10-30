import { KeepAwakeMod } from './native';

const TAG = 'novaplay-playback';
let on = false;

export const keepAwakeAvailable = (): boolean => !!KeepAwakeMod.mod;

/** Idempotent: only talks to the native module when the state actually changes. Never throws. */
export function setKeepAwake(next: boolean): void {
  const mod = KeepAwakeMod.mod;
  if (!mod || next === on) return;
  on = next;
  try {
    const result = next ? mod.activateKeepAwakeAsync?.(TAG) : mod.deactivateKeepAwake?.(TAG);
    Promise.resolve(result).catch(() => { /* unsupported on this device, or already released */ });
  } catch {
    // module misbehaved: playback is unaffected
  }
}
