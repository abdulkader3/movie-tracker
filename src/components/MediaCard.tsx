import { useState } from 'react';
import { imageUrl } from '../services/api/tmdb';
import type { MediaType, TvSummary } from '../types/media';
import { pad2, yearOf } from '../utils/format';

const TYPE_LABEL: Record<MediaType, string> = { movie: 'Movie', tv: 'Series' };

const MAX_SEASON_CHIPS = 8;

interface MediaCardProps {
  title: string;
  mediaType: MediaType;
  posterPath: string | null;
  releaseDate?: string | null;
  rating?: number | null;
  badge?: string;
  tvSummary?: TvSummary;
  onClick?(): void;
}

function episodeCode(seasonNumber: number, episodeNumber: number): string {
  return `S${pad2(seasonNumber)}E${pad2(episodeNumber)}`;
}

function SeasonChips({ summary }: { summary: TvSummary }) {
  const visible = summary.seasons.slice(0, MAX_SEASON_CHIPS);
  const hidden = summary.seasons.length - visible.length;
  return (
    <span className="card-tv-summary">
      {visible.map((season) => {
        if (season.total > 0 && season.watched >= season.total) {
          return (
            <span key={season.season_number} className="tv-chip done" title="Season completed">
              ✓ {season.season_number === 0 ? 'SP' : `S${season.season_number}`}
            </span>
          );
        }
        const inProgress = season.watched > 0 && season.watched < season.total;
        return (
          <span
            key={season.season_number}
            className={`tv-chip${inProgress ? ' now' : ''}`}
            title={`${season.watched}/${season.total} watched`}
          >
            {inProgress
              ? `${season.season_number === 0 ? 'SP' : `S${season.season_number}`} ${season.watched}/${season.total}`
              : season.season_number === 0
                ? 'SP'
                : `S${season.season_number}`}
          </span>
        );
      })}
      {hidden > 0 && <span className="tv-chip">+{hidden}</span>}
    </span>
  );
}

export function MediaCard({
  title,
  mediaType,
  posterPath,
  releaseDate,
  rating,
  badge,
  tvSummary,
  onClick,
}: MediaCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const posterUrl = imageUrl(posterPath, 'w342');
  const year = yearOf(releaseDate ?? null);

  const metaParts = [TYPE_LABEL[mediaType], year != null ? String(year) : '—'];
  const ratingText = rating != null && rating > 0 ? ` · ★ ${rating.toFixed(1)}` : '';

  const nextCode =
    tvSummary?.next_episode != null
      ? episodeCode(tvSummary.next_episode.season_number, tvSummary.next_episode.episode_number)
      : null;
  const lastCode =
    !nextCode && tvSummary?.last_watched != null
      ? episodeCode(tvSummary.last_watched.season_number, tvSummary.last_watched.episode_number)
      : null;
  const continueTitle = nextCode
    ? tvSummary?.next_episode?.name ?? undefined
    : lastCode
      ? tvSummary?.last_watched?.name ?? undefined
      : undefined;

  return (
    <button className="media-card" onClick={onClick} disabled={!onClick}>
      <div className="poster-box">
        {posterUrl && !imageFailed ? (
          <img src={posterUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="poster-fallback">No poster</span>
        )}
        {badge && <span className="card-badge">{badge}</span>}
      </div>
      <div className="card-body">
        <span className="card-title" title={title}>
          {title}
        </span>
        <span className="card-meta">
          {metaParts.join(' · ')}
          {ratingText}
        </span>
        {tvSummary && tvSummary.seasons.length > 0 && <SeasonChips summary={tvSummary} />}
        {(nextCode || lastCode) && (
          <span className="card-continue" title={continueTitle}>
            {nextCode ? `Continue: ${nextCode}` : `Last watched: ${lastCode}`}
          </span>
        )}
      </div>
    </button>
  );
}
