-- L'art de Daiselle order app — cloud backup/restore schema.
--
-- Run this once in your Supabase project's SQL editor (Database > SQL
-- Editor) after creating the project and before filling in .env.
--
-- Design: this is a single-device backup/restore feature, not multi-device
-- sync. One row per device holds that device's entire local snapshot
-- (menuItems + orders) as JSONB. "Sync ke Cloud" upserts this row;
-- "Restore dari Cloud" reads it back and overwrites local SQLite.

create table if not exists app_backups (
  device_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Row Level Security -----------------------------------------------------
--
-- The app has no auth/login — it only ever has the public "anon" API key,
-- and identifies "its own" row purely by the device_id value it generates
-- and sends in the query (WHERE device_id = ...). Postgres/PostgREST has no
-- way to verify that value came from the device that owns it, since there
-- is no session tied to a device.
--
-- SECURITY TRADE-OFF: the policy below allows ANY holder of the anon key to
-- read or write ANY row in this table (not just their own device_id), as
-- long as they know (or guess) a device_id. This is the simplest policy
-- that still lets the app function without adding real per-device auth.
--
-- What this means in practice:
--   - device_id is generated with a random-ish local id (see
--     src/utils/id.ts) and is not secret, but it's also not guessable from
--     outside the app, so a casual anon-key holder is unlikely to stumble
--     onto another device's row.
--   - Anyone with your project's anon key (which ships inside the app
--     bundle / .env) *could* enumerate/read/overwrite all rows in this
--     table if they wrote their own client. There is no way to prevent
--     this without adding real authentication (e.g. Supabase Auth with a
--     per-device session, and a policy like `using (device_id =
--     auth.jwt() ->> 'device_id')`), which was explicitly out of scope for
--     this feature (single device, no login UI).
--   - Do not put anything sensitive in menu/order data if this trade-off is
--     unacceptable for your event — treat this table as "obscure, not
--     secure."
--
-- If you want tighter isolation later without full auth, consider Supabase
-- Edge Functions with a shared secret, or per-device Postgres roles — both
-- are more setup than this app currently needs.

alter table app_backups enable row level security;

create policy "anon can read/write app_backups"
  on app_backups
  for all
  to anon
  using (true)
  with check (true);
