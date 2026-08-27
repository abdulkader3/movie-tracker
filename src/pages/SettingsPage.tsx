import { useState } from 'react';
import type { BackupListItem, BackupMetadata, BackupStatus } from '../services/backup/types';

interface SettingsPageProps {
  lastBackup: BackupMetadata | null;
  cloudConnected: boolean;
  status: BackupStatus;
  error: string | null;
  availableBackups: BackupListItem[];
  progressMessage: string;
  hasPassword: boolean;
  onBackup: (password: string) => void;
  onRestore: (key: string, password: string) => void;
  onRefresh: () => void;
  onSaveAutoPassword: (password: string) => void;
  onClearAutoPassword: () => void;
}

function statusLabel(s: BackupStatus): string {
  switch (s) {
    case 'idle': return 'Ready';
    case 'backing-up': return 'Creating snapshot...';
    case 'uploading': return 'Uploading...';
    case 'restoring': return 'Preparing restore...';
    case 'downloading': return 'Downloading backup...';
    case 'decrypting': return 'Decrypting...';
    case 'success': return 'Complete';
    case 'error': return 'Error';
    case 'offline': return 'Offline';
    case 'pending': return 'Pending';
    default: return 'Unknown';
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsPage({
  lastBackup,
  cloudConnected,
  status,
  error,
  availableBackups,
  progressMessage,
  hasPassword,
  onBackup,
  onRestore,
  onRefresh,
  onSaveAutoPassword,
  onClearAutoPassword,
}: SettingsPageProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showRestore, setShowRestore] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const [restorePassword, setRestorePassword] = useState('');
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [autoPassword, setAutoPassword] = useState('');
  const [autoConfirm, setAutoConfirm] = useState('');

  const isBusy = status === 'backing-up' || status === 'uploading' ||
    status === 'restoring' || status === 'downloading' || status === 'decrypting';

  function handleBackup() {
    if (!password || password !== confirmPassword) return;
    onBackup(password);
  }

  function handleRestore() {
    if (!selectedBackup || !restorePassword) return;
    if (!confirmRestore) {
      setConfirmRestore(true);
      return;
    }
    onRestore(selectedBackup, restorePassword);
  }

  return (
    <div className="settings-page">
      <div className="page-head">
        <h1>Backup & Recovery</h1>
        <p className="page-sub">
          Encrypt and back up your Movie Tracker database to the cloud.
        </p>
      </div>

      <div className="backup-status-grid">
        <div className="info-card">
          <span className="info-label">Status</span>
          <span className="info-text">{statusLabel(status)}</span>
        </div>
        <div className="info-card">
          <span className="info-label">Cloud</span>
          <span className="info-text" style={{ color: cloudConnected ? 'var(--ok)' : 'var(--danger)' }}>
            {cloudConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <div className="info-card">
          <span className="info-label">Last Backup</span>
          <span className="info-text">{formatDate(lastBackup?.createdAt ?? null)}</span>
        </div>
        <div className="info-card">
          <span className="info-label">Backup Size</span>
          <span className="info-text">
            {lastBackup ? formatBytes(lastBackup.backupSize) : '---'}
          </span>
        </div>
      </div>

      {progressMessage && (
        <div className="notice info">
          <span>{progressMessage}</span>
        </div>
      )}

      {error && (
        <div className="notice error">
          <span>{error}</span>
        </div>
      )}

      <h2>Automatic Cloud Backup</h2>
      <div className="backup-form">
        <p className="form-hint">
          Save your encryption password to the OS keychain. The app will
          automatically back up your library after each change.
        </p>
        {hasPassword ? (
          <div className="auto-backup-active">
            <span className="auto-backup-badge">Active</span>
            <span className="auto-backup-text">
              Password saved in OS keychain. Auto-backup is enabled.
            </span>
            <button
              className="btn btn-ghost"
              onClick={onClearAutoPassword}
            >
              Disable Auto-Backup
            </button>
          </div>
        ) : (
          <div className="auto-backup-setup">
            <div className="form-row">
              <label className="form-label">
                Encryption Password
                <input
                  className="search-input"
                  type="password"
                  placeholder="Enter encryption password"
                  value={autoPassword}
                  onChange={(e) => setAutoPassword(e.target.value)}
                />
              </label>
              <label className="form-label">
                Confirm Password
                <input
                  className="search-input"
                  type="password"
                  placeholder="Confirm password"
                  value={autoConfirm}
                  onChange={(e) => setAutoConfirm(e.target.value)}
                />
              </label>
            </div>
            {autoPassword && autoConfirm && autoPassword !== autoConfirm && (
              <p className="form-error">Passwords do not match</p>
            )}
            <button
              className="btn btn-primary"
              disabled={!autoPassword || autoPassword !== autoConfirm}
              onClick={() => {
                if (autoPassword && autoPassword === autoConfirm) {
                  onSaveAutoPassword(autoPassword);
                  setAutoPassword('');
                  setAutoConfirm('');
                }
              }}
            >
              Enable Auto-Backup
            </button>
          </div>
        )}
      </div>

      <h2>Create Backup</h2>
      <div className="backup-form">
        <div className="form-row">
          <label className="form-label">
            Encryption Password
            <input
              className="search-input"
              type="password"
              placeholder="Enter encryption password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isBusy}
            />
          </label>
          <label className="form-label">
            Confirm Password
            <input
              className="search-input"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isBusy}
            />
          </label>
        </div>
        {password && confirmPassword && password !== confirmPassword && (
          <p className="form-error">Passwords do not match</p>
        )}
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleBackup}
            disabled={isBusy || !password || password !== confirmPassword}
          >
            {isBusy ? 'Working...' : 'Backup Now'}
          </button>
          <button
            className="btn"
            onClick={onRefresh}
            disabled={isBusy}
          >
            Refresh
          </button>
        </div>
      </div>

      <h2>Restore from Backup</h2>
      <div className="backup-form">
        {!showRestore ? (
          <button
            className="btn"
            onClick={() => { setShowRestore(true); onRefresh(); }}
          >
            Show Available Backups
          </button>
        ) : (
          <>
            {availableBackups.length === 0 ? (
              <p className="empty-state">No backups found in the cloud.</p>
            ) : (
              <div className="backup-list">
                {availableBackups.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    className={`backup-list-item${selectedBackup === b.key ? ' selected' : ''}`}
                    onClick={() => setSelectedBackup(b.key)}
                  >
                    <span className="backup-list-key">{b.key.split('/').pop()}</span>
                    <span className="backup-list-meta">
                      {formatBytes(b.size)} &middot; {formatDate(b.lastModified)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {selectedBackup && (
              <div className="restore-form">
                <label className="form-label">
                  Decryption Password
                  <input
                    className="search-input"
                    type="password"
                    placeholder="Enter decryption password"
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    disabled={isBusy}
                  />
                </label>

                {confirmRestore && (
                  <div className="notice error">
                    <span>
                      This will replace your current database. A safety backup will
                      be created first. Continue?
                    </span>
                  </div>
                )}

                <div className="actions">
                  <button
                    className={confirmRestore ? 'btn btn-danger-solid' : 'btn btn-primary'}
                    onClick={handleRestore}
                    disabled={isBusy || !restorePassword}
                  >
                    {isBusy
                      ? 'Restoring...'
                      : confirmRestore
                        ? 'Confirm Restore'
                        : 'Restore Backup'}
                  </button>
                  {confirmRestore && (
                    <button
                      className="btn btn-ghost"
                      onClick={() => setConfirmRestore(false)}
                      disabled={isBusy}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
