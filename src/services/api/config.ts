const LS_TMDB_KEY = 'mt_tmdb_api_key';
const LS_OMDB_KEY = 'mt_omdb_api_key';

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key)?.trim() ?? '';
  } catch {
    return '';
  }
}

export function getTmdbApiKey(): string {
  return import.meta.env.VITE_TMDB_API_KEY?.trim() || readStored(LS_TMDB_KEY);
}

export function getOmdbApiKey(): string {
  return import.meta.env.VITE_OMDB_API_KEY?.trim() || readStored(LS_OMDB_KEY);
}
