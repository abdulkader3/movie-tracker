import { useEffect, useState } from 'react';
import { MediaCard } from '../components/MediaCard';
import { Notice } from '../components/Notice';
import { Spinner } from '../components/Spinner';
import { useSearch } from '../hooks/useSearch';
import { getAllProviderKeys } from '../services/database/mediaRepo';
import type { TmdbSearchHit } from '../types/tmdb';

interface SearchPageProps {
  query: string;
  savingTitle: string | null;
  onSelect(hit: TmdbSearchHit): void;
}

export function SearchPage({ query, savingTitle, onSelect }: SearchPageProps) {
  const trimmed = query.trim();
  const { results, loading, error } = useSearch(query);
  const [savedKeys, setSavedKeys] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    getAllProviderKeys()
      .then((keys) => {
        if (!cancelled) setSavedKeys(keys);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, []);

  if (trimmed.length < 2) {
    return (
      <p className="page-hint">Type at least two characters to search TMDB for movies and shows.</p>
    );
  }

  return (
    <section>
      <header className="page-head">
        <h1>Results for “{trimmed}”</h1>
        <p className="page-sub">Select an entry to fetch its details and store it locally.</p>
      </header>

      {loading && <Spinner label="Searching TMDB…" />}
      {!loading && error && <Notice kind="error">{error}</Notice>}
      {!loading && !error && results.length === 0 && (
        <p className="empty-state">No matches found for “{trimmed}”.</p>
      )}

      <div className="card-grid">
        {results.map((hit) => (
          <MediaCard
            key={`${hit.media_type}-${hit.id}`}
            title={hit.title ?? hit.name ?? 'Untitled'}
            mediaType={hit.media_type}
            posterPath={hit.poster_path}
            releaseDate={hit.release_date ?? hit.first_air_date ?? null}
            rating={hit.vote_average || null}
            badge={savedKeys.has(`${hit.media_type}:${hit.id}`) ? 'In library' : undefined}
            onClick={savingTitle ? undefined : () => onSelect(hit)}
          />
        ))}
      </div>
    </section>
  );
}
