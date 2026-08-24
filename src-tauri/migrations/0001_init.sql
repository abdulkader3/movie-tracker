CREATE TABLE IF NOT EXISTS media (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    tmdb_id            INTEGER NOT NULL,
    media_type         TEXT    NOT NULL CHECK (media_type IN ('movie', 'tv')),
    title              TEXT    NOT NULL,
    original_title     TEXT,
    overview           TEXT,
    poster_path        TEXT,
    backdrop_path      TEXT,
    release_date       TEXT,
    imdb_id            TEXT,
    imdb_rating        REAL,
    tmdb_rating        REAL,
    runtime            INTEGER,
    tv_status          TEXT,
    number_of_seasons  INTEGER,
    number_of_episodes INTEGER,
    raw_json           TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (tmdb_id, media_type)
);

CREATE INDEX IF NOT EXISTS idx_media_type ON media (media_type);
CREATE INDEX IF NOT EXISTS idx_media_title ON media (title);

CREATE TABLE IF NOT EXISTS genres (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS media_genres (
    media_id INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES genres (id) ON DELETE CASCADE,
    PRIMARY KEY (media_id, genre_id)
);

CREATE TABLE IF NOT EXISTS seasons (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id      INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    tmdb_id       INTEGER,
    season_number INTEGER NOT NULL,
    name          TEXT,
    overview      TEXT,
    episode_count INTEGER,
    air_date      TEXT,
    poster_path   TEXT,
    UNIQUE (media_id, season_number)
);

CREATE TABLE IF NOT EXISTS episodes (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id       INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    tmdb_id        INTEGER,
    season_number  INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    name           TEXT,
    overview       TEXT,
    air_date       TEXT,
    runtime        INTEGER,
    still_path     TEXT,
    UNIQUE (media_id, season_number, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_episodes_media ON episodes (media_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_episodes_air_date ON episodes (air_date);

CREATE TABLE IF NOT EXISTS local_files (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id   INTEGER REFERENCES media (id) ON DELETE CASCADE,
    episode_id INTEGER REFERENCES episodes (id) ON DELETE CASCADE,
    path       TEXT    NOT NULL,
    added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    CHECK (
        (media_id IS NOT NULL AND episode_id IS NULL)
        OR (episode_id IS NOT NULL AND media_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_local_files_media ON local_files (media_id);
CREATE INDEX IF NOT EXISTS idx_local_files_episode ON local_files (episode_id);

CREATE TABLE IF NOT EXISTS user_progress (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    media_id              INTEGER NOT NULL REFERENCES media (id) ON DELETE CASCADE,
    episode_id            INTEGER REFERENCES episodes (id) ON DELETE CASCADE,
    status                TEXT    NOT NULL DEFAULT 'planned'
                                  CHECK (status IN ('planned', 'watching', 'watched')),
    rating                INTEGER CHECK (rating BETWEEN 1 AND 10),
    last_position_seconds INTEGER,
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_movie
    ON user_progress (media_id) WHERE episode_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_progress_episode
    ON user_progress (episode_id) WHERE episode_id IS NOT NULL;
