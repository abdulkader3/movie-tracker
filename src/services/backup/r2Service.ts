import type { BackupListItem } from './types';

function getWorkerUrl(): string {
  const url = import.meta.env.VITE_BACKUP_SERVICE_URL?.trim();
  if (!url) {
    throw new Error(
      'Backup service URL not configured. Set VITE_BACKUP_SERVICE_URL in .env',
    );
  }
  return url.replace(/\/+$/, '');
}

function getAuthToken(): string {
  const token = import.meta.env.VITE_BACKUP_AUTH_TOKEN?.trim();
  if (!token) {
    throw new Error(
      'Backup auth token not configured. Set VITE_BACKUP_AUTH_TOKEN in .env',
    );
  }
  return token;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getAuthToken()}`,
    'Content-Type': 'application/octet-stream',
  };
}

export async function uploadBackup(
  encryptedData: Uint8Array,
  key: string,
): Promise<{ key: string; size: number }> {
  const url = `${getWorkerUrl()}/api/backup/upload`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...authHeaders(),
      'X-Backup-Key': key,
    },
    body: encryptedData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`[backup] Upload failed (${res.status}):`, text);
    throw new Error(
      `Upload failed (${res.status}): ${text || res.statusText}`,
    );
  }

  return res.json();
}

export async function downloadBackup(key: string): Promise<Uint8Array> {
  const url = `${getWorkerUrl()}/api/backup/download?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Download failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const buffer = await res.arrayBuffer();
  return new Uint8Array(buffer);
}

export async function listBackups(): Promise<BackupListItem[]> {
  const url = `${getWorkerUrl()}/api/backup/list`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `List failed (${res.status}): ${text || res.statusText}`,
    );
  }

  const data = await res.json();
  return data.backups ?? [];
}

export async function checkConnection(): Promise<boolean> {
  try {
    const url = `${getWorkerUrl()}/api/backup/health`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch (err) {
    console.warn('[backup] Health check failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
