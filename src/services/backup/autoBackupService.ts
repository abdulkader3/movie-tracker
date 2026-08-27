import { performBackup } from './backupService';
import { getPassword } from './keychain';
import type { BackupMetadata } from './types';

const DEBOUNCE_MS = 2000;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;
const MAX_RETRIES = 5;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'retrying';

export interface AutoBackupCallbacks {
  onStatusChange: (status: SyncStatus) => void;
  onBackupComplete: (meta: BackupMetadata) => void;
  onError: (message: string) => void;
}

export class AutoBackupService {
  private dirty = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private running = false;
  private stopped = false;
  private callbacks: AutoBackupCallbacks;

  constructor(callbacks: AutoBackupCallbacks) {
    this.callbacks = callbacks;
  }

  notifyDirty() {
    if (this.stopped) return;
    this.dirty = true;
    this.scheduleDebounce();
  }

  private scheduleDebounce() {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.attemptBackup();
    }, DEBOUNCE_MS);
  }

  private async attemptBackup() {
    if (this.running || this.stopped || !this.dirty) return;

    const password = await getPassword();
    if (!password) {
      this.dirty = false;
      return;
    }

    this.running = true;
    this.callbacks.onStatusChange('syncing');

    try {
      const meta = await performBackup(password);
      this.dirty = false;
      this.retryCount = 0;
      this.running = false;
      this.callbacks.onStatusChange('idle');
      this.callbacks.onBackupComplete(meta);
    } catch (err) {
      this.running = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[auto-backup] Failed:', msg);

      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++;
        const delay = Math.min(RETRY_BASE_MS * this.retryCount, RETRY_MAX_MS);
        this.callbacks.onStatusChange('retrying');
        this.callbacks.onError(`Backup failed, retrying in ${Math.round(delay / 1000)}s...`);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.attemptBackup();
        }, delay);
      } else {
        this.callbacks.onStatusChange('error');
        this.callbacks.onError(`Backup failed after ${MAX_RETRIES} attempts: ${msg}`);
      }
    }
  }

  stop() {
    this.stopped = true;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
  }
}
