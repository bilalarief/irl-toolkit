import type { IncomingMessage, OutgoingMessage } from '../protocol/types';

export interface RelayConfig {
  supaUrl: string;
  anonKey: string;
  channel: string;
  code?: string;
}

function restHeaders(anonKey: string): HeadersInit {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

// Relay mode activates when the PWA boots with ?channel= (QR deep link or
// manual-code lookup). Supabase coordinates come from (in priority order)
// URL params (?supa=/?key=), localStorage, or Vercel env vars.
export function getRelayConfig(): RelayConfig | null {
  const params = new URLSearchParams(window.location.search);
  const channel = params.get('channel');
  if (!channel) return null;

  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
  const paramUrl = params.get('supa');
  const paramKey = params.get('key');
  if (paramUrl) localStorage.setItem('irl_supa_url', paramUrl);
  if (paramKey) localStorage.setItem('irl_supa_key', paramKey);

  const supaUrl = paramUrl ?? localStorage.getItem('irl_supa_url') ?? envUrl;
  const anonKey = paramKey ?? localStorage.getItem('irl_supa_key') ?? envKey;
  if (!supaUrl || !anonKey) return null;
  return { supaUrl, anonKey, channel, code: params.get('code') ?? undefined };
}

// Manual path: 6-digit dock code -> relay channel (checks expiry).
export async function discoverChannel(supaUrl: string, anonKey: string, code: string): Promise<string | null> {
  const res = await fetch(
    `${supaUrl}/rest/v1/irl_pairings?code=eq.${encodeURIComponent(code)}&select=channel,expires_at`,
    { headers: restHeaders(anonKey) }
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as Array<{ channel: string; expires_at: string }>;
  if (!rows.length) return null;
  if (new Date(rows[0].expires_at).getTime() < Date.now()) return null;
  return rows[0].channel;
}

export function relaySupabase(): { supaUrl: string; anonKey: string } | null {
  const params = new URLSearchParams(window.location.search);
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
  const supaUrl = params.get('supa') ?? localStorage.getItem('irl_supa_url') ?? envUrl;
  const anonKey = params.get('key') ?? localStorage.getItem('irl_supa_key') ?? envKey;
  if (!supaUrl || !anonKey) return null;
  return { supaUrl, anonKey };
}

const POLL_MS = 800;

// Minimal Supabase REST transport: POST requests, poll responses, delete
// consumed rows. Same protocol messages as the local WebSocket.
export class RelayTransport {
  private timer: number | null = null;
  private lastId = 0;
  private stopped = false;
  private cfg: RelayConfig;
  private onMessage: (msg: IncomingMessage) => void;

  constructor(cfg: RelayConfig, onMessage: (msg: IncomingMessage) => void) {
    this.cfg = cfg;
    this.onMessage = onMessage;
  }

  start() {
    this.stopped = false;
    this.lastId = 0;
    this.loop();
  }

  stop() {
    this.stopped = true;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
  }

  async send(msg: OutgoingMessage): Promise<boolean> {
    try {
      const res = await fetch(`${this.cfg.supaUrl}/rest/v1/irl_messages`, {
        method: 'POST',
        headers: restHeaders(this.cfg.anonKey),
        body: JSON.stringify({ channel: this.cfg.channel, sender: 'pwa', body: msg }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  private async loop() {
    if (this.stopped) return;
    try {
      const res = await fetch(
        `${this.cfg.supaUrl}/rest/v1/irl_messages?channel=eq.${this.cfg.channel}&sender=eq.plugin&order=id.asc&id=gt.${this.lastId}&select=id,body`,
        { headers: restHeaders(this.cfg.anonKey) }
      );
      if (res.ok) {
        const rows = (await res.json()) as Array<{ id: number; body: IncomingMessage }>;
        for (const row of rows) {
          if (row.id <= this.lastId) continue;
          this.lastId = row.id;
          // Best-effort cleanup so the table stays tiny
          fetch(`${this.cfg.supaUrl}/rest/v1/irl_messages?id=eq.${row.id}`, {
            method: 'DELETE',
            headers: restHeaders(this.cfg.anonKey),
          }).catch(() => {});
          this.onMessage(row.body);
        }
      }
    } catch {
      // transient — retry next tick
    }
    if (!this.stopped) {
      this.timer = window.setTimeout(() => this.loop(), POLL_MS);
    }
  }
}
