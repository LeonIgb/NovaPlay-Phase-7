import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoItem } from '../types';
import { colors, radius, spacing } from '../theme/colors';
import { formatTime, metaLine } from '../utils/format';
import { useThumbnail } from '../hooks/useThumbnail';

type Props = {
  video: VideoItem;
  variant?: 'large' | 'row';
  active?: boolean;
  onPress: (video: VideoItem) => void;
  onLongPress?: (video: VideoItem) => void;
};

function VideoCard({ video, variant = 'large', active, onPress, onLongPress }: Props) {
  const isRow = variant === 'row';
  const thumb = useThumbnail(video);
  return (
    <Pressable
      onPress={() => onPress(video)}
      onLongPress={onLongPress ? () => onLongPress(video) : undefined}
      accessibilityRole="button"
      accessibilityLabel={`Play ${video.title}`}
      style={({ pressed }) => [isRow ? styles.row : styles.large, { opacity: video.missing ? 0.55 : pressed ? 0.8 : 1 }]}
    >
      <View style={[styles.thumb, isRow ? styles.thumbRow : styles.thumbLarge, { backgroundColor: video.tint }, active && styles.thumbActive]}>
        {thumb ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
        <Ionicons
          name={video.missing ? 'alert-circle-outline' : 'play-circle-outline'}
          size={isRow ? 30 : 44}
          color={video.missing ? colors.warning : thumb ? 'rgba(248,250,252,0.8)' : 'rgba(248,250,252,0.55)'}
        />
        {video.durationSec ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{formatTime(video.durationSec)}</Text>
          </View>
        ) : null}
      </View>
      <View style={isRow ? styles.metaRow : styles.metaLarge}>
        <Text style={styles.title} numberOfLines={2}>{video.title}</Text>
        <Text style={styles.sub} numberOfLines={1}>{video.missing ? 'File missing or inaccessible' : metaLine(video)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  large: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  thumb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbActive: { borderWidth: 2, borderColor: colors.primary },
  thumbLarge: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.md },
  thumbRow: { width: 150, height: 84, borderRadius: radius.sm },
  badge: { position: 'absolute', right: 6, bottom: 6, backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '600' },
  metaLarge: { paddingTop: spacing.sm, paddingHorizontal: 2 },
  metaRow: { flex: 1 },
  title: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  sub: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
});

export default React.memo(VideoCard);
