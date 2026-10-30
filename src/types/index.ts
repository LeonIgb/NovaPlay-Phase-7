export type VideoSource = 'device' | 'imported';

export type VideoItem = {
  id: string;
  title: string; // display name (file name without extension)
  filename: string;
  uri: string;
  source: VideoSource; // 'device' = found via media scan, 'imported' = chosen with the file picker
  folder: string; // display name of the album/folder
  folderKey: string; // stable key used for folder filtering
  tint: string; // placeholder thumbnail color shown until a real thumbnail exists
  sizeMb?: number; // only when the platform exposes it
  durationSec?: number; // from the media library, or learned the first time the video is played
  createdAt?: number; // ms since epoch
  width?: number;
  height?: number;
  missing?: boolean; // imported file no longer exists / is inaccessible
};

export type RootStackParamList = {
  Library: undefined;
  Player: { videoId: string; queue?: string[] };
  Settings: undefined;
};

export type Navigation = {
  navigate: <K extends keyof RootStackParamList>(name: K, params?: RootStackParamList[K]) => void;
  goBack: () => void;
};

export type ScreenProps<K extends keyof RootStackParamList> = {
  navigation: Navigation;
  route: { params: RootStackParamList[K] };
};
