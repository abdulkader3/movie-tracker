import { open } from '@tauri-apps/plugin-dialog';

const VIDEO_EXTENSIONS = [
  'mp4',
  'mkv',
  'avi',
  'mov',
  'webm',
  'm4v',
  'wmv',
  'flv',
  'mpg',
  'mpeg',
  'm2ts',
  'ts',
];

export async function pickVideoFile(): Promise<string | null> {
  const selection = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Video files', extensions: VIDEO_EXTENSIONS }],
  });
  return typeof selection === 'string' ? selection : null;
}
