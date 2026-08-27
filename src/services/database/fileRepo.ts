import { getDb } from './db';
import type { LocalFileRecord } from '../../types/media';
import { markDatabaseDirty } from '../../hooks/useBackup';

export async function getFileForMedia(mediaId: number): Promise<LocalFileRecord | null> {
  const db = await getDb();
  const rows = await db.select<LocalFileRecord[]>(
    'SELECT id, media_id, episode_id, path FROM local_files WHERE media_id = ? LIMIT 1',
    [mediaId],
  );
  return rows[0] ?? null;
}

export async function getFileForEpisode(episodeId: number): Promise<LocalFileRecord | null> {
  const db = await getDb();
  const rows = await db.select<LocalFileRecord[]>(
    'SELECT id, media_id, episode_id, path FROM local_files WHERE episode_id = ? LIMIT 1',
    [episodeId],
  );
  return rows[0] ?? null;
}

export async function attachFile(
  target: { mediaId?: number; episodeId?: number },
  path: string,
): Promise<void> {
  const db = await getDb();
  if (target.mediaId != null) {
    await db.execute('DELETE FROM local_files WHERE media_id = ?', [target.mediaId]);
    await db.execute('INSERT INTO local_files (media_id, path) VALUES (?, ?)', [target.mediaId, path]);
  } else if (target.episodeId != null) {
    await db.execute('DELETE FROM local_files WHERE episode_id = ?', [target.episodeId]);
    await db.execute('INSERT INTO local_files (episode_id, path) VALUES (?, ?)', [
      target.episodeId,
      path,
    ]);
  }
  markDatabaseDirty();
}

export async function removeFile(fileId: number): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM local_files WHERE id = ?', [fileId]);
  markDatabaseDirty();
}

export async function removeFilesForSeason(mediaId: number, seasonNumber: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    'DELETE FROM local_files WHERE episode_id IN (SELECT id FROM episodes WHERE media_id = ? AND season_number = ?)',
    [mediaId, seasonNumber],
  );
  markDatabaseDirty();
}
