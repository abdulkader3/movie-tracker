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
      {syncStatus === 'retrying' && (
        <>
          <span className="sync-spinner" />
          {syncError || 'Retrying backup…'}
        </>
      )}
      {syncStatus === 'error' && (
        <span className="sync-error-text">
          {syncError || 'Backup failed'}
        </span>
      )}
    </div>
  );
}
