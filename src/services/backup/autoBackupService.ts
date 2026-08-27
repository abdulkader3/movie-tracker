import { performBackup } from './backupService';
import { getPassword } from './keychain';
import type { BackupMetadata } from './types';

const DEBOUNCE_MS = 4000;
const MIN_SYNC_VISIBLE_MS = 2000;
const SUCCESS_VISIBLE_MS = 1000;
const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 60000;
const MAX_RETRIES = 5;

export type SyncStatus = 'idle' | 'syncing' | 'succeeded' | 'error' | 'retrying';

export interface AutoBackupCallbacks {
  onStatusChange: (status: SyncStatus) => void;
  onBackupComplete: (meta: BackupMetadata) => void;
  onError: (message: string) => void;
}

export class AutoBackupService {
  private dirty = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private successTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private running = false;
  private stopped = false;
  private syncStartedAt = 0;
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
    // If a backup is already running, keep dirty=true so a follow-up backup
    // is started once the current one finishes (after the debounce window).
    if (this.running || this.stopped || !this.dirty) return;

    const password = await getPassword();
    if (!password) {
      this.dirty = false;
      return;
    }

    this.running = true;
    this.syncStartedAt = Date.now();
    this.callbacks.onStatusChange('syncing');

    try {
      const meta = await performBackup(password);
      this.running = false;

      const wasDirtyDuringSync = this.dirty;
      this.dirty = false;
      this.retryCount = 0;

      // The actual backup finished; report success as fast as possible but
      // keep the syncing indicator visible for at least MIN_SYNC_VISIBLE_MS
      // purely for visual confirmation.
      const elapsed = Date.now() - this.syncStartedAt;
      const remaining = Math.max(0, MIN_SYNC_VISIBLE_MS - elapsed);
      setTimeout(() => {
        if (this.stopped) return;
        this.callbacks.onBackupComplete(meta);
        this.callbacks.onStatusChange('succeeded');
        this.successTimer = setTimeout(() => {
          this.successTimer = null;
          if (this.stopped) return;
          this.callbacks.onStatusChange('idle');
        }, SUCCESS_VISIBLE_MS);
      }, remaining);

      // If changes arrived during the backup, run one more backup after the
      // debounce window (the timer above just controls UI feedback, not work).
      if (wasDirtyDuringSync) {
        this.scheduleDebounce();
      }
    } catch (err) {
      this.running = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[auto-backup] Failed:', msg);

      if (this.retryCount < MAX_RETRIES) {
        this.retryCount++;
        const delay = Math.min(RETRY_BASE_MS * this.retryCount, RETRY_MAX_MS);
        this.callbacks.onStatusChange('retrying');
        this.callbacks.onError(`Backup sync failed — retrying…`);
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null;
          this.attemptBackup();
        }, delay);
      } else {
        this.callbacks.onStatusChange('error');
        this.callbacks.onError(`Backup sync failed after ${MAX_RETRIES} attempts: ${msg}`);
      }
    }
  }

  stop() {
    this.stopped = true;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    if (this.successTimer !== null) clearTimeout(this.successTimer);
  }
}
