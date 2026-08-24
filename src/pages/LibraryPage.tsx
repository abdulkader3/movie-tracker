import { MediaCard } from '../components/MediaCard';
import { Notice } from '../components/Notice';
import { Spinner } from '../components/Spinner';
import { useLibrary } from '../hooks/useLibrary';
import type { MediaType, ProgressStatus } from '../types/media';

const STATUS_LABELS: Record<ProgressStatus, string> = {
  planned: 'Planned',
  watching: 'Watching',
  watched: 'Watched',
};

interface LibraryPageProps {
  mediaType?: MediaType;
  onOpen(mediaId: number): void;
}

export function LibraryPage({ mediaType, onOpen }: LibraryPageProps) {
  const { items, loading, error } = useLibrary(mediaType);
  const heading =
    mediaType === 'movie' ? 'Movies' : mediaType === 'tv' ? 'TV Shows' : 'Library';

  return (
    <section>
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

      <div className="card-grid">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            title={item.title}
            mediaType={item.media_type}
            posterPath={item.poster_path}
            releaseDate={item.release_date}
            rating={item.imdb_rating ?? item.tmdb_rating ?? null}
            badge={item.status ? STATUS_LABELS[item.status] : undefined}
            onClick={() => onOpen(item.id)}
          />
        ))}
      </div>
    </section>
  );
}
