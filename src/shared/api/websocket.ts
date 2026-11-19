import { isDemoServer } from './demo/demoStore';
import { getOrCreateDeviceId } from './client';
import { normalizeServerUrl } from '../utils/url';

export interface JellyfinSocketMessage {
  MessageType: string;
  MessageId?: string;
  Data?: unknown;
}

type SocketMessageListener = (message: JellyfinSocketMessage) => void;

/** Manages a persistent Jellyfin WebSocket connection with KeepAlive and exponential backoff. */
export class JellyfinSocketClient {
  private socket: WebSocket | null = null;
  private keepAliveTimer: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private disposed = false;
  private readonly listeners = new Set<SocketMessageListener>();

  constructor(
    private readonly serverUrl: string,
    private readonly accessToken: string
  ) {}

  subscribe(listener: SocketMessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  connect(): void {
    if (this.disposed || !this.serverUrl || !this.accessToken || isDemoServer(this.serverUrl)) {
      return;
    }

    const normalized = normalizeServerUrl(this.serverUrl);
    if (!normalized) return;

    const wsBase = normalized.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
    const deviceId = getOrCreateDeviceId();
    const url = `${wsBase}/socket?api_key=${encodeURIComponent(this.accessToken)}&deviceId=${encodeURIComponent(deviceId)}`;

    try {
      this.socket = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.socket.onopen = () => {
      this.reconnectAttempt = 0;
      this.startKeepAlive(30_000);
    };

    this.socket.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      try {
        const msg = JSON.parse(event.data) as JellyfinSocketMessage;
        if (msg.MessageType === 'ForceKeepAlive') {
          const timeoutSec = typeof msg.Data === 'number' && msg.Data > 0 ? msg.Data : 60;
          this.send({ MessageType: 'KeepAlive' });
          this.startKeepAlive(Math.max(10_000, timeoutSec * 500));
          return;
        }
        this.listeners.forEach((listener) => listener(msg));
      } catch {
        // Ignore malformed socket frames
      }
    };

    this.socket.onclose = () => {
      this.clearKeepAlive();
      if (!this.disposed) {
        this.scheduleReconnect();
      }
    };

    this.socket.onerror = () => {
      // onclose handles cleanup and reconnect backoff
    };
  }

  send(payload: JellyfinSocketMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  disconnect(): void {
    this.disposed = true;
    this.clearKeepAlive();
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.listeners.clear();
  }

  private startKeepAlive(intervalMs: number): void {
    this.clearKeepAlive();
    this.keepAliveTimer = window.setInterval(() => {
      this.send({ MessageType: 'KeepAlive' });
    }, intervalMs);
  }

  private clearKeepAlive(): void {
    if (this.keepAliveTimer !== null) {
      window.clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectTimer !== null) return;
    const delayMs = Math.min(30_000, 2000 * Math.pow(2, this.reconnectAttempt));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delayMs);
  }
}
