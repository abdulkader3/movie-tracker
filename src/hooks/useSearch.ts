import { useEffect, useState } from 'react';
import { searchTmdb } from '../services/api/tmdb';
import type { TmdbSearchHit } from '../types/tmdb';
import { friendlyApiError } from '../utils/errors';
import { useDebouncedValue } from './useDebouncedValue';

export function useSearch(rawQuery: string) {
  const query = rawQuery.trim();
  const debouncedQuery = useDebouncedValue(query, 400);
  const [results, setResults] = useState<TmdbSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchTmdb(debouncedQuery)
      .then((hits) => {
        if (cancelled) return;
        setResults(hits);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setResults([]);
        setError(friendlyApiError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  return { results, loading, error };
}
