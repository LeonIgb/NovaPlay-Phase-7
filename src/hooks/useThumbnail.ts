import { useEffect, useState } from 'react';
import { VideoItem } from '../types';
import { getCachedThumbnail, releaseThumbnail, requestThumbnail } from '../services/thumbnails';

export function useThumbnail(video: VideoItem): string | null {
  const [uri, setUri] = useState<string | null>(getCachedThumbnail(video.id) ?? null);

  useEffect(() => {
    if (video.missing) { setUri(null); return; }
    let alive = true;
    requestThumbnail(video.id, video.uri, video.durationSec).then((u) => { if (alive) setUri(u); });
    return () => {
      alive = false;
      releaseThumbnail(video.id); // scrolled away before it started: skip the work
    };
  }, [video.id, video.uri, video.missing, video.durationSec]);

  return uri;
}
