import { useState } from 'react';
import { QrScannerView } from './QrScannerView';
import { discoverChannel, relaySupabase } from './relay';
import type { PairCredential } from '../protocol/types';

interface PairingScreenProps {
  onConnect: (url: string, cred?: PairCredential) => void;
  status: 'connecting' | 'pairing' | 'connected' | 'disconnected' | 'error';
  pairError: string | null;
  currentUrl: string;
}

function stripQuery(ws: string): string {
  const q = ws.indexOf('?');
  return q === -1 ? ws : ws.slice(0, q);
}

export function PairingScreen({ onConnect, status, pairError, currentUrl }: PairingScreenProps) {
  const [tab, setTab] = useState<'qr' | 'code'>('qr');
  const [code, setCode] = useState('');

  const parseAndConnect = (input: string) => {
    let target = input.trim().replace(/\s+/g, '');
    if (!target) return;

    // OBS dock QR: IRLTOOLKIT:ws://<host>:<port>?token=<hex>
    if (target.startsWith('IRLTOOLKIT:')) {
      const rest = target.slice('IRLTOOLKIT:'.length);
      const q = rest.indexOf('?');
      const ws = q === -1 ? rest : rest.slice(0, q);
      const params = new URLSearchParams(q === -1 ? '' : rest.slice(q + 1));
      const token = params.get('token');
      if (ws && token) {
        onConnect(ws, { token });
        return;
      }
    }

    // Relay deep link (OBS dock QR when relay is configured):
    // https://<pwa>/?channel=<hex>&code=<6-digit> — just open it.
    // Hosted PWA link: https://...?ws=ws://..&token=.. (or code=..)
    try {
      if (target.startsWith('http://') || target.startsWith('https://')) {
        const u = new URL(target);
        if (u.searchParams.has('channel')) {
          window.location.href = target;
          return;
        }
        const wsParam = u.searchParams.get('ws');
        const tokenParam = u.searchParams.get('token');
        const codeParam = u.searchParams.get('code');
        if (wsParam) {
          onConnect(stripQuery(wsParam), {
            token: tokenParam ?? undefined,
            code: codeParam ?? undefined,
          });
          return;
        }
      }
    } catch {
      // not a standard URL, continue
    }

    // Direct ws(s) URL, optionally with ?token= / ?code=
    if (target.startsWith('ws://') || target.startsWith('wss://')) {
      try {
        const u = new URL(target);
        const token = u.searchParams.get('token') ?? undefined;
        const code = u.searchParams.get('code') ?? undefined;
        onConnect(`${u.protocol}//${u.host}`, { token, code });
      } catch {
        onConnect(stripQuery(target));
      }
      return;
    }

    // 6-digit pairing code typed from the dock. Prefer the internet relay
    // when Supabase is configured (works from anywhere); otherwise pair
    // over the local WebSocket (same WiFi).
    if (/^\d{6}$/.test(target)) {
      const supa = relaySupabase();
      if (supa) {
        void discoverChannel(supa.supaUrl, supa.anonKey, target).then((channel) => {
          if (channel) {
            const sep = window.location.href.includes('?') ? '&' : '?';
            window.location.href = `${window.location.href.split('?')[0]}${sep}channel=${channel}&code=${target}`;
          } else {
            const base = currentUrl.includes('://') ? currentUrl : `ws://${currentUrl}`;
            onConnect(stripQuery(base), { code: target });
          }
        });
        return;
      }
      const base = currentUrl.includes('://') ? currentUrl : `ws://${currentUrl}`;
      onConnect(stripQuery(base), { code: target });
      return;
    }

    // If it's an IP or IP:PORT (e.g. 192.168.1.10 or 192.168.1.10:8087)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(target)) {
      if (!target.includes(':')) target += ':8087';
      onConnect(`ws://${target}`);
      return;
    }

    // Default fallback to ws://
    onConnect(`ws://${target}:8087`);
  };

  const handleScan = (scannedText: string) => {
    parseAndConnect(scannedText);
  };

  const handleSubmitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    parseAndConnect(code);
  };

  return (
    <div
      className="custom-scroll"
      style={{
        width: '100%',
        maxWidth: 480,
        minHeight: '100dvh',
        background: 'radial-gradient(circle at 50% 10%, #151518 0%, #0c0c0e 60%, #070708 100%)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        boxSizing: 'border-box',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        boxShadow: '0 0 60px rgba(0,0,0,0.85)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        color: '#ffffff',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 340,
          height: 340,
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.04) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '16px 24px 20px 24px', boxSizing: 'border-box', zIndex: 10, flex: 1 }}>
        
        {/* Title */}
        <div style={{ marginTop: 10, marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 26, lineHeight: 1.28, fontWeight: 700, letterSpacing: -0.6 }}>
            <span style={{ color: '#ffffff', fontWeight: 700 }}>Scan QR atau masukkan kode dari OBS Dock di PC</span>
            <span style={{ color: '#838388', fontWeight: 400 }}> untuk mulai mengontrol streaming dari Smartphone.</span>
          </h1>
        </div>

        {/* Viewfinder Mode vs Code Mode */}
        {tab === 'qr' ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', marginTop: 6, marginBottom: 38 }}>
            <div
              style={{
                position: 'relative',
                width: 298,
                height: 298,
                maxWidth: '82vw',
                maxHeight: '82vw',
                border: '3.5px solid #ffffff',
                borderRadius: 30,
                boxSizing: 'border-box',
                overflow: 'hidden',
                backgroundColor: '#1a1a1d',
                boxShadow: '0 18px 45px rgba(0, 0, 0, 0.65)',
              }}
            >
              {/* Real device camera scanner */}
              <QrScannerView onScan={handleScan} />
            </div>
          </div>
        ) : (
          <div style={{ marginTop: 8, marginBottom: 28 }}>
            <form
              onSubmit={handleSubmitCode}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                backgroundColor: '#1c1c1e',
                borderRadius: 14,
                padding: '6px 6px 6px 18px',
                boxSizing: 'border-box',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.35)',
              }}
            >
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Masukkan kode atau IP (cth: 192.168.1.5)"
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  color: '#ffffff',
                  fontFamily: 'inherit',
                  fontWeight: 400,
                  letterSpacing: -0.2,
                  padding: '10px 0',
                }}
              />
              <button
                type="submit"
                style={{
                  width: 44,
                  height: 44,
                  backgroundColor: '#38383b',
                  border: 'none',
                  borderRadius: 10,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </form>

            <div style={{ fontSize: 11, color: '#71717a', marginTop: 10, textAlign: 'center' }}>
              Target: <code style={{ color: '#d4d4d8' }}>{currentUrl}</code>
            </div>
          </div>
        )}

        {/* Status Message */}
        {status === 'connecting' && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#fbbf24', marginBottom: 16 }}>
            Menghubungkan ke OBS...
          </div>
        )}
        {status === 'pairing' && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#fbbf24', marginBottom: 16 }}>
            Memasangkan dengan OBS...
          </div>
        )}
        {status === 'error' && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#ef4444', marginBottom: 16 }}>
            {pairError ?? 'Gagal terhubung ke OBS. Pastikan plugin OBS aktif dan satu jaringan.'}
          </div>
        )}

        {/* Segmented Switcher (Scan QR / Tautan) */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: '#1a1a1c',
              padding: 4.5,
              borderRadius: 12,
              boxSizing: 'border-box',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5), 0 4px 14px rgba(0,0,0,0.3)',
            }}
          >
            <button
              type="button"
              onClick={() => setTab('qr')}
              style={{
                backgroundColor: tab === 'qr' ? '#353538' : 'transparent',
                color: tab === 'qr' ? '#ffffff' : '#7f7f85',
                border: 'none',
                outline: 'none',
                borderRadius: 8.5,
                padding: '9px 22px',
                fontSize: 14.5,
                fontWeight: tab === 'qr' ? 600 : 500,
                letterSpacing: -0.2,
                cursor: 'pointer',
                boxShadow: tab === 'qr' ? '0 2px 8px rgba(0,0,0,0.35)' : 'none',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              Scan QR
            </button>
            <button
              type="button"
              onClick={() => setTab('code')}
              style={{
                backgroundColor: tab === 'code' ? '#353538' : 'transparent',
                color: tab === 'code' ? '#ffffff' : '#7f7f85',
                border: 'none',
                outline: 'none',
                borderRadius: 8.5,
                padding: '9px 24px',
                fontSize: 14.5,
                fontWeight: tab === 'code' ? 600 : 500,
                letterSpacing: -0.2,
                cursor: 'pointer',
                boxShadow: tab === 'code' ? '0 2px 8px rgba(0,0,0,0.35)' : 'none',
                fontFamily: 'inherit',
                transition: 'all 0.2s ease',
              }}
            >
              Tautan
            </button>
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 20 }} />
      </div>
    </div>
  );
}
