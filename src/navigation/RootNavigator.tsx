import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';
import { Navigation, RootStackParamList } from '../types';
import LibraryScreen from '../screens/LibraryScreen';
import PlayerScreen from '../screens/PlayerScreen';
import SettingsScreen from '../screens/SettingsScreen';

type Entry = { key: number; name: keyof RootStackParamList; params: any };

// Small stack navigator with no native dependencies. Earlier screens stay mounted
// (hidden) underneath, so the library keeps its state while the player is open.
export default function RootNavigator() {
  const [stack, setStack] = useState<Entry[]>([{ key: 0, name: 'Library', params: undefined }]);
  const nextKey = useRef(1);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  const navigate = useCallback<Navigation['navigate']>((name, params) => {
    setStack((s) => [...s, { key: nextKey.current++, name, params }]);
  }, []);
  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);
  const navigation = useMemo<Navigation>(() => ({ navigate, goBack }), [navigate, goBack]);

  // Registered once at mount, so handlers added later by screens (e.g. the player's
  // fullscreen/lock handler) run first and can consume the back press.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stackRef.current.length > 1) { goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [goBack]);

  return (
    <View style={styles.root}>
      {stack.map((entry, i) => {
        const hidden = i < stack.length - 1;
        const route = { params: entry.params };
        return (
          <View key={entry.key} style={[StyleSheet.absoluteFill, hidden && styles.hidden]} pointerEvents={hidden ? 'none' : 'auto'}>
            {entry.name === 'Library' ? (
              <LibraryScreen navigation={navigation} route={route} />
            ) : entry.name === 'Settings' ? (
              <SettingsScreen navigation={navigation} route={route} />
            ) : (
              <PlayerScreen navigation={navigation} route={route as { params: RootStackParamList['Player'] }} />
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hidden: { display: 'none' },
});
