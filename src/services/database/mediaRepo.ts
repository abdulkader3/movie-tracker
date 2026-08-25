import { getDb } from './db';
import type {
  Genre,
  MediaListItem,
  MediaRecord,
  MediaType,
  ProgressStatus,
  TvEpisodeRef,
  TvSeasonSummary,
  TvSummary,
} from '../../types/media';

export interface MediaInput {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  imdb_id: string | null;
  imdb_rating: number | null;
  tmdb_rating: number | null;
  runtime: number | null;
  tv_status: string | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  raw_json: string | null;
  genres: Genre[];
}

interface LibraryRow {
  id: number;
  tmdb_id: number;
  media_type: string;
  title: string;
  original_title: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  imdb_rating: number | null;
  tmdb_rating: number | null;
  status: string | null;
}

const AIRED_FILTER = `air_date IS NOT NULL AND air_date <= date('now')`;

const LIBRARY_SELECT = `
  SELECT m.id, m.tmdb_id, m.media_type, m.title, m.original_title, m.poster_path, m.backdrop_path,
         m.release_date, m.imdb_rating, m.tmdb_rating, p.status AS status,
         MAX(IFNULL(eps.last_episode_activity, ''), IFNULL(p.updated_at, '')) AS last_activity
  FROM media m
  LEFT JOIN user_progress p ON p.media_id = m.id AND p.episode_id IS NULL
  LEFT JOIN (
    SELECT e.media_id AS media_id,
           COUNT(*) AS aired_eps,
           SUM(CASE WHEN pr.episode_id IS NOT NULL THEN 1 ELSE 0 END) AS watched_eps,
           MAX(pr.updated_at) AS last_episode_activity
    FROM episodes e
    LEFT JOIN user_progress pr ON pr.episode_id = e.id
    WHERE e.${AIRED_FILTER}
    GROUP BY e.media_id
  ) eps ON eps.media_id = m.id`;

const LIBRARY_ORDER = `
  ORDER BY CASE
    WHEN m.media_type = 'movie' THEN
      CASE IFNULL(p.status, '')
        WHEN 'watching' THEN 0
        WHEN 'watched' THEN 2
        ELSE 1
      END
    ELSE
      CASE
        WHEN IFNULL(eps.aired_eps, 0) > 0 AND IFNULL(eps.watched_eps, 0) >= eps.aired_eps THEN 2
        WHEN IFNULL(eps.watched_eps, 0) > 0 OR IFNULL(p.status, '') = 'watching' THEN 0
        WHEN p.status = 'watched' THEN 2
        ELSE 1
      END
  END ASC,
  last_activity DESC,
  m.title COLLATE NOCASE ASC`;

function toListItem(row: LibraryRow): MediaListItem {
  return {
    id: row.id,
    tmdb_id: row.tmdb_id,
    media_type: row.media_type as MediaType,
    title: row.title,
    original_title: row.original_title,
    poster_path: row.poster_path,
    backdrop_path: row.backdrop_path,
    release_date: row.release_date,
    imdb_rating: row.imdb_rating,
    tmdb_rating: row.tmdb_rating,
    status: (row.status as ProgressStatus | null) ?? null,
  };
}

async function syncGenres(mediaId: number, genres: Genre[]): Promise<void> {
  const db = await getDb();
  await db.execute('DELETE FROM media_genres WHERE media_id = ?', [mediaId]);
  for (const genre of genres) {
    await db.execute('INSERT OR IGNORE INTO genres (id, name) VALUES (?, ?)', [genre.id, genre.name]);
    await db.execute('INSERT OR IGNORE INTO media_genres (media_id, genre_id) VALUES (?, ?)', [
      mediaId,
      genre.id,
    ]);
  }
}

