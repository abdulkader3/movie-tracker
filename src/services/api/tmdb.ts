import { fetchJson, ApiError } from './http';
import { getTmdbApiKey } from './config';
import type {
  TmdbEpisode,
  TmdbMovieDetails,
  TmdbSearchHit,
  TmdbSearchItem,
  TmdbTvDetails,
} from '../../types/tmdb';

const API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

export type ImageSize = 'w200' | 'w342' | 'w500' | 'w780' | 'original';

function requireApiKey(): string {
  const key = getTmdbApiKey();
  if (!key) {
    throw new ApiError(
      'TMDB API key is not configured. Copy .env.example to .env and set VITE_TMDB_API_KEY.',
      'config',
    );
  }
  return key;
}

async function tmdbGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams({
    api_key: requireApiKey(),
    language: 'en-US',
    ...params,
  });
  return fetchJson<T>(`${API_BASE}${path}?${query.toString()}`);
}

export async function searchTmdb(query: string): Promise<TmdbSearchHit[]> {
  const data = await tmdbGet<{ results?: TmdbSearchItem[] }>('/search/multi', {
    query,
    include_adult: 'false',
  });
  return (data.results ?? []).filter(
    (item): item is TmdbSearchHit => item.media_type === 'movie' || item.media_type === 'tv',
  );
}

export function getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
  return tmdbGet<TmdbMovieDetails>(`/movie/${tmdbId}`);
}

export function getTvDetails(tmdbId: number): Promise<TmdbTvDetails> {
  return tmdbGet<TmdbTvDetails>(`/tv/${tmdbId}`, { append_to_response: 'external_ids' });
}

export async function getSeasonEpisodes(tmdbId: number, seasonNumber: number): Promise<TmdbEpisode[]> {
  const data = await tmdbGet<{ episodes?: TmdbEpisode[] }>(`/tv/${tmdbId}/season/${seasonNumber}`);
  return data.episodes ?? [];
}

export function imageUrl(path: string | null | undefined, size: ImageSize): string | null {
  if (!path) return null;
  return `${IMAGE_BASE}/${size}${path}`;
}
