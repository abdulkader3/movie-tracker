export interface TmdbSearchItem {
  id: number;
  media_type: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average: number;
}

export type TmdbSearchHit = Omit<TmdbSearchItem, 'media_type'> & { media_type: 'movie' | 'tv' };

export interface TmdbGenreDto {
  id: number;
  name: string;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string | null;
  runtime?: number | null;
  status?: string;
  vote_average?: number;
  imdb_id?: string | null;
  genres?: TmdbGenreDto[];
}

export interface TmdbSeasonSummary {
  id: number;
  season_number: number;
  name?: string;
  overview?: string;
  episode_count?: number;
  air_date?: string | null;
  poster_path?: string | null;
}

export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string | null;
  status?: string;
  vote_average?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  genres?: TmdbGenreDto[];
  seasons?: TmdbSeasonSummary[];
  external_ids?: { imdb_id?: string | null };
}

export interface TmdbEpisode {
  id: number;
  season_number: number;
  episode_number: number;
  name?: string;
  overview?: string;
  air_date?: string | null;
  runtime?: number | null;
  still_path?: string | null;
}

export interface OmdbRatingResponse {
  Response?: 'True' | 'False';
  imdbRating?: string;
}
