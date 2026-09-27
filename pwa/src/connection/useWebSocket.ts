import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { IncomingMessage, OutgoingMessage, PairCredential } from '../protocol/types';
import { getRelayConfig, RelayTransport, type RelayConfig } from './relay';

export type ConnStatus = 'connecting' | 'pairing' | 'connected' | 'disconnected' | 'error';

const SESSION_KEY = 'irl_session';
const SESSION_CHANNEL_KEY = 'irl_session_channel';
const URL_KEY = 'irl_ws_url';

export interface Transport {
  status: ConnStatus;
  pairError: string | null;
  lastMessage: IncomingMessage | null;
  sceneVersion: number;
  send: (msg: OutgoingMessage) => boolean;
  connect: () => void;
  connectWith: (url: string, cred?: PairCredential) => void;
  disconnect: () => void;
  url: string;
  setUrl: (url: string) => void;
}

function getDefaultWsUrl(): string {
  const host = window.location.hostname;
  // If served via Vite on PC, phone will access via LAN IP:5173 -> use same host for WS
  // Localhost case -> localhost:8087, otherwise <host>:8087
  const wsHost = host === 'localhost' || host === '127.0.0.1' ? 'localhost' : host;
  // Allow override via ?ws=ws://... query param
  const params = new URLSearchParams(window.location.search);
  const override = params.get('ws');
  if (override) return override;
  // Also allow localStorage override
  const stored = localStorage.getItem(URL_KEY);
  if (stored) return stored;
  return `ws://${wsHost}:8087`;
}

