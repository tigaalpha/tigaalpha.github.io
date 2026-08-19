export const SOLO_MODE_STORAGE_KEY = "tiga-bos-solo-mode";

export function getStoredSoloMode(): boolean {
  return localStorage.getItem(SOLO_MODE_STORAGE_KEY) === "true";
}

export function setStoredSoloMode(value: boolean) {
  localStorage.setItem(SOLO_MODE_STORAGE_KEY, value ? "true" : "false");
}
