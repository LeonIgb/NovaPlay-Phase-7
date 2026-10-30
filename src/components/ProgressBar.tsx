import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

type Props = {
  progress: number; // 0..1
  buffered?: number; // 0..1
  onSeek?: (ratio: number) => void;
};

// Tap-to-seek only. Drag scrubbing is added with the real playback engine.
export default function ProgressBar({ progress, buffered = 0, onSeek }: Props) {
  const [width, setWidth] = useState(1);
  const p = Math.min(1, Math.max(0, progress));
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.max(1, e.nativeEvent.layout.width));

  return (
    <Pressable
      onLayout={onLayout}
      onPress={(e) => onSeek?.(Math.min(1, Math.max(0, e.nativeEvent.locationX / width)))}
      style={styles.hit}
      accessibilityRole="adjustable"
      accessibilityLabel="Seek bar"
    >
      <View style={styles.track}>
        <View style={[styles.buffer, { width: `${buffered * 100}%` }]} />
        <View style={[styles.fill, { width: `${p * 100}%` }]} />
      </View>
      <View style={[styles.thumb, { left: p * width - 7 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { height: 24, justifyContent: 'center' },
  track: { height: 3, backgroundColor: 'rgba(248,250,252,0.25)', borderRadius: 2, overflow: 'hidden' },
  buffer: { position: 'absolute', height: 3, backgroundColor: 'rgba(248,250,252,0.45)' },
  fill: { position: 'absolute', height: 3, backgroundColor: colors.primary },
  thumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.primary },
});
