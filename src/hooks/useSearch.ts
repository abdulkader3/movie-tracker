import { useCallback, useState } from 'react';
import { searchTmdb } from '../services/api/tmdb';
import type { TmdbSearchHit } from '../types/tmdb';
import { friendlyApiError } from '../utils/errors';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    setQuery(trimmed);
    if (trimmed.length < 2) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hits = await searchTmdb(trimmed);
      setResults(hits);
    } catch (err) {
      console.error(err);
      setResults([]);
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { query, results, loading, error, search };
}
