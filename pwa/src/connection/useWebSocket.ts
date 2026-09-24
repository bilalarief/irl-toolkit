import { useEffect, useRef, useState, useCallback } from 'react';
import type { IncomingMessage, OutgoingMessage } from '../protocol/types';

export type ConnStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

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
  const stored = localStorage.getItem('irl_ws_url');
  if (stored) return stored;
  return `ws://${wsHost}:8087`;
}

export function useWebSocket() {
  const [status, setStatus] = useState<ConnStatus>('disconnected');
  const [lastMessage, setLastMessage] = useState<IncomingMessage | null>(null);
  const [sceneVersion, setSceneVersion] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const urlRef = useRef(getDefaultWsUrl());
  const reconnectTimer = useRef<number | null>(null);

  const connect = useCallback(() => {
    const url = urlRef.current;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;
    setStatus('connecting');
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        // auto ping
        ws.send(JSON.stringify({ type: 'ping' }));
        // auto get_scene on connect
        ws.send(JSON.stringify({ type: 'get_scene', requestId: `get-${Date.now()}` }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as IncomingMessage;
          setLastMessage(msg);
          if (msg.type === 'scene_state') setSceneVersion((v) => v + 1);
        } catch {
          // ignore
        }
      };
      ws.onclose = () => {
        setStatus('disconnected');
        wsRef.current = null;
        // auto reconnect after 2s if not manually closed
        if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
        reconnectTimer.current = window.setTimeout(() => connect(), 2000);
      };
      ws.onerror = () => {
        setStatus('error');
      };
    } catch {
      setStatus('error');
    }
  }, []);

  const disconnect = useCallback(() => {
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
    localStorage.setItem('irl_ws_url', url);
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, lastMessage, sceneVersion, send, connect, disconnect, url: urlRef.current, setUrl };
}
