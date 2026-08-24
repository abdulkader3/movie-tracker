import { getDb } from './db';
import type { MediaProgress, ProgressStatus } from '../../types/media';

export async function getProgress(mediaId: number): Promise<MediaProgress | null> {
  const db = await getDb();
  const rows = await db.select<{ media_id: number; status: string; rating: number | null; updated_at: string }[]>(
    `SELECT media_id, status, rating, updated_at FROM user_progress
     WHERE media_id = ? AND episode_id IS NULL
     LIMIT 1`,
    [mediaId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    media_id: row.media_id,
    status: row.status as ProgressStatus,
    rating: row.rating,
    updated_at: row.updated_at,
  };
}

export async function setStatus(mediaId: number, status: ProgressStatus): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM user_progress WHERE media_id = ? AND episode_id IS NULL',
    [mediaId],
  );
  if (rows.length > 0) {
    await db.execute(`UPDATE user_progress SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
      status,
      rows[0].id,
    ]);
  } else {
    await db.execute('INSERT INTO user_progress (media_id, status) VALUES (?, ?)', [mediaId, status]);
  }
}

export async function setEpisodeWatched(
  mediaId: number,
  episodeId: number,
  watched: boolean,
): Promise<void> {
  const db = await getDb();
  if (!watched) {
    await db.execute('DELETE FROM user_progress WHERE episode_id = ?', [episodeId]);
    return;
  }
  const existing = await db.select<{ id: number }[]>(
    'SELECT id FROM user_progress WHERE episode_id = ?',
    [episodeId],
  );
  if (existing.length > 0) {
    await db.execute(
      `UPDATE user_progress SET status = 'watched', updated_at = datetime('now') WHERE id = ?`,
      [existing[0].id],
    );
  } else {
    await db.execute(
      'INSERT INTO user_progress (media_id, episode_id, status) VALUES (?, ?, ?)',
      [mediaId, episodeId, 'watched'],
    );
  }
  const showRow = await db.select<{ id: number }[]>(
    'SELECT id FROM user_progress WHERE media_id = ? AND episode_id IS NULL',
    [mediaId],
  );
  if (showRow.length === 0) {
    await db.execute(`INSERT INTO user_progress (media_id, status) VALUES (?, 'watching')`, [mediaId]);
  }
}
