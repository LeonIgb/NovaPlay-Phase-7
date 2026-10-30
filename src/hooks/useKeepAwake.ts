import { useEffect } from 'react';
import { setKeepAwake } from '../services/keepAwake';

/** Keeps the screen awake while `active` is true; always released on unmount. */
export function useKeepAwake(active: boolean): void {
  useEffect(() => {
    setKeepAwake(active);
    return () => setKeepAwake(false);
  }, [active]);
}
