import { useMemo } from 'react';
import type { EpisodeRecord, SeasonRecord } from '../types/media';
import { fileName, formatDate, formatRuntime, pad2 } from '../utils/format';

interface EpisodeListProps {
  seasons: SeasonRecord[];
  episodes: EpisodeRecord[];
  disabled: boolean;
  onToggleWatched(episode: EpisodeRecord, watched: boolean): void;
  onPickFile(episode: EpisodeRecord): void;
  onPlay(episode: EpisodeRecord): void;
  onRemoveFile(episode: EpisodeRecord): void;
}

interface SeasonGroup {
  number: number;
  name: string;
  episodes: EpisodeRecord[];
  watchedCount: number;
}

export function EpisodeList({
  seasons,
  episodes,
  disabled,
  onToggleWatched,
  onPickFile,
  onPlay,
  onRemoveFile,
}: EpisodeListProps) {
  const groups = useMemo<SeasonGroup[]>(() => {
    const bySeason = new Map<number, EpisodeRecord[]>();
    for (const episode of episodes) {
      const list = bySeason.get(episode.season_number) ?? [];
      list.push(episode);
      bySeason.set(episode.season_number, list);
    }
    return [...bySeason.entries()]
      .sort(([a], [b]) => a - b)
      .map(([number, list]) => ({
        number,
        name:
          seasons.find((season) => season.season_number === number)?.name ??
          (number === 0 ? 'Specials' : `Season ${number}`),
        episodes: [...list].sort((a, b) => a.episode_number - b.episode_number),
        watchedCount: list.filter((episode) => episode.watched).length,
      }));
  }, [seasons, episodes]);

  if (!groups.length) {
    return (
      <section className="episodes">
        <h2>Episodes</h2>
        <p className="empty-state">No episodes stored yet. Use “Refresh” to fetch them.</p>
      </section>
    );
  }

  return (
    <section className="episodes">
      <h2>Episodes</h2>
      {groups.map((group) => (
        <details key={group.number} className="season">
          <summary>
            <span className="season-name">{group.name}</span>
            <span className="season-count">
              {group.watchedCount}/{group.episodes.length} watched
            </span>
          </summary>
          <ul className="episode-list">
            {group.episodes.map((episode) => (
              <li key={episode.id} className={`episode-row${episode.watched ? ' watched' : ''}`}>
                <label className="watch-toggle">
                  <input
                    type="checkbox"
                    checked={episode.watched}
                    disabled={disabled}
                    onChange={(event) => onToggleWatched(episode, event.target.checked)}
                  />
                  <span className="episode-code">
                    S{pad2(episode.season_number)}E{pad2(episode.episode_number)}
                  </span>
                </label>

                <div className="episode-main">
                  <span className="episode-name">{episode.name ?? 'Untitled'}</span>
                  <span className="episode-sub">
                    {[
                      episode.air_date ? formatDate(episode.air_date) : 'No air date',
                      formatRuntime(episode.runtime),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>

                {episode.file && (
                  <span className="file-name" title={episode.file.path}>
                    {fileName(episode.file.path)}
                  </span>
                )}

                <div className="episode-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={disabled}
                    onClick={() => onPickFile(episode)}
                  >
                    {episode.file ? 'Replace' : 'Set file'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-small btn-primary"
                    disabled={disabled || !episode.file}
                    onClick={() => onPlay(episode)}
                  >
                    Play
                  </button>
                  {episode.file && (
                    <button
                      type="button"
                      className="btn btn-small btn-ghost"
                      title="Remove file link"
                      disabled={disabled}
                      onClick={() => onRemoveFile(episode)}
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
