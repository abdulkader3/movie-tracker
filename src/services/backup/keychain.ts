import { invoke } from '@tauri-apps/api/core';

export async function setPassword(password: string): Promise<void> {
  await invoke('keychain_set_password', { password });
}

export async function getPassword(): Promise<string | null> {
  return invoke<string | null>('keychain_get_password');
}

export async function deletePassword(): Promise<void> {
  await invoke('keychain_delete_password');
}
