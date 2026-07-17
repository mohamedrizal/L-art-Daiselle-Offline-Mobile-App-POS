-- L'art de Daiselle order app — multi-device realtime sync schema.
--
-- Run this once in your Supabase project's SQL editor (Database > SQL
-- Editor). If you previously ran the OLD single-device backup schema (the
-- `app_backups` table), this script drops it first — the app no longer uses
-- it at all, everything below replaces it.
--
-- Design: Supabase is now the shared SOURCE OF TRUTH for every device, not a
-- per-device backup. `menu_items` and `orders` here MIRROR the local SQLite
-- schema column-for-column (see src/db/client.ts), including `updatedAt`
-- (conflict resolution) and `deletedAt` (soft-delete tombstone so deletions
-- propagate to other devices instead of disappearing silently).
--
-- Column naming: kept camelCase (quoted identifiers) instead of converting
-- to snake_case, on purpose — Postgres folds unquoted identifiers to
-- lowercase, so every column below is double-quoted to preserve the exact
-- casing used in the JS/TS code (src/db/repository.ts's MenuItemRow /
-- OrderRow types). This means the app can upsert/read rows with the *same*
-- object shape it already uses for SQLite, with zero camelCase<->snake_case
-- mapping layer in cloudSync.ts.
--
-- Nested fields (items, groupMemberNames, addOns) are kept as TEXT holding a
-- JSON string — not `jsonb` — again to mirror the SQLite column type
-- exactly and reuse the exact same JSON.stringify/JSON.parse helpers
-- (rowToOrderRecord/orderRecordToRow in src/db/repository.ts) for both the
-- local DB and the cloud row, instead of a divergent (de)serialization path
-- for jsonb vs TEXT.

drop table if exists app_backups;

create table if not exists menu_items (
  id text primary key,
  name text not null,
  "imageUri" text,
  price double precision not null,
  "updatedAt" text not null default (now()::text),
  "deletedAt" text
);

create table if not exists orders (
  id text primary key,
  "customerName" text not null,
  "customerWhatsapp" text not null,
  "customerInstagram" text not null,
  items text not null,
  "paymentMethod" text not null,
  "totalHarga" double precision not null,
  status text not null,
  "createdAt" text not null,
  "updatedAt" text not null,
  "scheduledDate" text,
  "scheduledTime" text,
  "groupMemberNames" text not null,
  "addOns" text not null,
  "deletedAt" text
);

-- Index updatedAt on both tables — reconcileFull() in src/utils/cloudSync.ts
-- pulls every row (including tombstones) to merge with local SQLite, and a
-- future optimization to query `WHERE "updatedAt" > ?` incrementally instead
-- of a full table scan benefits from this index existing up front.
create index if not exists menu_items_updated_at_idx on menu_items ("updatedAt");
create index if not exists orders_updated_at_idx on orders ("updatedAt");

-- Realtime ---------------------------------------------------------------
--
-- Adds both tables to the `supabase_realtime` publication so INSERT/UPDATE
-- events stream to subscribed clients (src/utils/cloudSync.ts's
-- subscribeToRealtimeChanges). This statement is idempotent-ish (re-running
-- it after the table is already a member errors "already exists" — safe to
-- ignore if you re-run this whole script).
--
-- NOTE: depending on your Supabase project's settings, you may ALSO need to
-- manually toggle "Enable Realtime" for `menu_items` and `orders` in the
-- Table Editor (Database > Replication, or the toggle on each table) —
-- some projects require this UI step in addition to the publication grant
-- below.
alter publication supabase_realtime add table menu_items;
alter publication supabase_realtime add table orders;

-- Row Level Security -------------------------------------------------------
--
-- The app has no auth/login — every device uses the same public "anon" API
-- key, and by design ALL devices must see the SAME shared data (that's the
-- whole point of this feature: Supabase is the shared source of truth, not
-- a per-device backup). There is no per-device identity to scope a policy
-- to, so the simplest policy that lets the app function is "anon can do
-- anything to these two tables."
--
-- SECURITY TRADE-OFF: anyone who has your project's anon key (which ships
-- inside the app bundle / .env) can read AND write every row in
-- `menu_items` and `orders` — not just legitimate app traffic. There is no
-- way to prevent this without adding real per-device authentication (e.g.
-- Supabase Auth + a policy keyed off `auth.uid()`), which is out of scope
-- for this app (internal tool for a handful of booth staff devices, no
-- login UI). Treat this as "obscure, not secure" and do not store anything
-- sensitive (real financial account numbers, personal IDs, etc.) in menu or
-- order data if this trade-off is unacceptable for your event.

alter table menu_items enable row level security;
alter table orders enable row level security;

create policy "anon can read/write menu_items"
  on menu_items
  for all
  to anon
  using (true)
  with check (true);

create policy "anon can read/write orders"
  on orders
  for all
  to anon
  using (true)
  with check (true);
