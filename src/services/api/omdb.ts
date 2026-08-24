import { fetchJson } from './http';
import { getOmdbApiKey } from './config';
import type { OmdbRatingResponse } from '../../types/tmdb';

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
