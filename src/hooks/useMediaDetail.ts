import { useCallback, useEffect, useState } from 'react';
import { getEpisodesWithMeta, getSeasons } from '../services/database/episodeRepo';
import { getFileForMedia } from '../services/database/fileRepo';
import { getMediaById } from '../services/database/mediaRepo';
import { getProgress } from '../services/database/progressRepo';
import type {
  EpisodeRecord,
  LocalFileRecord,
  MediaProgress,
  MediaRecord,
  SeasonRecord,
} from '../types/media';

export interface MediaDetailData {
  media: MediaRecord;
  seasons: SeasonRecord[];
  episodes: EpisodeRecord[];
  movieFile: LocalFileRecord | null;
  progress: MediaProgress | null;
}

async function loadDetail(mediaId: number): Promise<MediaDetailData> {
  const media = await getMediaById(mediaId);
  if (!media) throw new Error('This entry no longer exists.');
  const progress = await getProgress(mediaId);
  if (media.media_type === 'tv') {
    const [seasons, episodes] = await Promise.all([
      getSeasons(mediaId),
      getEpisodesWithMeta(mediaId),
    ]);
    return { media, seasons, episodes, movieFile: null, progress };
  }
  const movieFile = await getFileForMedia(mediaId);
  return { media, seasons: [], episodes: [], movieFile, progress };
}

export function useMediaDetail(mediaId: number) {
  const [data, setData] = useState<MediaDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(async () => {
    setTick((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDetail(mediaId)
      .then((bundle) => {
        if (!cancelled) setData(bundle);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this entry.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mediaId, tick]);

  return { data, loading, error, reload };
}
