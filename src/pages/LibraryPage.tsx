import { useState } from 'react';
import { MediaCard } from '../components/MediaCard';
import { Notice } from '../components/Notice';
import { Spinner } from '../components/Spinner';
import { useLibrary } from '../hooks/useLibrary';
import { imageUrl } from '../services/api/tmdb';
import type { MediaListItem, MediaType, ProgressStatus, TvSummary } from '../types/media';
import { pad2, yearOf } from '../utils/format';

const STATUS_LABELS: Record<ProgressStatus, string> = {
  planned: 'Planned',
  watching: 'Watching',
  watched: 'Watched',
};

const TYPE_LABEL: Record<MediaType, string> = { movie: 'Movie', tv: 'Series' };

interface LibraryPageProps {
  mediaType?: MediaType;
  onOpen(mediaId: number): void;
}

function findNowWatching(items: MediaListItem[]): MediaListItem | null {
  for (const item of items) {
    if (item.media_type === 'tv' && item.tv_summary) {
      const { tv_summary } = item;
      const hasInProgress = tv_summary.seasons.some(
        (s) => s.watched > 0 && s.watched < s.total,
      );
      const hasNext = tv_summary.next_episode != null;
      if (hasInProgress || hasNext || item.status === 'watching') {
        return item;
      }
    }
    if (item.media_type === 'movie' && item.status === 'watching') {
      return item;
    }
  }
  return null;
}

function getSeasonProgress(tvSummary: TvSummary): {
  currentSeason: number;
  watched: number;
  total: number;
  nextCode: string | null;
} {
  const inProgress = tvSummary.seasons.find(
    (s) => s.watched > 0 && s.watched < s.total,
  );
  if (inProgress) {
    const nextEp = tvSummary.next_episode;
    const nextCode = nextEp
      ? `S${pad2(nextEp.season_number)}E${pad2(nextEp.episode_number)}`
      : null;
    return {
      currentSeason: inProgress.season_number,
      watched: inProgress.watched,
      total: inProgress.total,
      nextCode,
    };
  }
  const last = tvSummary.seasons[tvSummary.seasons.length - 1];
  if (last) {
    const nextEp = tvSummary.next_episode;
    const nextCode = nextEp
      ? `S${pad2(nextEp.season_number)}E${pad2(nextEp.episode_number)}`
      : null;
    return {
      currentSeason: last.season_number,
      watched: last.watched,
      total: last.total,
      nextCode,
    };
  }
  return { currentSeason: 1, watched: 0, total: 0, nextCode: null };
}

function NowWatchingHero({ item, onOpen }: { item: MediaListItem; onOpen(id: number): void }) {
  const [bgFailed, setBgFailed] = useState(false);
  const backdropUrl = imageUrl(item.backdrop_path, 'w1280');
  const year = yearOf(item.release_date);
  const rating = item.tmdb_rating ?? item.imdb_rating;
  const metaParts = [TYPE_LABEL[item.media_type], year != null ? String(year) : null].filter(Boolean);
  const ratingText = rating != null && rating > 0 ? `★ ${rating.toFixed(1)}` : null;

  let progress = null;
  if (item.media_type === 'tv' && item.tv_summary) {
    progress = getSeasonProgress(item.tv_summary);
  }

  return (
    <div className="now-watching-hero">
      {backdropUrl && !bgFailed ? (
        <img
          className="now-watching-bg"
          src={backdropUrl}
          alt=""
          onError={() => setBgFailed(true)}
        />
      ) : (
        <div className="now-watching-bg now-watching-bg--fallback" />
      )}
      <div className="now-watching-shade" />
      <div className="now-watching-content">
        <div className="now-watching-text">
          <span className="now-watching-label">NOW WATCHING</span>
          <h1 className="now-watching-title">{item.title}</h1>
          <div className="now-watching-meta">
            {metaParts.join(' · ')}
            {ratingText && <> · {ratingText}</>}
          </div>
          {progress && (
            <div className="now-watching-progress-info">
              <span className="now-watching-season">
                Season {progress.currentSeason}
              </span>
              <span className="now-watching-eps">
                {progress.watched} / {progress.total} Episodes
              </span>
            </div>
          )}
          {progress && progress.total > 0 && (
            <div className="now-watching-bar-track">
              <div
                className="now-watching-bar-fill"
                style={{ width: `${(progress.watched / progress.total) * 100}%` }}
              />
            </div>
          )}
          {progress?.nextCode && (
            <button
              type="button"
              className="btn btn-primary now-watching-btn"
              onClick={() => onOpen(item.id)}
            >
              Continue {progress.nextCode}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function LibraryPage({ mediaType, onOpen }: LibraryPageProps) {
  const { items, loading, error } = useLibrary(mediaType);
  const heading =
    mediaType === 'movie' ? 'Movies' : mediaType === 'tv' ? 'TV Shows' : 'Library';

  const nowWatching = !loading && !error ? findNowWatching(items) : null;
  const gridItems = nowWatching ? items.filter((i) => i.id !== nowWatching.id) : items;

  return (
    <section>
      {nowWatching && <NowWatchingHero item={nowWatching} onOpen={onOpen} />}

      <header className="page-head">
        <h1>{heading}</h1>
        <p className="page-sub">{items.length} saved · fully available offline</p>
      </header>

      {loading && <Spinner />}
      {!loading && error && <Notice kind="error">{error}</Notice>}
      {!loading && !error && items.length === 0 && (
        <p className="empty-state">
          Nothing saved yet. Use the search box in the sidebar to add movies and shows.
        </p>
      )}

      <div className="card-grid card-grid--three">
        {gridItems.map((item) => (
          <MediaCard
            key={item.id}
            title={item.title}
            mediaType={item.media_type}
            posterPath={item.poster_path}
            releaseDate={item.release_date}
            rating={item.imdb_rating ?? item.tmdb_rating ?? null}
            badge={item.status ? STATUS_LABELS[item.status] : undefined}
            tvSummary={item.tv_summary}
            onClick={() => onOpen(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
