import Database from '@tauri-apps/plugin-sql';

let instance: Promise<Database> | null = null;

export function getDb(): Promise<Database> {
  if (!instance) {
    instance = Database.load('sqlite:movietracker.db');
  }
  return instance;
}
