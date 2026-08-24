import { getDb } from './db';
import type { EpisodeRecord, SeasonRecord } from '../../types/media';

export interface SeasonInput {
  tmdb_id: number | null;
  season_number: number;
  name: string | null;
  overview: string | null;
  episode_count: number | null;
  air_date: string | null;
  poster_path: string | null;
}

export interface EpisodeInput {
  tmdb_id: number | null;
  season_number: number;
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
}

interface EpisodeJoinRow {
  id: number;
  media_id: number;
  tmdb_id: number | null;
  season_number: number;
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  watched_flag: number;
  file_id: number | null;
  file_path: string | null;
}

const EPISODE_JOIN = `
  FROM episodes e
  LEFT JOIN user_progress p ON p.episode_id = e.id
  LEFT JOIN local_files f ON f.episode_id = e.id`;

function toEpisodeRecord(row: EpisodeJoinRow): EpisodeRecord {
  return {
    id: row.id,
    media_id: row.media_id,
    tmdb_id: row.tmdb_id,
    season_number: row.season_number,
    episode_number: row.episode_number,
    name: row.name,
    overview: row.overview,
    air_date: row.air_date,
    runtime: row.runtime,
    still_path: row.still_path,
    watched: row.watched_flag === 1,
    file:
      row.file_id != null
        ? { id: row.file_id, media_id: null, episode_id: row.id, path: row.file_path ?? '' }
        : null,
  };
}

export async function replaceSeasons(mediaId: number, seasons: SeasonInput[]): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM seasons WHERE media_id = ?', [mediaId]);
  for (const season of seasons) {
    await db.execute(
      `INSERT INTO seasons (media_id, tmdb_id, season_number, name, overview, episode_count, air_date, poster_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaId,
        season.tmdb_id,
        season.season_number,
        season.name,
        season.overview,
        season.episode_count,
        season.air_date,
        season.poster_path,
      ],
    );
  }
}

export async function replaceEpisodes(mediaId: number, episodes: EpisodeInput[]): Promise<void> {
  const db = await getDb();
  await db.execute(
    'DELETE FROM local_files WHERE episode_id IN (SELECT id FROM episodes WHERE media_id = ?)',
    [mediaId],
  );
  await db.execute(
    'DELETE FROM user_progress WHERE episode_id IN (SELECT id FROM episodes WHERE media_id = ?)',
    [mediaId],
  );
  await db.execute('DELETE FROM episodes WHERE media_id = ?', [mediaId]);
  for (const episode of episodes) {
    await db.execute(
      `INSERT INTO episodes (media_id, tmdb_id, season_number, episode_number, name, overview, air_date, runtime, still_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mediaId,
        episode.tmdb_id,
        episode.season_number,
        episode.episode_number,
        episode.name,
        episode.overview,
        episode.air_date,
        episode.runtime,
        episode.still_path,
      ],
    );
  }
}

export async function getSeasons(mediaId: number): Promise<SeasonRecord[]> {
  const db = await getDb();
  return db.select<SeasonRecord[]>(
    `SELECT id, media_id, tmdb_id, season_number, name, overview, episode_count, air_date, poster_path
     FROM seasons WHERE media_id = ?
     ORDER BY season_number ASC`,
    [mediaId],
  );
}

export async function getEpisodesWithMeta(mediaId: number): Promise<EpisodeRecord[]> {
  const db = await getDb();
  const rows = await db.select<EpisodeJoinRow[]>(
    `SELECT e.id, e.media_id, e.tmdb_id, e.season_number, e.episode_number, e.name, e.overview,
            e.air_date, e.runtime, e.still_path,
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS watched_flag,
            f.id AS file_id, f.path AS file_path
     ${EPISODE_JOIN}
     WHERE e.media_id = ?
     ORDER BY e.season_number ASC, e.episode_number ASC`,
    [mediaId],
  );
  return rows.map(toEpisodeRecord);
}

export async function findEpisodeId(
  mediaId: number,
  seasonNumber: number,
  episodeNumber: number,
): Promise<number | null> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM episodes WHERE media_id = ? AND season_number = ? AND episode_number = ?',
    [mediaId, seasonNumber, episodeNumber],
  );
  return rows[0]?.id ?? null;
}

export interface EpisodeSnapshotEntry {
  path: string | null;
  watched: boolean;
}

export async function snapshotEpisodeState(
  mediaId: number,
): Promise<Map<string, EpisodeSnapshotEntry>> {
  const db = await getDb();
  const rows = await db.select<Pick<EpisodeJoinRow, 'season_number' | 'episode_number' | 'watched_flag' | 'file_id' | 'file_path'>[]>(
    `SELECT e.season_number, e.episode_number,
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS watched_flag,
            f.id AS file_id, f.path AS file_path
     ${EPISODE_JOIN}
     WHERE e.media_id = ?`,
    [mediaId],
  );
  const snapshot = new Map<string, EpisodeSnapshotEntry>();
  for (const row of rows) {
    snapshot.set(`${row.season_number}:${row.episode_number}`, {
      path: row.file_path,
      watched: row.watched_flag === 1,
    });
  }
  return snapshot;
}
