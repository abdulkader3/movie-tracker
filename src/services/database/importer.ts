import { getMovieDetails, getSeasonEpisodes, getTvDetails } from '../api/tmdb';
import { fetchImdbRating } from '../api/omdb';
import { findByProviderId, updateImdbRating, upsertMedia } from './mediaRepo';
import {
  findEpisodeId,
  replaceEpisodes,
  replaceSeasons,
  snapshotEpisodeState,
} from './episodeRepo';
import type { EpisodeInput, SeasonInput } from './episodeRepo';
import { attachFile } from './fileRepo';
import { setEpisodeWatched } from './progressRepo';
import type { MediaType } from '../../types/media';
import type { TmdbSearchHit } from '../../types/tmdb';
import { markDatabaseDirty } from '../../hooks/useBackup';

async function tryEnrichImdbRating(mediaId: number, imdbId: string | null): Promise<void> {
  if (!imdbId) return;
  const rating = await fetchImdbRating(imdbId);
  if (rating != null) {
    await updateImdbRating(mediaId, rating);
  }
}

export async function importMovie(tmdbId: number): Promise<number> {
  const details = await getMovieDetails(tmdbId);
  const mediaId = await upsertMedia({
    tmdb_id: details.id,
    media_type: 'movie',
    title: details.title,
    original_title: details.original_title ?? null,
    overview: details.overview ?? null,
    poster_path: details.poster_path ?? null,
    backdrop_path: details.backdrop_path ?? null,
    release_date: details.release_date ?? null,
    imdb_id: details.imdb_id ?? null,
    imdb_rating: null,
    tmdb_rating: details.vote_average ?? null,
    runtime: details.runtime ?? null,
    tv_status: details.status ?? null,
    number_of_seasons: null,
    number_of_episodes: null,
    raw_json: JSON.stringify(details),
    genres: (details.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name })),
  });
  await tryEnrichImdbRating(mediaId, details.imdb_id ?? null);
  return mediaId;
}

export async function importTv(tmdbId: number): Promise<number> {
  const details = await getTvDetails(tmdbId);
  const mediaId = await upsertMedia({
    tmdb_id: details.id,
    media_type: 'tv',
    title: details.name,
    original_title: details.original_name ?? null,
    overview: details.overview ?? null,
    poster_path: details.poster_path ?? null,
    backdrop_path: details.backdrop_path ?? null,
    release_date: details.first_air_date ?? null,
    imdb_id: details.external_ids?.imdb_id ?? null,
    imdb_rating: null,
    tmdb_rating: details.vote_average ?? null,
    runtime: details.episode_run_time?.[0] ?? null,
    tv_status: details.status ?? null,
    number_of_seasons: details.number_of_seasons ?? null,
    number_of_episodes: details.number_of_episodes ?? null,
    raw_json: JSON.stringify(details),
    genres: (details.genres ?? []).map((genre) => ({ id: genre.id, name: genre.name })),
  });

  const seasons: SeasonInput[] = (details.seasons ?? []).map((season) => ({
    tmdb_id: season.id ?? null,
    season_number: season.season_number,
    name: season.name ?? null,
    overview: season.overview ?? null,
    episode_count: season.episode_count ?? null,
    air_date: season.air_date ?? null,
    poster_path: season.poster_path ?? null,
  }));
  await replaceSeasons(mediaId, seasons);

  const episodeInputs: EpisodeInput[] = [];
  for (const season of seasons) {
    if (!season.episode_count) continue;
    const episodes = await getSeasonEpisodes(tmdbId, season.season_number);
    for (const episode of episodes) {
      episodeInputs.push({
        tmdb_id: episode.id ?? null,
        season_number: episode.season_number,
        episode_number: episode.episode_number,
        name: episode.name ?? null,
        overview: episode.overview ?? null,
        air_date: episode.air_date ?? null,
        runtime: episode.runtime ?? null,
        still_path: episode.still_path ?? null,
      });
    }
  }
  await replaceEpisodes(mediaId, episodeInputs);
  await tryEnrichImdbRating(mediaId, details.external_ids?.imdb_id ?? null);
  return mediaId;
}

export async function saveFromSearch(hit: TmdbSearchHit): Promise<number> {
  const existing = await findByProviderId(hit.id, hit.media_type);
  if (existing) return existing.id;
  const id = hit.media_type === 'movie' ? await importMovie(hit.id) : await importTv(hit.id);
  markDatabaseDirty();
  return id;
}

export async function refreshMedia(
  mediaId: number,
  tmdbId: number,
  mediaType: MediaType,
): Promise<void> {
  if (mediaType === 'movie') {
    await importMovie(tmdbId);
    markDatabaseDirty();
    return;
  }
  const snapshot = await snapshotEpisodeState(mediaId);
  await importTv(tmdbId);
  for (const [key, entry] of snapshot) {
    const [seasonPart, episodePart] = key.split(':');
    const freshEpisodeId = await findEpisodeId(mediaId, Number(seasonPart), Number(episodePart));
    if (freshEpisodeId == null) continue;
    if (entry.watched) {
      await setEpisodeWatched(mediaId, freshEpisodeId, true);
    }
    if (entry.path) {
      await attachFile({ episodeId: freshEpisodeId }, entry.path);
    }
  }
  markDatabaseDirty();
}
