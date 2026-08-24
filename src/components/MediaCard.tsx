import { useState } from 'react';
import { imageUrl } from '../services/api/tmdb';
import type { MediaType } from '../types/media';
import { yearOf } from '../utils/format';

const TYPE_LABEL: Record<MediaType, string> = { movie: 'Movie', tv: 'Series' };

interface MediaCardProps {
  title: string;
  mediaType: MediaType;
  posterPath: string | null;
  releaseDate?: string | null;
  rating?: number | null;
  badge?: string;
  onClick?(): void;
}

export function MediaCard({
  title,
  mediaType,
  posterPath,
  releaseDate,
  rating,
  badge,
  onClick,
}: MediaCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const posterUrl = imageUrl(posterPath, 'w342');
  const year = yearOf(releaseDate ?? null);

  const metaParts = [TYPE_LABEL[mediaType], year != null ? String(year) : '—'];
  const ratingText = rating != null && rating > 0 ? ` · ★ ${rating.toFixed(1)}` : '';

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
      </div>
    </button>
  );
}
