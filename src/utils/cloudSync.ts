import type { RealtimeChannel } from '@supabase/supabase-js';
import * as Network from 'expo-network';

import {
  getAllMenuItemsIncludingDeleted,
  getAllOrdersIncludingDeleted,
  getMenuItemRecordById,
  getOrderRecordById,
  menuItemRecordToRow,
  orderRecordToRow,
  rowToMenuItemRecord,
  rowToOrderRecord,
  upsertMenuItemRecord,
  upsertOrderRecord,
  type MenuItemRow,
  type OrderRow,
} from '@/db/repository';
import type { MenuItemRecord, OrderRecord } from '@/db/types';
import { supabase } from '@/lib/supabase';

const MENU_TABLE = 'menu_items';
const ORDERS_TABLE = 'orders';

export type SyncTable = typeof MENU_TABLE | typeof ORDERS_TABLE;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'not-configured' | 'offline';

export type RealtimeCallbacks = {
  onMenuItemChange: (record: MenuItemRecord) => void;
  onOrderChange: (record: OrderRecord) => void;
};

let status: SyncStatus = supabase ? 'idle' : 'not-configured';
let realtimeChannel: RealtimeChannel | null = null;
let realtimeConnected = false;
let lastRealtimeConnectedAt: string | null = null;

export function getSyncStatus(): SyncStatus {
  return status;
}

export function isCloudSyncConfigured(): boolean {
  return supabase !== null;
}

export function isRealtimeConnected(): boolean {
  return realtimeConnected;
}

export function getLastRealtimeConnectedAt(): string | null {
  return lastRealtimeConnectedAt;
}

async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return !!state.isConnected && state.isInternetReachable !== false;
  } catch {
    // If the platform can't report network state, don't block sync on it —
    // let the actual Supabase request fail/succeed on its own.
    return true;
  }
}

/**
 * Fire-and-forget upsert of a single menu item / order row to Supabase.
 * Called by AppContext right after every local CRUD write (optimistic
 * local-first: SQLite + React state already updated by the time this runs).
 * Never throws — not-configured / offline / network / RLS errors are all
 * swallowed, since push failures must never surface to the user or block
 * the UI. reconcileFull() is the safety net that catches anything a failed
 * push misses once the device is back online.
 */
export function pushRow(table: 'menu_items', record: MenuItemRecord): void;
export function pushRow(table: 'orders', record: OrderRecord): void;
export function pushRow(table: SyncTable, record: MenuItemRecord | OrderRecord): void {
  if (!supabase) return;
  const client = supabase;

  // Branched (rather than a single `.from(table).upsert(row)` with a
  // union-typed `row`) so each upsert() call gets a concretely-typed
  // argument — supabase-js infers its generic Row type per call, and a
  // union argument causes it to pin Row from one branch and reject the
  // other's extra columns.
  const send = async (): Promise<{ error: unknown }> =>
    table === MENU_TABLE
      ? client.from(MENU_TABLE).upsert(menuItemRecordToRow(record as MenuItemRecord))
      : client.from(ORDERS_TABLE).upsert(orderRecordToRow(record as OrderRecord));

  (async () => {
    try {
      if (!(await isOnline())) return;
      const { error } = await send();
      status = error ? 'error' : 'idle';
      if (error) console.warn(`[cloudSync] pushRow(${table}) failed`, error);
    } catch (error) {
      status = 'error';
      console.warn(`[cloudSync] pushRow(${table}) threw`, error);
    }
  })();
}

/**
 * Applies an incoming remote row to local SQLite using last-write-wins: if
 * there's no local row yet, or the remote row's updatedAt is strictly newer
 * than the local one, the remote version overwrites local and the callback
 * fires so AppContext can update React state. Otherwise (local is newer or
 * they're tied) the event is ignored — local already owns the newest
 * version and its own pending/future push will converge the remote copy.
 */
async function applyIncomingMenuItem(remote: MenuItemRecord, callbacks: RealtimeCallbacks): Promise<void> {
  try {
    const local = await getMenuItemRecordById(remote.id);
    if (local && local.updatedAt >= remote.updatedAt) return;
    await upsertMenuItemRecord(remote);
    callbacks.onMenuItemChange(remote);
  } catch (error) {
    console.warn('[cloudSync] applyIncomingMenuItem failed', error);
  }
}

async function applyIncomingOrder(remote: OrderRecord, callbacks: RealtimeCallbacks): Promise<void> {
  try {
    const local = await getOrderRecordById(remote.id);
    if (local && local.updatedAt >= remote.updatedAt) return;
    await upsertOrderRecord(remote);
    callbacks.onOrderChange(remote);
  } catch (error) {
    console.warn('[cloudSync] applyIncomingOrder failed', error);
  }
}

