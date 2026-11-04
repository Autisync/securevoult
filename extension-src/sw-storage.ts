/** Stands in for src/lib/storage in the background worker: the popup's chrome.storage.local copy. */
const KEY = 'securevoult_encrypted_vault';

export const UniversalStorageService = {
  async saveVault(v: unknown) { await chrome.storage.local.set({ [KEY]: v }); },
  async loadVault() { return (await chrome.storage.local.get([KEY]))[KEY] ?? null; },
  async hasVault() { return !!(await chrome.storage.local.get([KEY]))[KEY]; },
  async clearVault() { await chrome.storage.local.remove([KEY]); },
};
