import { useCallback, useEffect, useState } from 'react';
import { getLibrary } from '../services/database/mediaRepo';
import type { MediaListItem, MediaType } from '../types/media';
import { friendlyApiError } from '../utils/errors';

export function useLibrary(mediaType?: MediaType) {
  const [items, setItems] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const rows = await getLibrary(mediaType ? { mediaType } : {});
      setItems(rows);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(friendlyApiError(err));
    } finally {
      setLoading(false);
    }
  }, [mediaType]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  return { items, loading, error, reload };
}
