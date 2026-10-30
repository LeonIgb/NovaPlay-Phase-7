import React, { useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme/colors';
import { VideoItem } from '../types';
import { QueueRow } from '../utils/queue';
import VideoCard from './VideoCard';

type Props = {
  rows: QueueRow[];
  header: React.ReactElement;
  bottomInset: number;
  onSelect: (video: VideoItem) => void;
};

// Memoized: the player updates its time twice a second, but none of these props change when it does.
function QueueList({ rows, header, bottomInset, onSelect }: Props) {
  const renderItem = useCallback(
    ({ item }: { item: QueueRow }) => {
      if (item.type === 'video') return <VideoCard video={item.video} variant="row" onPress={onSelect} />;
      if (item.type === 'header') {
        return (
          <View style={styles.sectionRow}>
            <Text style={styles.section}>{item.title}</Text>
            {item.hint ? <Text style={styles.hint}>{item.hint}</Text> : null}
          </View>
        );
      }
      return (
        <View style={styles.endRow}>
          <Ionicons name="flag-outline" size={18} color={colors.secondary} />
          <Text style={styles.endText}>{item.text}</Text>
        </View>
      );
    },
    [onSelect],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(r) => r.key}
      renderItem={renderItem}
      ListHeaderComponent={header}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      removeClippedSubviews
      contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }}
    />
  );
}

export default React.memo(QueueList);

const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  section: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textSecondary, fontSize: 12 },
  endRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  endText: { color: colors.textSecondary, fontSize: 13 },
});