/**
 * Subscribes to Supabase Realtime `postgres_changes` (INSERT/UPDATE) for
 * `menu_items` and `orders`. Returns an unsubscribe function — callers
 * (AppContext) MUST call it on unmount to avoid a duplicate/leaked channel.
 *
 * No-op (returns a no-op unsubscribe) if Supabase isn't configured. Safe to
 * call multiple times: an existing channel is torn down first so repeated
 * calls (e.g. a stray double effect run) never leave two channels open.
 */
export function subscribeToRealtimeChanges(callbacks: RealtimeCallbacks): () => void {
  if (!supabase) return () => {};
  const client = supabase;

  if (realtimeChannel) {
    client.removeChannel(realtimeChannel);
    realtimeChannel = null;
    realtimeConnected = false;
  }

  realtimeChannel = client
    .channel('lartdaiselle-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: MENU_TABLE },
      (payload) => {
        const row = payload.new as MenuItemRow | undefined;
        if (!row || !row.id) return;
        void applyIncomingMenuItem(rowToMenuItemRecord(row), callbacks);
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: ORDERS_TABLE },
      (payload) => {
        const row = payload.new as OrderRow | undefined;
        if (!row || !row.id) return;
        void applyIncomingOrder(rowToOrderRecord(row), callbacks);
      }
    )
    .subscribe((subStatus) => {
      if (subStatus === 'SUBSCRIBED') {
        realtimeConnected = true;
        lastRealtimeConnectedAt = new Date().toISOString();
      } else if (subStatus === 'CLOSED' || subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
        realtimeConnected = false;
      }
    });

  return () => {
    realtimeConnected = false;
    if (realtimeChannel) {
      client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  };
}

/**
 * Two-way merge between local SQLite and Supabase, by id + updatedAt
 * (last-write-wins): whichever side has the newer `updatedAt` for a given
 * row wins and overwrites the other side; a row missing entirely on one
 * side is copied to it. Includes soft-deleted rows on both sides so
 * tombstones propagate too.
 */
function reconcileTable<T extends { id: string; updatedAt: string }>(
  remote: T[],
  local: T[],
  handlers: { apply: (record: T) => Promise<void>; push: (record: T) => void }
): Promise<void[]> {
  const remoteById = new Map(remote.map((r) => [r.id, r]));
  const localById = new Map(local.map((r) => [r.id, r]));
  const applies: Promise<void>[] = [];

  for (const remoteRecord of remote) {
    const localRecord = localById.get(remoteRecord.id);
    if (!localRecord || remoteRecord.updatedAt > localRecord.updatedAt) {
      applies.push(handlers.apply(remoteRecord));
    }
  }

  for (const localRecord of local) {
    const remoteRecord = remoteById.get(localRecord.id);
    if (!remoteRecord || localRecord.updatedAt > remoteRecord.updatedAt) {
      handlers.push(localRecord);
    }
  }

  return Promise.all(applies);
}

/**
 * Full two-way reconciliation between local SQLite and Supabase. Meant to
 * run at app launch and whenever the app returns to the foreground — a
 * safety net for realtime events that were missed while the device was
 * offline, backgrounded, or killed. No-op if Supabase isn't configured;
 * sets status to 'offline' (not 'error') when there's no network, since
 * that's this app's normal operating mode, not a failure.
 */
export async function reconcileFull(callbacks: RealtimeCallbacks): Promise<void> {
  if (!supabase) return;
  if (!(await isOnline())) {
    status = 'offline';
    return;
  }

  status = 'syncing';
  try {
    const [remoteMenuResult, remoteOrdersResult, localMenu, localOrders] = await Promise.all([
      supabase.from(MENU_TABLE).select('*'),
      supabase.from(ORDERS_TABLE).select('*'),
      getAllMenuItemsIncludingDeleted(),
      getAllOrdersIncludingDeleted(),
    ]);
    if (remoteMenuResult.error) throw remoteMenuResult.error;
    if (remoteOrdersResult.error) throw remoteOrdersResult.error;

    const remoteMenu = (remoteMenuResult.data ?? []).map((row) => rowToMenuItemRecord(row as MenuItemRow));
    const remoteOrders = (remoteOrdersResult.data ?? []).map((row) => rowToOrderRecord(row as OrderRow));

    await reconcileTable(remoteMenu, localMenu, {
      apply: async (record) => {
        await upsertMenuItemRecord(record);
        callbacks.onMenuItemChange(record);
      },
      push: (record) => pushRow(MENU_TABLE, record),
    });

    await reconcileTable(remoteOrders, localOrders, {
      apply: async (record) => {
        await upsertOrderRecord(record);
        callbacks.onOrderChange(record);
      },
      push: (record) => pushRow(ORDERS_TABLE, record),
    });

    status = 'idle';
  } catch (error) {
    status = 'error';
    console.warn('[cloudSync] reconcileFull failed', error);
  }
}
