import { invoke } from '@tauri-apps/api/core';
import { writeFile, readFile } from '@tauri-apps/plugin-fs';
import { buildEncryptedFile, encryptBackup, decryptBackup } from './encryption';
import { uploadBackup, downloadBackup, listBackups, checkConnection } from './r2Service';
import type { BackupListItem, BackupMetadata } from './types';

const BACKUP_APP_VERSION = '0.1.0';

function timestampKey(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = now.getFullYear();
  const m = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const hh = pad(now.getHours());
  const mm = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  return `backups/${y}/${m}/${d}/${hh}-${mm}-${ss}.enc`;
}

async function getAppDataDir(): Promise<string> {
  return invoke<string>('get_app_data_dir');
}

async function createDbSnapshot(destPath: string): Promise<number> {
  return invoke<number>('create_db_backup', { destPath });
}

export async function performBackup(
  password: string,
  onProgress?: (status: string) => void,
): Promise<BackupMetadata> {
  onProgress?.('Creating database snapshot...');

  const appDataDir = await getAppDataDir();
  const snapshotPath = `${appDataDir}\\backup_snapshot.db`;

  const bytesWritten = await createDbSnapshot(snapshotPath);
  if (bytesWritten === 0) {
    throw new Error('Database backup produced an empty file');
  }

  onProgress?.('Encrypting backup...');
  const snapshotData = await readFile(snapshotPath);
  const plaintext = new Uint8Array(snapshotData);

  const encryptedPayload = await encryptBackup(plaintext, password);

  const metadata: BackupMetadata = {
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion: BACKUP_APP_VERSION,
    backupSize: plaintext.length,
    encryptedSize: encryptedPayload.data.length,
  };

  const encryptedFile = buildEncryptedFile(encryptedPayload);

  onProgress?.('Uploading to cloud...');
  const key = timestampKey();
  await uploadBackup(encryptedFile, key);

  await invoke('remove_file_if_exists', { path: snapshotPath });

  onProgress?.('Backup complete');
  return metadata;
}

export async function performRestore(
  backupKey: string,
  password: string,
  onProgress?: (status: string) => void,
): Promise<void> {
  onProgress?.('Downloading backup...');
  const encryptedData = await downloadBackup(backupKey);

  onProgress?.('Decrypting backup...');
  const plaintext = await decryptBackup(encryptedData, password);

  const appDataDir = await getAppDataDir();
  const tempPath = `${appDataDir}\\restore_temp.db`;

  await writeFile(tempPath, plaintext);

  onProgress?.('Validating backup...');
  const isValid = await invoke<boolean>('validate_sqlite_file', {
    path: tempPath,
  });

  if (!isValid) {
    await invoke('remove_file_if_exists', { path: tempPath });
    throw new Error(
      'Downloaded file is not a valid SQLite database. Restore aborted.',
    );
  }

  onProgress?.('Replacing database...');
  await invoke('swap_database', { newDbPath: tempPath });

  onProgress?.('Restore complete. Reloading...');
}

export async function getAvailableBackups(): Promise<BackupListItem[]> {
  return listBackups();
}

export async function testCloudConnection(): Promise<boolean> {
  return checkConnection();
}
