import {
  BACKUP_MAGIC,
  BACKUP_VERSION,
  PBKDF2_ITERATIONS,
  SALT_LENGTH,
  IV_LENGTH,
} from './types';

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export interface EncryptedPayload {
  data: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
}

export async function encryptBackup(
  plaintext: Uint8Array,
  password: string,
): Promise<EncryptedPayload> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(password, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext,
  );

  return {
    data: new Uint8Array(ciphertext),
    salt,
    iv,
  };
}

export async function decryptBackup(
  encrypted: Uint8Array,
  password: string,
): Promise<Uint8Array> {
  if (encrypted.length < 4) {
    throw new Error('File too small to be a valid backup');
  }

  const magic = encrypted.slice(0, 4);
  if (toHex(magic) !== toHex(BACKUP_MAGIC)) {
    throw new Error('Invalid backup file format');
  }

  const version = encrypted[4];
  if (version !== BACKUP_VERSION) {
    throw new Error(
      `Unsupported backup version: ${version}. Expected ${BACKUP_VERSION}.`,
    );
  }

  const saltLen = (encrypted[5] << 8) | encrypted[6];
  const ivLen = (encrypted[7] << 8) | encrypted[8];

  const salt = encrypted.slice(9, 9 + saltLen);
  const iv = encrypted.slice(9 + saltLen, 9 + saltLen + ivLen);
  const ciphertext = encrypted.slice(9 + saltLen + ivLen);

  const key = await deriveKey(password, salt);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );
    return new Uint8Array(plaintext);
  } catch {
    throw new Error('Decryption failed. Wrong password or corrupted backup.');
  }
}

export function buildEncryptedFile(
  payload: EncryptedPayload,
): Uint8Array {
  const headerLen = 9 + payload.salt.length + payload.iv.length;
  const file = new Uint8Array(headerLen + payload.data.length);

  file.set(BACKUP_MAGIC, 0);
  file[4] = BACKUP_VERSION;

  const saltLen = payload.salt.length;
  const ivLen = payload.iv.length;
  file[5] = (saltLen >> 8) & 0xff;
  file[6] = saltLen & 0xff;
  file[7] = (ivLen >> 8) & 0xff;
  file[8] = ivLen & 0xff;

  file.set(payload.salt, 9);
  file.set(payload.iv, 9 + saltLen);
  file.set(payload.data, headerLen);

  return file;
}

export function parseEncryptedFile(file: Uint8Array): {
  encryptedData: Uint8Array;
  salt: Uint8Array;
  iv: Uint8Array;
  version: number;
} {
  if (file.length < 9) {
    throw new Error('File too small');
  }

  const magic = file.slice(0, 4);
  if (toHex(magic) !== toHex(BACKUP_MAGIC)) {
    throw new Error('Invalid backup file format');
  }

  const version = file[4];
  const saltLen = (file[5] << 8) | file[6];
  const ivLen = (file[7] << 8) | file[8];

  const salt = file.slice(9, 9 + saltLen);
  const iv = file.slice(9 + saltLen, 9 + saltLen + ivLen);
  const encryptedData = file.slice(9 + saltLen + ivLen);

  return { encryptedData, salt, iv, version };
}
