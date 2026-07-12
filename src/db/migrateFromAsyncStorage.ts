import AsyncStorage from '@react-native-async-storage/async-storage';

import { replaceAllData } from '@/db/repository';
import type { MenuItem, Order } from '@/db/types';

const MENU_STORAGE_KEY = '@lartdaiselle/menuItems';
const ORDERS_STORAGE_KEY = '@lartdaiselle/orders';
const MIGRATION_DONE_KEY = '@lartdaiselle/sqliteMigrationDone';

/**
 * One-time migration of legacy AsyncStorage data into SQLite. Safe to call
 * on every app start: it no-ops once the migration flag is set, and even if
 * it's interrupted partway (e.g. app killed between writing to SQLite and
 * clearing AsyncStorage) re-running it is harmless because replaceAllData
 * upserts by primary key from the same untouched AsyncStorage source.
 */
export async function migrateFromAsyncStorageIfNeeded(): Promise<void> {
  const alreadyDone = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
  if (alreadyDone === '1') return;

  const [menuRaw, ordersRaw] = await Promise.all([
    AsyncStorage.getItem(MENU_STORAGE_KEY),
    AsyncStorage.getItem(ORDERS_STORAGE_KEY),
  ]);

  if (menuRaw || ordersRaw) {
    try {
      const menuItems: MenuItem[] = menuRaw ? JSON.parse(menuRaw) : [];
      const orders: Order[] = ordersRaw ? JSON.parse(ordersRaw) : [];
      await replaceAllData({ menuItems, orders });
    } catch (error) {
      // If the legacy data is corrupt, don't block app startup on it —
      // leave AsyncStorage keys in place for inspection and skip clearing
      // them, but still avoid throwing so the app can start with an empty DB.
      console.warn('[migrateFromAsyncStorage] failed to parse/import legacy data', error);
      return;
    }
  }

  await AsyncStorage.multiRemove([MENU_STORAGE_KEY, ORDERS_STORAGE_KEY]);
  await AsyncStorage.setItem(MIGRATION_DONE_KEY, '1');
}
