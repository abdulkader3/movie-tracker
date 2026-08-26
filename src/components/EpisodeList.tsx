import { useEffect, useMemo, useRef, useState } from 'react';
import type { EpisodeRecord, SeasonRecord } from '../types/media';
import { fileName, formatDate, formatRuntime, pad2 } from '../utils/format';

interface EpisodeListProps {
  seasons: SeasonRecord[];
  episodes: EpisodeRecord[];
  backgroundUrl: string | null;
  disabled: boolean;
  onToggleWatched(episode: EpisodeRecord, watched: boolean): void;
  onSetSeasonWatched(seasonNumber: number, watched: boolean): void;
  onPickFile(episode: EpisodeRecord): void;
  onPlay(episode: EpisodeRecord): void;
  onRemoveFile(episode: EpisodeRecord): void;
  onRemoveSeasonFiles(seasonNumber: number): void;
}

interface SeasonGroup {
  number: number;
  name: string;
  episodes: EpisodeRecord[];
  total: number;
  watchedCount: number;
  complete: boolean;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
      <path
        d="M3 8.5L6.5 12L13 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <circle cx="3" cy="8" r="1.3" fill="currentColor" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
      <circle cx="13" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function seasonLabel(seasonNumber: number): string {
  return seasonNumber === 0 ? 'SP' : `S${seasonNumber}`;
}

export function EpisodeList({
  seasons,
  episodes,
  backgroundUrl,
  disabled,
  onToggleWatched,
  onSetSeasonWatched,
  onPickFile,
  onPlay,
  onRemoveFile,
  onRemoveSeasonFiles,
}: EpisodeListProps) {
  const [expandedSeason, setExpandedSeason] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const groups = useMemo<SeasonGroup[]>(() => {
    const bySeason = new Map<number, EpisodeRecord[]>();
    for (const episode of episodes) {
      const list = bySeason.get(episode.season_number) ?? [];
      list.push(episode);
      bySeason.set(episode.season_number, list);
    }
    return [...bySeason.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, list]) => {
        const sorted = [...list].sort((a, b) => a.episode_number - b.episode_number);
        const watchedCount = sorted.filter((episode) => episode.watched).length;
        return {
          number,
          name:
            seasons.find((season) => season.season_number === number)?.name ??
            (number === 0 ? 'Specials' : `Season ${number}`),
          episodes: sorted,
          total: sorted.length,
          watchedCount,
          complete: sorted.length > 0 && watchedCount === sorted.length,
        };
      });
  }, [seasons, episodes]);

  useEffect(() => {
    const firstIncomplete = groups.find((group) => !group.complete);
    if (firstIncomplete) {
      setExpandedSeason(firstIncomplete.number);
    }
  }, [groups]);

  useEffect(() => {
    if (!openMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openMenu]);

  function toggleMenu(key: string) {
    setOpenMenu((prev) => (prev === key ? null : key));
  }

  function closeMenu() {
    setOpenMenu(null);
  }

  if (!groups.length) {
    return (
      <section className="episodes">
        <h2>Episodes</h2>
        <p className="empty-state">No episodes stored yet. Use "Refresh" to fetch them.</p>
      </section>
    );
  }

  const activeGroup =
    expandedSeason != null ? groups.find((group) => group.number === expandedSeason) ?? null : null;
  const firstIncomplete = groups.find((group) => !group.complete);

  const bgStyle = backgroundUrl ? { backgroundImage: `url("${backgroundUrl}")` } : undefined;

  return (
    <section className="episodes">
      <h2>Episodes</h2>
      <div className="season-grid">
        {groups.map((group) => {
          const isCurrent = group === firstIncomplete;
          const classes = [
            'season-card',
            group.complete ? 'complete' : '',
            isCurrent ? 'current' : '',
            group.number === expandedSeason ? 'expanded' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={group.number}
              type="button"
              className={classes}
              onClick={() =>
                setExpandedSeason((current) => (current === group.number ? null : group.number))
              }
              aria-expanded={group.number === expandedSeason}
            >
              <span className="season-card-bg" style={bgStyle} />
              <span className="season-card-shade" />
              {group.complete && (
                <span className="season-card-check" title="Season completed">
                  <CheckIcon />
                </span>
              )}
              <span className="season-card-body">
                <span className="season-card-name">{group.name}</span>
                <span className={`season-card-progress${group.complete ? ' done' : ''}`}>
                  {group.complete && <CheckIcon />}
                  {group.watchedCount}/{group.total} watched
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <div className="season-panel">
          <div className="season-panel-head">
            <h3>{activeGroup.name}</h3>
            <span className={`season-panel-progress${activeGroup.complete ? ' done' : ''}`}>
              {activeGroup.complete && <CheckIcon />}
              {activeGroup.watchedCount}/{activeGroup.total} watched
            </span>
            <div className="season-panel-actions">
              <div className="dot-menu" ref={openMenu === `season:${activeGroup.number}` ? menuRef : undefined}>
                <button
                  type="button"
                  className="dot-menu-btn"
                  disabled={disabled}
                  title="Season file actions"
                  onClick={(e) => { e.stopPropagation(); toggleMenu(`season:${activeGroup.number}`); }}
                >
                  <DotsIcon />
                </button>
                {openMenu === `season:${activeGroup.number}` && (
                  <div className="dot-menu-dropdown">
                    <button
                      type="button"
                      className="dot-menu-item danger"
                      disabled={disabled}
                      onClick={() => { closeMenu(); onRemoveSeasonFiles(activeGroup.number); }}
                    >
                      Remove all files for this season
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`btn btn-small ${activeGroup.complete ? '' : 'btn-primary'}`}
                disabled={disabled}
                onClick={() => onSetSeasonWatched(activeGroup.number, !activeGroup.complete)}
              >
                {activeGroup.complete ? 'Mark season unwatched' : 'Mark season watched'}
              </button>
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => setExpandedSeason(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="episode-grid">
            {activeGroup.episodes.map((episode) => (
              <div key={episode.id} className={`episode-tile${episode.watched ? ' watched' : ''}`}>
                <div className="tile-top">
                  <label className="tile-watch">
                    <input
                      type="checkbox"
                      checked={episode.watched}
                      disabled={disabled}
                      onChange={(event) => onToggleWatched(episode, event.target.checked)}
                    />
                    <span className="tile-code">
                      {seasonLabel(episode.season_number)}E{pad2(episode.episode_number)}
                    </span>
                  </label>
                  <span
                    className={`file-indicator${episode.file ? ' has' : ''}`}
                    title={episode.file ? episode.file.path : 'No file linked'}
                  >
                    {episode.file ? 'file' : 'no file'}
                  </span>
                </div>
                <span className="tile-name" title={episode.name ?? undefined}>
                  {episode.name ?? 'Untitled'}
                </span>
                <span className="tile-sub">
                  {[
                    episode.air_date ? formatDate(episode.air_date) : 'No air date',
                    formatRuntime(episode.runtime),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {episode.file && (
                  <span className="tile-file" title={episode.file.path}>
                    {fileName(episode.file.path)}
                  </span>
                )}
                <div className="tile-actions">
                  {episode.file ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-small btn-primary"
                        disabled={disabled}
                        onClick={() => onPlay(episode)}
                      >
                        Play
                      </button>
                      <div
                        className="dot-menu"
                        ref={openMenu === `ep:${episode.id}` ? menuRef : undefined}
                      >
                        <button
                          type="button"
                          className="dot-menu-btn"
                          disabled={disabled}
                          title="File actions"
                          onClick={(e) => { e.stopPropagation(); toggleMenu(`ep:${episode.id}`); }}
                        >
                          <DotsIcon />
                        </button>
                        {openMenu === `ep:${episode.id}` && (
                          <div className="dot-menu-dropdown">
                            <button
                              type="button"
                              className="dot-menu-item"
                              disabled={disabled}
                              onClick={() => { closeMenu(); onPickFile(episode); }}
                            >
                              Replace file
                            </button>
                            <button
                              type="button"
                              className="dot-menu-item danger"
                              disabled={disabled}
                              onClick={() => { closeMenu(); onRemoveFile(episode); }}
                            >
                              Remove file link
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-small"
                      disabled={disabled}
                      onClick={() => onPickFile(episode)}
                    >
                      Set file
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
