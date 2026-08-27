/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TMDB_API_KEY?: string;
  readonly VITE_OMDB_API_KEY?: string;
  readonly VITE_BACKUP_SERVICE_URL?: string;
  readonly VITE_BACKUP_AUTH_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
