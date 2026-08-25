import { useCallback, useState } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { EpisodeList } from '../components/EpisodeList';
import { Notice } from '../components/Notice';
import { Spinner } from '../components/Spinner';
import { useMediaDetail } from '../hooks/useMediaDetail';
import { imageUrl } from '../services/api/tmdb';
import { refreshMedia } from '../services/database/importer';
import { attachFile, removeFile } from '../services/database/fileRepo';
import { deleteMedia } from '../services/database/mediaRepo';
import { setEpisodeWatched, setSeasonWatched, setStatus } from '../services/database/progressRepo';
import { playFile } from '../services/player/playerService';
import type { EpisodeRecord, ProgressStatus } from '../types/media';
import { pickVideoFile } from '../utils/dialog';
import { friendlyApiError } from '../utils/errors';
import { formatDateTime, formatDate, formatRuntime, shortPath, yearOf } from '../utils/format';

const STATUS_OPTIONS: readonly ProgressStatus[] = ['planned', 'watching', 'watched'];
const STATUS_LABELS: Record<ProgressStatus, string> = {
  planned: 'Planned',
  watching: 'Watching',
  watched: 'Watched',
};

interface DetailPageProps {
  mediaId: number;
  onBack(): void;
  onDeleted(): void;
}

function InfoBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="info-card">
      <span className="info-label">{label}</span>
      <span className="info-text">{text}</span>
    </div>
  );
}

function episodeLine(episode: EpisodeRecord, future = false): string {
  const code = `S${episode.season_number.toString().padStart(2, '0')}E${episode.episode_number
    .toString()
    .padStart(2, '0')}`;
  const bits = [code, episode.name ?? 'Untitled'];
  if (episode.air_date) {
    bits.push(`${future ? 'airs' : 'aired'} ${formatDate(episode.air_date)}`);
  }
  return bits.join(' · ');
}

