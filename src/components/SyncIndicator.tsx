import type { SyncStatus } from '../services/backup/autoBackupService';

interface SyncIndicatorProps {
  syncStatus: SyncStatus;
  syncError: string | null;
}

export function SyncIndicator({ syncStatus, syncError }: SyncIndicatorProps) {
  if (syncStatus === 'idle') return null;

  return (
    <div className={`sync-indicator sync-${syncStatus}`}>
      {syncStatus === 'syncing' && (
        <>
          <span className="sync-spinner" />
          Syncing backup…
        </>
      )}
      {syncStatus === 'succeeded' && (
        <>
          <span className="sync-check">✓</span>
          Backup synced
        </>
      )}
      {syncStatus === 'retrying' && (
        <>
          <span className="sync-spinner" />
          {syncError || 'Backup sync failed — retrying…'}
        </>
      )}
      {syncStatus === 'error' && (
        <span className="sync-error-text">
          {syncError || 'Backup sync failed'}
        </span>
      )}
    </div>
  );
}
