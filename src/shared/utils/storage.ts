export function safeGetStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSetStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota / privacy mode failures
  }
}

export function safeRemoveStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage access failures
  }
}

export function safeGetStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function safeSetStorageJson(key: string, value: unknown): void {
  safeSetStorageItem(key, JSON.stringify(value));
}
