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

function deriveShowStatus(totalAired: number, watchedAired: number): ProgressStatus | null {
  if (totalAired <= 0) return null;
  if (watchedAired <= 0) return 'planned';
  if (watchedAired >= totalAired) return 'watched';
  return 'watching';
}

async function syncShowStatus(mediaId: number): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ total: number; watched: number }[]>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END) AS watched
     FROM episodes e
     LEFT JOIN user_progress p ON p.episode_id = e.id
     WHERE e.media_id = ? AND e.air_date IS NOT NULL AND e.air_date <= date('now')`,
    [mediaId],
  );
  const derived = deriveShowStatus(rows[0]?.total ?? 0, rows[0]?.watched ?? 0);
  if (!derived) return;
  const current = await db.select<{ id: number; status: string }[]>(
    'SELECT id, status FROM user_progress WHERE media_id = ? AND episode_id IS NULL LIMIT 1',
    [mediaId],
  );
  if (current.length === 0) {
    await db.execute('INSERT INTO user_progress (media_id, status) VALUES (?, ?)', [mediaId, derived]);
  } else if (current[0].status !== derived) {
    await db.execute(`UPDATE user_progress SET status = ?, updated_at = datetime('now') WHERE id = ?`, [
      derived,
      current[0].id,
    ]);
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
  } else {
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
  }
  await syncShowStatus(mediaId);
}

export async function setSeasonWatched(
  mediaId: number,
  seasonNumber: number,
  watched: boolean,
): Promise<void> {
  const db = await getDb();
  if (watched) {
    await db.execute(
      `INSERT INTO user_progress (media_id, episode_id, status)
       SELECT ?, e.id, 'watched'
       FROM episodes e
       WHERE e.media_id = ? AND e.season_number = ?
         AND NOT EXISTS (SELECT 1 FROM user_progress p WHERE p.episode_id = e.id)`,
      [mediaId, mediaId, seasonNumber],
    );
    await db.execute(
      `UPDATE user_progress SET status = 'watched', updated_at = datetime('now')
       WHERE episode_id IN (
         SELECT id FROM episodes WHERE media_id = ? AND season_number = ?
       )`,
      [mediaId, seasonNumber],
    );
  } else {
    await db.execute(
      `DELETE FROM user_progress
       WHERE episode_id IN (
         SELECT id FROM episodes WHERE media_id = ? AND season_number = ?
       )`,
      [mediaId, seasonNumber],
    );
  }
  await syncShowStatus(mediaId);
}
