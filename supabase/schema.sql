-- IRL Toolkit relay schema (Supabase Postgres)
-- Run once in the Supabase SQL editor.
--
-- Design: the pairing session id IS the relay channel (64-hex, unguessable).
-- The PWA discovers the channel by pairing code; then both sides exchange
-- protocol messages ({type: ...}) as table rows. No realtime needed —
-- both sides poll. Rows are deleted after consumption; pairings expire.

-- Pairing announcements: code (shown in OBS dock) -> channel (session id)
create table if not exists irl_pairings (
  code text primary key,
  channel text not null,
  expires_at timestamptz not null
);

-- Message bus: sender is 'pwa' or 'plugin', body is the protocol message
create table if not exists irl_messages (
  id bigint generated always as identity primary key,
  channel text not null,
  sender text not null check (sender in ('pwa', 'plugin')),
  body jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists irl_messages_channel_id_idx
  on irl_messages (channel, id);

-- Prototype policy: session ids are 64-hex secrets, so an open policy is
-- acceptable for testing. Tighten (e.g. per-channel checks) for production.
alter table irl_pairings enable row level security;
alter table irl_messages enable row level security;

drop policy if exists "irl open" on irl_pairings;
create policy "irl open" on irl_pairings
  for all using (true) with check (true);

drop policy if exists "irl open" on irl_messages;
create policy "irl open" on irl_messages
  for all using (true) with check (true);

-- Optional cleanup (run periodically or as pg_cron):
-- delete from irl_pairings where expires_at < now();
-- delete from irl_messages where created_at < now() - interval '1 hour';
