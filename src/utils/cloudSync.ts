import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';

import type { AppData } from '@/db/types';
import { supabase } from '@/lib/supabase';
import { generateId } from '@/utils/id';

const TABLE = 'app_backups';
const DEVICE_ID_KEY = '@lartdaiselle/deviceId';
const LAST_SYNCED_KEY = '@lartdaiselle/lastSyncedAt';
const AUTO_SYNC_DEBOUNCE_MS = 4000;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'not-configured';

export type CloudSyncResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export type CloudRestoreResult =
  | { ok: true; message: string; data: AppData }
  | { ok: false; message: string };

let status: SyncStatus = supabase ? 'idle' : 'not-configured';

export function getSyncStatus(): SyncStatus {
  return status;
}

export function isCloudSyncConfigured(): boolean {
  return supabase !== null;
}

async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = generateId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export async function getLastSyncedAt(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_SYNCED_KEY);
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
 * Pushes a full local snapshot to Supabase (upsert by device_id). Never
 * throws — offline / not-configured / network errors are reported back as
 * `{ ok: false, message }` so callers (UI or silent auto-sync) can decide
 * what to do without try/catch.
 */
export async function syncToCloud(data: AppData): Promise<CloudSyncResult> {
  if (!supabase) {
    status = 'not-configured';
    return { ok: false, message: 'Supabase belum dikonfigurasi. Isi file .env terlebih dahulu.' };
  }
  if (!(await isOnline())) {
    return { ok: false, message: 'Tidak ada koneksi internet.' };
  }

  status = 'syncing';
  try {
    const deviceId = await getDeviceId();
    const { error } = await supabase.from(TABLE).upsert({
      device_id: deviceId,
      data,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
    status = 'idle';
    return { ok: true, message: 'Berhasil sync ke cloud.' };
  } catch (error) {
    status = 'error';
    console.warn('[cloudSync] syncToCloud failed', error);
    return { ok: false, message: 'Gagal sync ke cloud. Coba lagi nanti.' };
  }
}

/**
 * Pulls this device's last pushed snapshot from Supabase. Does not apply it
 * — caller is expected to confirm with the user (Alert) then call
 * replaceAll(data) themselves, mirroring the old JSON restore flow.
 */
export async function restoreFromCloud(): Promise<CloudRestoreResult> {
  if (!supabase) {
    status = 'not-configured';
    return { ok: false, message: 'Supabase belum dikonfigurasi. Isi file .env terlebih dahulu.' };
  }
  if (!(await isOnline())) {
    return { ok: false, message: 'Tidak ada koneksi internet.' };
  }

  status = 'syncing';
  try {
    const deviceId = await getDeviceId();
    const { data: row, error } = await supabase
      .from(TABLE)
      .select('data, updated_at')
      .eq('device_id', deviceId)
      .maybeSingle();
    if (error) throw error;

    if (!row) {
      status = 'idle';
      return { ok: false, message: 'Belum ada cadangan di cloud untuk perangkat ini.' };
    }

    const parsed = row.data as AppData;
    if (!Array.isArray(parsed?.menuItems) || !Array.isArray(parsed?.orders)) {
      throw new Error('Cloud backup payload is malformed');
    }

    await AsyncStorage.setItem(LAST_SYNCED_KEY, new Date().toISOString());
    status = 'idle';
    return { ok: true, message: 'Berhasil mengambil data dari cloud.', data: parsed };
  } catch (error) {
    status = 'error';
    console.warn('[cloudSync] restoreFromCloud failed', error);
    return { ok: false, message: 'Gagal mengambil data dari cloud.' };
  }
}

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Silent, debounced auto-sync used after local mutations. No-ops instantly
 * (no timer, no network check) when Supabase isn't configured, and swallows
 * any failure — auto-sync must never surface an error to the user or block
 * the UI, offline is the normal operating mode for this app.
 */
export function scheduleAutoSync(getData: () => AppData, delayMs = AUTO_SYNC_DEBOUNCE_MS): void {
  if (!supabase) return;
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    syncToCloud(getData()).catch(() => {});
  }, delayMs);
}

/**
 * Silent auto-sync attempt for app foreground/launch. Same no-throw,
 * no-op-when-unconfigured contract as scheduleAutoSync.
 */
export async function tryAutoSyncOnLaunch(getData: () => AppData): Promise<void> {
  if (!supabase) return;
  try {
    await syncToCloud(getData());
  } catch {
    // syncToCloud already swallows its own errors; this catch only guards
    // against unexpected throws so launch-time sync can never crash the app.
  }
}
