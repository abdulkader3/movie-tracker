import { openPath } from '@tauri-apps/plugin-opener';

export async function playFile(path: string): Promise<void> {
  await openPath(path);
}
