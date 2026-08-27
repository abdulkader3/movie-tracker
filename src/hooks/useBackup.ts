import { useCallback, useEffect, useRef, useState } from 'react';
import {
  performBackup,
  performRestore,
  getAvailableBackups,
  testCloudConnection,
} from '../services/backup/backupService';
import {
  setPassword as keychainSet,
  getPassword as keychainGet,
  deletePassword as keychainDelete,
} from '../services/backup/keychain';
import { AutoBackupService, type SyncStatus } from '../services/backup/autoBackupService';
import type { BackupListItem, BackupMetadata, BackupStatus } from '../services/backup/types';

const STORAGE_KEY = 'mt_last_backup';
const DIRTY_KEY = 'mt_db_dirty';
const CHECK_INTERVAL = 5 * 60 * 1000;

function readLastBackup(): BackupMetadata | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLastBackup(meta: BackupMetadata) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
}

export function markDatabaseDirty() {
  localStorage.setItem(DIRTY_KEY, '1');
}

export function useBackup() {
  const [status, setStatus] = useState<BackupStatus>('idle');
  const [lastBackup, setLastBackup] = useState<BackupMetadata | null>(readLastBackup);
  const [cloudConnected, setCloudConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableBackups, setAvailableBackups] = useState<BackupListItem[]>([]);
  const [progressMessage, setProgressMessage] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const backupInProgress = useRef(false);
  const autoBackupRef = useRef<AutoBackupService | null>(null);

  const checkCloud = useCallback(async () => {
    try {
      const ok = await testCloudConnection();
      setCloudConnected(ok);
    } catch {
      setCloudConnected(false);
    }
  }, []);

  const refreshBackups = useCallback(async () => {
    try {
      const list = await getAvailableBackups();
      setAvailableBackups(list);
    } catch {
      // offline or error - don't block
    }
  }, []);

  const checkPassword = useCallback(async () => {
    try {
      const pw = await keychainGet();
      setHasPassword(!!pw);
    } catch {
      setHasPassword(false);
    }
  }, []);

  useEffect(() => {
    checkCloud();
    refreshBackups();
    checkPassword();
  }, [checkCloud, refreshBackups, checkPassword]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      checkCloud();
    }, CHECK_INTERVAL);
    return () => window.clearInterval(interval);
  }, [checkCloud]);

  useEffect(() => {
    const svc = new AutoBackupService({
      onStatusChange: (s) => {
        setSyncStatus(s);
        if (s === 'idle') setSyncError(null);
      },
      onBackupComplete: (meta) => {
        setLastBackup(meta);
        writeLastBackup(meta);
        localStorage.removeItem(DIRTY_KEY);
        refreshBackups();
      },
      onError: (msg) => setSyncError(msg),
    });
    autoBackupRef.current = svc;
    return () => svc.stop();
  }, [refreshBackups]);

  const notifyDirty = useCallback(() => {
    localStorage.setItem(DIRTY_KEY, '1');
    autoBackupRef.current?.notifyDirty();
  }, []);

  const runBackup = useCallback(
    async (password: string) => {
      if (backupInProgress.current) return;
      backupInProgress.current = true;

      try {
        setStatus('backing-up');
        setError(null);

        const meta = await performBackup(password, (msg) => {
          setProgressMessage(msg);
          if (msg.includes('Uploading')) setStatus('uploading');
        });

        setLastBackup(meta);
        writeLastBackup(meta);
        localStorage.removeItem(DIRTY_KEY);
        setStatus('success');

        await refreshBackups();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isNetworkError = err instanceof TypeError && (
          msg.includes('Failed to fetch') ||
          msg.includes('NetworkError') ||
          msg.includes('Network request failed')
        );
        if (isNetworkError && !navigator.onLine) {
          setStatus('offline');
          setError('No internet connection. Backup will retry when online.');
        } else {
          setStatus('error');
          setError(`Upload failed: ${msg}`);
        }
      } finally {
        backupInProgress.current = false;
        setTimeout(() => {
          if (status === 'success') setStatus('idle');
        }, 3000);
      }
    },
    [refreshBackups, status],
  );

  const runRestore = useCallback(
    async (backupKey: string, password: string) => {
      try {
        setStatus('restoring');
        setError(null);
        setProgressMessage('Starting restore...');

        await performRestore(backupKey, password, (msg) => {
          setProgressMessage(msg);
          if (msg.includes('Downloading')) setStatus('downloading');
          if (msg.includes('Decrypting')) setStatus('decrypting');
        });

        setStatus('success');
        window.location.reload();
      } catch (err) {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [],
  );

  const saveAutoBackupPassword = useCallback(
    async (password: string) => {
      await keychainSet(password);
      setHasPassword(true);
    },
    [],
  );

  const clearAutoBackupPassword = useCallback(async () => {
    await keychainDelete();
    setHasPassword(false);
  }, []);

  return {
    status,
    lastBackup,
    cloudConnected,
    error,
    availableBackups,
    progressMessage,
    hasPassword,
    syncStatus,
    syncError,
    runBackup,
    runRestore,
    saveAutoBackupPassword,
    clearAutoBackupPassword,
    refreshBackups,
    checkCloud,
    markDatabaseDirty: notifyDirty,
  };
}
