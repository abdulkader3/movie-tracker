import { fetchJson } from './http';
import { getOmdbApiKey } from './config';
import type { OmdbRatingResponse, OmdbSearchItem, OmdbSearchResponse } from '../../types/tmdb';

export async function fetchImdbRating(imdbId: string): Promise<number | null> {
  const apiKey = getOmdbApiKey();
  if (!apiKey || !imdbId) return null;

  try {
    const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(apiKey)}&i=${encodeURIComponent(imdbId)}`;
    const data = await fetchJson<OmdbRatingResponse>(url);
    if (data.Response === 'False' || !data.imdbRating) return null;
    const rating = Number.parseFloat(data.imdbRating);
    return Number.isFinite(rating) ? rating : null;
  } catch {
    return null;
  }
}

export async function searchOmdb(query: string): Promise<OmdbSearchItem[]> {
  const apiKey = getOmdbApiKey();
  if (!apiKey) return [];

  const url = `https://www.omdbapi.com/?apikey=${encodeURIComponent(apiKey)}&s=${encodeURIComponent(query)}&type=movie|series`;
  const data = await fetchJson<OmdbSearchResponse>(url);
  if (data.Response === 'False' || !data.Search) return [];
  return data.Search;
}
