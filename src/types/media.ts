export type MediaType = 'movie' | 'tv';

export type ProgressStatus = 'planned' | 'watching' | 'watched';

export interface Genre {
  id: number;
  name: string;
}

export interface MediaListItem {
  id: number;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  original_title: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  imdb_rating: number | null;
  tmdb_rating: number | null;
  status: ProgressStatus | null;
}

export interface MediaRecord extends MediaListItem {
  overview: string | null;
  release_date: string | null;
  imdb_id: string | null;
  runtime: number | null;
  tv_status: string | null;
  number_of_seasons: number | null;
  number_of_episodes: number | null;
  created_at: string;
  genres: Genre[];
}

export interface SeasonRecord {
  id: number;
  media_id: number;
  tmdb_id: number | null;
  season_number: number;
  name: string | null;
  overview: string | null;
  episode_count: number | null;
  air_date: string | null;
  poster_path: string | null;
}

export interface LocalFileRecord {
  id: number;
  media_id: number | null;
  episode_id: number | null;
  path: string;
}

export interface EpisodeRecord {
  id: number;
  media_id: number;
  tmdb_id: number | null;
  season_number: number;
  episode_number: number;
  name: string | null;
  overview: string | null;
  air_date: string | null;
  runtime: number | null;
  still_path: string | null;
  watched: boolean;
  file: LocalFileRecord | null;
}

export interface MediaProgress {
  media_id: number;
  status: ProgressStatus;
  rating: number | null;
  updated_at: string;
}
