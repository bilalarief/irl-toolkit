import { useEffect, useRef, useState, useCallback } from 'react';
import type { IncomingMessage, OutgoingMessage, PairCredential } from '../protocol/types';

export type ConnStatus = 'connecting' | 'pairing' | 'connected' | 'disconnected' | 'error';

const SESSION_KEY = 'irl_session';
const URL_KEY = 'irl_ws_url';

function getInitialConnection(): { url: string; cred: PairCredential | null } {
  const params = new URLSearchParams(window.location.search);
  const wsOverride = params.get('ws');
  const tokenParam = params.get('token');
  const codeParam = params.get('code');
  const storedUrl = localStorage.getItem(URL_KEY);

  const host = window.location.hostname;
  const wsHost = host === 'localhost' || host === '127.0.0.1' ? 'localhost' : host;
  const url = wsOverride ?? storedUrl ?? `ws://${wsHost}:8087`;
  const cred: PairCredential | null =
    tokenParam || codeParam ? { token: tokenParam ?? undefined, code: codeParam ?? undefined } : null;
  return { url, cred };
}

export function useWebSocket() {
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<IncomingMessage | null>(null);
  const [pairError, setPairError] = useState<string | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const initial = useRef(getInitialConnection());
  const urlRef = useRef(initial.current.url);
  const pendingCred = useRef<PairCredential | null>(initial.current.cred);
  const reconnectTimer = useRef<number | null>(null);
  const wantReconnect = useRef(false);
  const failedRef = useRef(false);

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
  }, [sendPair]);

  const connectWith = useCallback(
    (url: string, cred?: PairCredential) => {
      urlRef.current = url;
      localStorage.setItem(URL_KEY, url);
      if (cred) pendingCred.current = cred;
      disconnect();
      window.setTimeout(() => connect(), 100);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [connect]
  );

  const disconnect = useCallback(() => {
    wantReconnect.current = false;
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setStatus('disconnected');
  }, []);

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
    // Auto-connect only when we can pair without user input (stored session
    // or ?token=/?code= URL). Otherwise wait on the pairing screen.
    if (localStorage.getItem(SESSION_KEY) || pendingCred.current) {
      connect();
    }
    return () => {
      wantReconnect.current = false;
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, pairError, lastMessage, sceneVersion, send, connect, connectWith, disconnect, url: urlRef.current, setUrl };
}