export function DetailPage({ mediaId, onBack, onDeleted }: DetailPageProps) {
  const { data, loading, error, reload } = useMediaDetail(mediaId);
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const runAction = useCallback(
    async (action: () => Promise<void>, successText?: string) => {
      setBusy(true);
      try {
        await action();
        await reload();
        if (successText) setNotice({ kind: 'info', text: successText });
      } catch (err) {
        console.error(err);
        setNotice({ kind: 'error', text: friendlyApiError(err) });
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  if (loading && !data) {
    return (
      <div className="page-center">
        <Spinner />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="page-center">
        <Notice kind="error">{error}</Notice>
        <button type="button" className="btn" onClick={onBack}>
          Back
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { media, seasons, episodes, movieFile, progress } = data;
  const isTv = media.media_type === 'tv';

  async function chooseMovieFile() {
    const path = await pickVideoFile();
    if (!path) return;
    await runAction(() => attachFile({ mediaId }, path));
  }

  async function chooseEpisodeFile(episode: EpisodeRecord) {
    const path = await pickVideoFile();
    if (!path) return;
    await runAction(() => attachFile({ episodeId: episode.id }, path));
  }

  function playMovie() {
    if (!movieFile) return;
    playFile(movieFile.path).catch(() =>
      setNotice({ kind: 'error', text: `Could not open file: ${movieFile.path}` }),
    );
  }

  function playEpisode(episode: EpisodeRecord) {
    if (!episode.file) return;
    playFile(episode.file.path).catch(() =>
      setNotice({ kind: 'error', text: `Could not open file: ${episode.file!.path}` }),
    );
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await deleteMedia(media.id);
      onDeleted();
    } catch (err) {
      console.error(err);
      setNotice({ kind: 'error', text: 'Could not delete this entry.' });
    }
  }

  const backdropUrl = imageUrl(media.backdrop_path, 'w780');
  const posterUrl = imageUrl(media.poster_path, 'w500');
  const seasonCardBackground = posterUrl ?? imageUrl(media.backdrop_path, 'w500');
  const year = yearOf(media.release_date);

  const metaBits: string[] = [];
  if (year != null) metaBits.push(String(year));
  metaBits.push(isTv ? 'TV series' : 'Movie');
  if (isTv && media.number_of_seasons != null) {
    metaBits.push(`${media.number_of_seasons} season${media.number_of_seasons === 1 ? '' : 's'}`);
  }
  if (isTv && media.number_of_episodes != null) {
    metaBits.push(`${media.number_of_episodes} episodes`);
  }
  if (!isTv && media.runtime) metaBits.push(formatRuntime(media.runtime));
  if (isTv && media.runtime) metaBits.push(`~${formatRuntime(media.runtime)} per ep`);
  if (media.tv_status) metaBits.push(media.tv_status);

  const todayIso = new Date().toISOString().slice(0, 10);
  const byAirDate = (a: EpisodeRecord, b: EpisodeRecord) =>
    (a.air_date ?? '').localeCompare(b.air_date ?? '') ||
    a.season_number - b.season_number ||
    a.episode_number - b.episode_number;
  const airedEpisodes = episodes.filter((e) => e.air_date != null && e.air_date <= todayIso);
  const nextUnwatched = [...airedEpisodes].sort(byAirDate).find((e) => !e.watched);
  const upcomingEpisode = episodes
    .filter((e) => e.air_date != null && e.air_date > todayIso)
    .sort(byAirDate)[0];

  const providerUrl = `https://www.themoviedb.org/${isTv ? 'tv' : 'movie'}/${media.tmdb_id}`;

  return (
    <div className="detail">
      <div className="detail-top">
        <button type="button" className="btn btn-ghost" onClick={onBack}>
          ← Back
        </button>
      </div>

      <section className="hero">
        {backdropUrl && (
          <img className="hero-backdrop" src={backdropUrl} alt="" onError={(e) => { e.currentTarget.remove(); }} />
        )}
        <div className="hero-shade" />
        <div className="hero-content">
          {posterUrl ? (
            <img className="hero-poster" src={posterUrl} alt="" />
          ) : (
            <div className="hero-poster placeholder">No poster</div>
          )}
          <div className="hero-info">
            <h1>{media.title}</h1>
            {media.original_title && media.original_title !== media.title && (
              <p className="orig-title">{media.original_title}</p>
            )}
            <p className="meta-line">{metaBits.filter(Boolean).join(' · ')}</p>

            {media.genres.length > 0 && (
              <div className="chip-row">
                {media.genres.map((genre) => (
                  <span key={genre.id} className="chip">
                    {genre.name}
                  </span>
                ))}
              </div>
            )}

            <div className="ratings-row">
              {media.imdb_rating != null && (
                <span className="rating-chip">IMDb ★ {media.imdb_rating.toFixed(1)}</span>
              )}
              {media.tmdb_rating != null && media.tmdb_rating > 0 && (
                <span className="rating-chip">TMDB {(media.tmdb_rating * 10).toFixed(0)}%</span>
              )}
              {media.imdb_id && (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => void openUrl(`https://www.imdb.com/title/${media.imdb_id}/`)}
                >
                  IMDb page
                </button>
              )}
              <button
                type="button"
                className="btn btn-small btn-ghost"
                onClick={() => void openUrl(providerUrl)}
              >
                TMDB page
              </button>
            </div>

            <div className="actions">
              {!isTv && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || !movieFile}
                  onClick={playMovie}
                >
                  Play
                </button>
              )}
              {!isTv && (
                <button type="button" className="btn" disabled={busy} onClick={() => void chooseMovieFile()}>
                  {movieFile ? 'Replace video file' : 'Choose video file'}
                </button>
              )}
              <div className="status-control" role="group" aria-label="Watch status">
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`status-btn${progress?.status === status ? ' active' : ''}`}
                    disabled={busy}
                    onClick={() => void runAction(() => setStatus(media.id, status))}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() =>
                  void runAction(
                    () => refreshMedia(media.id, media.tmdb_id, media.media_type),
                    'Metadata refreshed from TMDB.',
                  )
                }
              >
                Refresh
              </button>
              <button
                type="button"
                className={`btn ${confirmDelete ? 'btn-danger-solid' : 'btn-danger'}`}
                disabled={busy}
                onClick={handleDelete}
              >
                {confirmDelete ? 'Click again to confirm' : 'Delete'}
              </button>
            </div>

            {movieFile && !isTv && (
              <p className="file-line">
                <span title={movieFile.path}>Local file: {shortPath(movieFile.path)}</span>
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  disabled={busy}
                  onClick={() => void runAction(() => removeFile(movieFile.id))}
                >
                  Unlink
                </button>
              </p>
            )}
          </div>
        </div>
      </section>

      {notice && (
        <Notice kind={notice.kind} onClose={() => setNotice(null)}>
          {notice.text}
        </Notice>
      )}

      <section className="overview">
        <h2>Overview</h2>
        <p>{media.overview || 'No description available.'}</p>
      </section>

      {isTv && (nextUnwatched || upcomingEpisode) && (
        <section className="info-cards">
          {nextUnwatched && <InfoBox label="Continue watching" text={episodeLine(nextUnwatched)} />}
          {upcomingEpisode && (
            <InfoBox label="Upcoming episode" text={episodeLine(upcomingEpisode, true)} />
          )}
        </section>
      )}

      {isTv && (
        <EpisodeList
          seasons={seasons}
          episodes={episodes}
          backgroundUrl={seasonCardBackground}
          disabled={busy}
          onToggleWatched={(episode, watched) =>
            void runAction(() => setEpisodeWatched(media.id, episode.id, watched))
          }
          onSetSeasonWatched={(seasonNumber, watched) =>
            void runAction(() => setSeasonWatched(media.id, seasonNumber, watched))
          }
          onPickFile={(episode) => void chooseEpisodeFile(episode)}
          onPlay={playEpisode}
          onRemoveFile={(episode) => {
            if (episode.file) void runAction(() => removeFile(episode.file!.id));
          }}
        />
      )}

      <footer className="detail-foot">
        TMDB ID {media.tmdb_id}
        {media.imdb_id ? ` · IMDb ID ${media.imdb_id}` : ''} · Added{' '}
        {formatDateTime(media.created_at)}
      </footer>
    </div>
  );
}
