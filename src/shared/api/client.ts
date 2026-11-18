import { safeGetStorageItem, safeSetStorageItem } from '../utils/storage';
import { normalizeServerUrl } from '../utils/url';

const DEVICE_ID_KEY = 'jellyfin_device_id';
const CLIENT_NAME = 'MorphPlay';
const CLIENT_VERSION = '1.0.0';

export function getOrCreateDeviceId(): string {
  let deviceId = safeGetStorageItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `jf-web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    safeSetStorageItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export function buildAuthHeader(token?: string | null): string {
  const deviceId = getOrCreateDeviceId();
  const base = `MediaBrowser Client="${CLIENT_NAME}", Device="Web Browser", DeviceId="${deviceId}", Version="${CLIENT_VERSION}"`;
  return token ? `${base}, Token="${token}"` : base;
}

export async function apiRequest<T>(
  serverUrl: string,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    token?: string | null;
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', token, body, signal, timeoutMs = 15000 } = options;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const headers: Record<string, string> = {
      Authorization: buildAuthHeader(token),
      Accept: 'application/json',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${normalizeServerUrl(serverUrl)}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let detail = `HTTP error ${response.status}`;
      try {
        const text = await response.text();
        if (text) detail = text;
      } catch {
        // Ignore errors while reading error response body
      }
      throw new Error(detail);
    }

    if (response.status === 204 || response.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}
