import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as NavigationBar from 'expo-navigation-bar';

async function setNavBarHidden(hidden: boolean) {
  if (Platform.OS !== 'android') return;
  try { await NavigationBar.setVisibilityAsync(hidden ? 'hidden' : 'visible'); } catch { /* ignored: player may be released or API unsupported */ }
}

async function restoreLock(initial: ScreenOrientation.OrientationLock | null) {
  try {
    const L = ScreenOrientation.OrientationLock;
    if (initial == null || initial === L.OTHER || initial === L.UNKNOWN) await ScreenOrientation.unlockAsync();
    else await ScreenOrientation.lockAsync(initial);
  } catch { /* ignored: player may be released or API unsupported */ }
}

/**
 * Fullscreen = landscape lock + hidden Android navigation bar + (status bar, hidden by the screen).
 * The video player itself is never touched here, so playback continues across transitions.
 */
export function useFullscreen() {
  const [fullscreen, setFullscreen] = useState(false);
  const initialLock = useRef<ScreenOrientation.OrientationLock | null>(null);

  useEffect(() => {
    ScreenOrientation.getOrientationLockAsync().then((l) => { initialLock.current = l; }).catch(() => {});
    return () => {
      setNavBarHidden(false);
      restoreLock(initialLock.current);
    };
  }, []);

  const enter = useCallback(async () => {
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); } catch { /* ignored: player may be released or API unsupported */ }
    setFullscreen(true);
    setNavBarHidden(true);
  }, []);

  const exit = useCallback(async () => {
    setFullscreen(false);
    setNavBarHidden(false);
    try { await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP); } catch { /* ignored: player may be released or API unsupported */ }
    await restoreLock(initialLock.current);
  }, []);

  const toggle = useCallback(() => { (fullscreen ? exit : enter)(); }, [fullscreen, enter, exit]);

  return { fullscreen, enter, exit, toggle };
}