export async function upsertMedia(input: MediaInput): Promise<number> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO media (
       tmdb_id, media_type, title, original_title, overview, poster_path, backdrop_path,
       release_date, imdb_id, imdb_rating, tmdb_rating, runtime, tv_status,
       number_of_seasons, number_of_episodes, raw_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (tmdb_id, media_type) DO UPDATE SET
       title = excluded.title,
       original_title = excluded.original_title,
       overview = excluded.overview,
       poster_path = excluded.poster_path,
       backdrop_path = excluded.backdrop_path,
       release_date = excluded.release_date,
       imdb_id = excluded.imdb_id,
       imdb_rating = COALESCE(excluded.imdb_rating, media.imdb_rating),
       tmdb_rating = excluded.tmdb_rating,
       runtime = excluded.runtime,
       tv_status = excluded.tv_status,
       number_of_seasons = excluded.number_of_seasons,
       number_of_episodes = excluded.number_of_episodes,
       raw_json = excluded.raw_json,
       updated_at = datetime('now')`,
    [
      input.tmdb_id,
      input.media_type,
      input.title,
      input.original_title,
      input.overview,
      input.poster_path,
      input.backdrop_path,
      input.release_date,
      input.imdb_id,
      input.imdb_rating,
      input.tmdb_rating,
      input.runtime,
      input.tv_status,
      input.number_of_seasons,
      input.number_of_episodes,
      input.raw_json,
    ],
  );

  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM media WHERE tmdb_id = ? AND media_type = ?',
    [input.tmdb_id, input.media_type],
  );
  if (!rows.length) throw new Error('Failed to persist media entry.');
  const mediaId = rows[0].id;
  await syncGenres(mediaId, input.genres);
  return mediaId;
}

export async function findByProviderId(
  tmdbId: number,
  mediaType: MediaType,
): Promise<{ id: number } | null> {
  const db = await getDb();
  const rows = await db.select<{ id: number }[]>(
    'SELECT id FROM media WHERE tmdb_id = ? AND media_type = ?',
    [tmdbId, mediaType],
  );
  return rows[0] ?? null;
}

export async function getAllProviderKeys(): Promise<ReadonlySet<string>> {
  const db = await getDb();
  const rows = await db.select<{ tmdb_id: number; media_type: string }[]>(
    'SELECT tmdb_id, media_type FROM media',
  );
  return new Set(rows.map((row) => `${row.media_type}:${row.tmdb_id}`));
}

async function attachTvSummaries(items: MediaListItem[]): Promise<void> {
  const tvIds = items.filter((item) => item.media_type === 'tv').map((item) => item.id);
  if (!tvIds.length) return;
  const placeholders = tvIds.map(() => '?').join(', ');

  const db = await getDb();
  const seasonRows = await db.select<(TvSeasonSummary & { media_id: number })[]>(
    `SELECT e.media_id, e.season_number,
            COUNT(*) AS total,
            SUM(CASE WHEN p.episode_id IS NOT NULL THEN 1 ELSE 0 END) AS watched
     FROM episodes e
     LEFT JOIN user_progress p ON p.episode_id = e.id
     WHERE e.media_id IN (${placeholders}) AND e.${AIRED_FILTER}
     GROUP BY e.media_id, e.season_number
     ORDER BY e.media_id ASC, e.season_number ASC`,
    tvIds,
  );
  const nextRows = await db.select<(TvEpisodeRef & { media_id: number })[]>(
    `SELECT e.media_id, e.season_number, e.episode_number, e.name
     FROM episodes e
     LEFT JOIN user_progress p ON p.episode_id = e.id
     WHERE e.media_id IN (${placeholders}) AND p.episode_id IS NULL AND e.${AIRED_FILTER}
     ORDER BY e.media_id ASC, e.season_number ASC, e.episode_number ASC`,
    tvIds,
  );
  const lastRows = await db.select<(TvEpisodeRef & { media_id: number })[]>(
    `SELECT e.media_id, e.season_number, e.episode_number, e.name
     FROM user_progress p
     JOIN episodes e ON e.id = p.episode_id
     WHERE e.media_id IN (${placeholders}) AND p.status = 'watched'
     ORDER BY p.updated_at DESC, e.season_number DESC, e.episode_number DESC`,
    tvIds,
  );

  const summaries = new Map<number, TvSummary>();
  const ensure = (mediaId: number): TvSummary => {
    let summary = summaries.get(mediaId);
    if (!summary) {
      summary = { seasons: [], next_episode: null, last_watched: null };
      summaries.set(mediaId, summary);
    }
    return summary;
  };
  for (const row of seasonRows) {
    ensure(row.media_id).seasons.push({
      season_number: row.season_number,
      total: row.total,
      watched: row.watched,
    });
  }
  for (const row of nextRows) {
    const summary = ensure(row.media_id);
    if (!summary.next_episode) {
      summary.next_episode = {
        season_number: row.season_number,
        episode_number: row.episode_number,
        name: row.name,
      };
    }
  }
  for (const row of lastRows) {
    const summary = ensure(row.media_id);
    if (!summary.last_watched) {
      summary.last_watched = {
        season_number: row.season_number,
        episode_number: row.episode_number,
        name: row.name,
      };
    }
  }
  for (const item of items) {
    const summary = summaries.get(item.id);
    if (summary) item.tv_summary = summary;
  }
}

export async function getLibrary(
  filter: { mediaType?: MediaType; search?: string } = {},
): Promise<MediaListItem[]> {
  const db = await getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filter.mediaType) {
    clauses.push('m.media_type = ?');
    params.push(filter.mediaType);
  }
  if (filter.search) {
    clauses.push(`(m.title LIKE ? OR IFNULL(m.original_title, '') LIKE ?)`);
    params.push(`%${filter.search}%`, `%${filter.search}%`);
  }
  const whereSql = clauses.length ? ` WHERE ${clauses.join(' AND ')}` : '';
  const rows = await db.select<LibraryRow[]>(`${LIBRARY_SELECT}${whereSql} ${LIBRARY_ORDER}`, params);
  const items = rows.map(toListItem);
  await attachTvSummaries(items);
  return items;
}

interface MediaRow extends Omit<MediaRecord, 'genres' | 'media_type'> {
  media_type: string;
}

function toMediaRecord(row: MediaRow, genres: Genre[]): MediaRecord {
  return { ...row, media_type: row.media_type as MediaType, genres };
}

export async function getMediaById(id: number): Promise<MediaRecord | null> {
  const db = await getDb();
  const rows = await db.select<MediaRow[]>(
    `SELECT id, tmdb_id, media_type, title, original_title, overview, poster_path, backdrop_path,
            release_date, imdb_id, imdb_rating, tmdb_rating, runtime, tv_status,
            number_of_seasons, number_of_episodes, created_at
     FROM media WHERE id = ?`,
    [id],
  );
  if (!rows.length) return null;
  const genres = await db.select<Genre[]>(
    `SELECT g.id, g.name FROM genres g
     JOIN media_genres mg ON mg.genre_id = g.id
     WHERE mg.media_id = ?
     ORDER BY g.name COLLATE NOCASE ASC`,
    [id],
  );
  return toMediaRecord(rows[0], genres);
}

export async function updateImdbRating(id: number, rating: number): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE media SET imdb_rating = ?, updated_at = datetime('now') WHERE id = ?`, [
    rating,
    id,
  ]);
}

export async function deleteMedia(id: number): Promise<void> {
  const db = await getDb();
  await db.execute(
    'DELETE FROM local_files WHERE media_id = ? OR episode_id IN (SELECT id FROM episodes WHERE media_id = ?)',
    [id, id],
  );
  await db.execute('DELETE FROM user_progress WHERE media_id = ?', [id]);
  await db.execute('DELETE FROM episodes WHERE media_id = ?', [id]);
  await db.execute('DELETE FROM seasons WHERE media_id = ?', [id]);
  await db.execute('DELETE FROM media_genres WHERE media_id = ?', [id]);
  await db.execute('DELETE FROM genres WHERE id NOT IN (SELECT DISTINCT genre_id FROM media_genres)');
  await db.execute('DELETE FROM media WHERE id = ?', [id]);
}
