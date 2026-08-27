export const BACKUP_MAGIC = new Uint8Array([0x4d, 0x54, 0x42, 0x4b]); // "MTBK"
export const BACKUP_VERSION = 1;
export const PBKDF2_ITERATIONS = 600_000;
export const SALT_LENGTH = 16;
export const IV_LENGTH = 12;
export const KEY_LENGTH = 256;

export interface BackupMetadata {
  version: number;
  createdAt: string;
  appVersion: string;
  backupSize: number;
  encryptedSize: number;
}

export interface BackupListItem {
  key: string;
  size: number;
  lastModified: string;
}

export type BackupStatus =
  | 'idle'
  | 'backing-up'
  | 'uploading'
  | 'restoring'
  | 'downloading'
  | 'decrypting'
  | 'success'
  | 'error'
  | 'offline'
  | 'pending';

export interface BackupState {
  status: BackupStatus;
  lastBackup: BackupMetadata | null;
  lastBackupTime: string | null;
  backupSize: number | null;
  cloudConnected: boolean;
  error: string | null;
  availableBackups: BackupListItem[];
}
