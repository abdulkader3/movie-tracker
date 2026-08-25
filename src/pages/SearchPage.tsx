import { useEffect, useState } from 'react';
import { MediaCard } from '../components/MediaCard';
import { Notice } from '../components/Notice';
import { Spinner } from '../components/Spinner';
import { useSearch } from '../hooks/useSearch';
import { getAllProviderKeys } from '../services/database/mediaRepo';
import { searchOmdb } from '../services/api/omdb';
import type { OmdbSearchItem } from '../types/tmdb';
import { friendlyApiError } from '../utils/errors';

interface SearchPageProps {
  query: string;
  savingTitle: string | null;
  onSelect(hit: { id: number; media_type: 'movie' | 'tv'; title?: string; name?: string; poster_path: string | null; release_date?: string; first_air_date?: string; vote_average: number }): void;
}

export function SearchPage({ query, savingTitle, onSelect }: SearchPageProps) {
  const trimmed = query.trim();
  const { results, loading, error, search } = useSearch();
  const [savedKeys, setSavedKeys] = useState<ReadonlySet<string>>(new Set());
  const [omdbResults, setOmdbResults] = useState<OmdbSearchItem[]>([]);
  const [omdbLoading, setOmdbLoading] = useState(false);
  const [omdbError, setOmdbError] = useState<string | null>(null);
  const [omdbSearched, setOmdbSearched] = useState(false);
  const [omdbQuery, setOmdbQuery] = useState('');

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

  useEffect(() => {
    if (trimmed.length >= 2) {
      search(trimmed);
      setOmdbResults([]);
      setOmdbSearched(false);
      setOmdbError(null);
      setOmdbQuery('');
    }
  }, [trimmed, search]);

  async function handleSearchFurther() {
    if (omdbSearched || !trimmed) return;
    setOmdbLoading(true);
    setOmdbError(null);
    try {
      const items = await searchOmdb(trimmed);
      setOmdbResults(items);
      setOmdbSearched(true);
      setOmdbQuery(trimmed);
    } catch (err) {
      console.error(err);
      setOmdbError(friendlyApiError(err));
    } finally {
      setOmdbLoading(false);
    }
  }

  if (trimmed.length < 2) {
    return (
      <p className="page-hint">Type at least two characters, then press Enter or click Search to find movies and shows on TMDB.</p>
    );
  }

  return (
    <section>
      <header className="page-head">
        <h1>Results for "{trimmed}"</h1>
        <p className="page-sub">Select an entry to fetch its details and store it locally.</p>
      </header>

      {loading && <Spinner label="Searching TMDB…" />}
      {!loading && error && <Notice kind="error">{error}</Notice>}
      {!loading && !error && results.length === 0 && (
        <p className="empty-state">No matches found for "{trimmed}".</p>
      )}

      <div className="card-grid card-grid--three">
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

      {!loading && !error && results.length > 0 && (
        <div className="search-further-section">
          {!omdbSearched && (
            <button
              type="button"
              className="btn search-further-btn"
              onClick={handleSearchFurther}
              disabled={omdbLoading}
            >
              Search further
            </button>
          )}

          {omdbSearched && omdbQuery && (
            <>
              <div className="omdb-divider" />
              <h2 className="omdb-heading">Result from OMDB</h2>
              {omdbError && <Notice kind="error">{omdbError}</Notice>}
              {!omdbError && omdbResults.length === 0 && (
                <p className="empty-state">No OMDb results found for "{omdbQuery}".</p>
              )}
              <div className="card-grid card-grid--three">
                {omdbResults.map((item) => (
                  <MediaCard
                    key={`omdb-${item.imdbID}`}
                    title={item.Title}
                    mediaType={item.Type === 'series' ? 'tv' : 'movie'}
                    posterPath={item.Poster && item.Poster !== 'N/A' ? item.Poster.replace('http://', 'https://') : null}
                    releaseDate={item.Year ? `${item.Year}-01-01` : null}
                    rating={null}
                    badge={savedKeys.has(`omdb:${item.imdbID}`) ? 'In library' : undefined}
                  />
                ))}
              </div>
            </>
          )}

          {omdbLoading && <Spinner label="Searching OMDb…" />}
        </div>
      )}
    </section>
  );
}