function useDirectTransport(enabled: boolean): Transport {
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<IncomingMessage | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const initial = useRef({ url: getDefaultWsUrl(), cred: initialCred() });
  const urlRef = useRef(initial.current.url);
  const pendingCred = useRef<PairCredential | null>(initial.current.cred);
  const reconnectTimer = useRef<number | null>(null);
  const wantReconnect = useRef(false);
  const failedRef = useRef(false);

  function initialCred(): PairCredential | null {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const code = params.get('code');
    return token || code ? { token: token ?? undefined, code: code ?? undefined } : null;
  }

  const sendPair = useCallback((ws: WebSocket) => {
    const session = localStorage.getItem(SESSION_KEY);
    const cred = pendingCred.current;
    if (cred?.token) {
      ws.send(JSON.stringify({ type: 'pair', token: cred.token }));
    } else if (cred?.code) {
      ws.send(JSON.stringify({ type: 'pair', code: cred.code }));
    } else if (session) {
      ws.send(JSON.stringify({ type: 'pair', session }));
    } else {
      // No credential at all — cannot pair. Stay on the pairing screen.
      setPairError('Scan the QR code or enter the 6-digit code from the OBS dock.');
      setStatus('error');
      ws.close();
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    setPairError(null);
    setStatus('connecting');
    wantReconnect.current = true;
    try {
      const ws = new WebSocket(urlRef.current);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('pairing');
        sendPair(ws);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as IncomingMessage;
          if (msg.type === 'paired') {
            if (msg.success && msg.session) {
              localStorage.setItem(SESSION_KEY, msg.session);
              pendingCred.current = null;
              setStatus('connected');
              ws.send(JSON.stringify({ type: 'ping' }));
              ws.send(JSON.stringify({ type: 'get_scene', requestId: `get-${Date.now()}` }));
              ws.send(JSON.stringify({ type: 'get_scenes', requestId: `scenes-${Date.now()}` }));
            } else {
              localStorage.removeItem(SESSION_KEY);
              pendingCred.current = null;
              wantReconnect.current = false;
              failedRef.current = true;
              setPairError(msg.error ?? 'Pairing failed');
              setStatus('error');
              ws.close();
            }
            return;
          }
          setLastMessage(msg);
          if (msg.type === 'scene_state') setSceneVersion((v) => v + 1);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (failedRef.current) {
          failedRef.current = false;
          return; // keep the 'error' status and message
        }
        setStatus('disconnected');
        // Auto reconnect (session resume) after 2s unless user disconnected
        if (wantReconnect.current) {
          if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
          reconnectTimer.current = window.setTimeout(() => connect(), 2000);
        }
      };
      ws.onerror = () => {
        setStatus('error');
      };
    } catch {
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sendPair]);

  const disconnect = useCallback(() => {
    wantReconnect.current = false;
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

  const connectWith = useCallback(
    (url: string, cred?: PairCredential) => {
      urlRef.current = url;
      localStorage.setItem(URL_KEY, url);
      if (cred) pendingCred.current = cred;
      disconnect();
      window.setTimeout(() => connect(), 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connect, disconnect]
  );

  const send = useCallback((msg: OutgoingMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const setUrl = useCallback((url: string) => {
    urlRef.current = url;
    localStorage.setItem(URL_KEY, url);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // Auto-connect only when we can pair without user input (stored session
    // or ?token=/?code= URL). Otherwise wait on the pairing screen.
    if (localStorage.getItem(SESSION_KEY) || pendingCred.current) {
      connect();
    }
    // When the phone regains internet outside, reconnect immediately
    // instead of waiting for the dead socket to time out.
    const onOnline = () => {
      if (localStorage.getItem(SESSION_KEY) || pendingCred.current) connect();
    };
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('online', onOnline);
      wantReconnect.current = false;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { status, pairError, lastMessage, sceneVersion, send, connect, connectWith, disconnect, url: urlRef.current, setUrl };
}

function useRelayTransport(cfg: RelayConfig | null): Transport {
  const [status, setStatus] = useState<ConnStatus>(cfg ? 'connecting' : 'disconnected');
  const [lastMessage, setLastMessage] = useState<IncomingMessage | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const transportRef = useRef<RelayTransport | null>(null);

  const handleMessage = useCallback(
    (msg: IncomingMessage) => {
      if (!cfg) return;
      if (msg.type === 'paired') {
        if (msg.success && msg.session) {
          localStorage.setItem(SESSION_KEY, msg.session);
          localStorage.setItem(SESSION_CHANNEL_KEY, cfg.channel);
          setStatus('connected');
          transportRef.current?.send({ type: 'ping' });
          transportRef.current?.send({ type: 'get_scene', requestId: `get-${Date.now()}` });
          transportRef.current?.send({ type: 'get_scenes', requestId: `scenes-${Date.now()}` });
        } else {
          localStorage.removeItem(SESSION_KEY);
          setPairError(msg.error ?? 'Pairing failed');
          setStatus('error');
        }
        return;
      }
      setLastMessage(msg);
      if (msg.type === 'scene_state') setSceneVersion((v) => v + 1);
    },
    [cfg]
  );

  const startPair = useCallback(() => {
    if (!cfg || !transportRef.current) return;
    setPairError(null);
    setStatus('pairing');
    const storedSession = localStorage.getItem(SESSION_KEY);
    const storedChannel = localStorage.getItem(SESSION_CHANNEL_KEY);
    if (storedSession && storedChannel === cfg.channel) {
      transportRef.current.send({ type: 'pair', session: storedSession });
    } else if (cfg.code) {
      transportRef.current.send({ type: 'pair', code: cfg.code });
    } else {
      setPairError('Open this page from the OBS dock QR code, or pair again to get a fresh code.');
      setStatus('error');
    }
  }, [cfg]);

  const connect = useCallback(() => {
    if (!cfg) return;
    startPair();
  }, [cfg, startPair]);

  const disconnect = useCallback(() => {
    transportRef.current?.stop();
    setStatus('disconnected');
  }, []);

  useEffect(() => {
    if (!cfg) return;
    const t = new RelayTransport(cfg, handleMessage);
    transportRef.current = t;
    t.start();
    startPair();
    return () => {
      t.stop();
      transportRef.current = null;
    };
  }, [cfg, handleMessage, startPair]);

  const send = useCallback((msg: OutgoingMessage) => {
    if (!transportRef.current) return false;
    void transportRef.current.send(msg);
    return true;
  }, []);

  const connectWith = useCallback((_url: string, _cred?: PairCredential) => {
    connect();
  }, [connect]);

  const setUrl = useCallback(() => {}, []);

  return {
    status,
    pairError,
    lastMessage,
    sceneVersion,
    send,
    connect,
    connectWith,
    disconnect,
    url: cfg ? `relay:${cfg.channel.slice(0, 8)}…` : '',
    setUrl,
  };
}

export function useWebSocket(): Transport {
  const relayCfg = useMemo(getRelayConfig, []);
  const direct = useDirectTransport(!relayCfg);
  const relay = useRelayTransport(relayCfg);
  return relayCfg ? relay : direct;
}
