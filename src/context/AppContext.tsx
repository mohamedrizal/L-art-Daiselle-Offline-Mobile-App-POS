import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { migrateFromAsyncStorageIfNeeded } from '@/db/migrateFromAsyncStorage';
import {
  deleteMenuItemRow,
  deleteOrderRow,
  getAllMenuItems,
  getAllOrders,
  insertMenuItem,
  insertOrder,
  replaceAllData,
  updateMenuItemRow,
  updateOrderRow,
} from '@/db/repository';
import type {
  AppData,
  MenuItem,
  MenuItemRecord,
  Order,
  OrderAddOn,
  OrderItem,
  OrderRecord,
  OrderStatus,
  PaymentMethod,
} from '@/db/types';
import {
  getSyncStatus,
  isCloudSyncConfigured,
  pushRow,
  reconcileFull,
  subscribeToRealtimeChanges,
  type RealtimeCallbacks,
} from '@/utils/cloudSync';
import { generateId } from '@/utils/id';

// Re-exported so existing screens can keep importing these types from
// '@/context/AppContext' unchanged — the canonical definitions now live in
// '@/db/types' so the db layer doesn't have to import from this file.
// Note: MenuItemRecord/OrderRecord (which add the internal `deletedAt`
// tombstone field) are intentionally NOT re-exported here — soft-delete is
// an implementation detail of the db + sync layers only, invisible to the UI.
export type { AppData, MenuItem, Order, OrderAddOn, OrderItem, OrderStatus, PaymentMethod };

type AppContextValue = {
  menuItems: MenuItem[];
  orders: Order[];
  isLoaded: boolean;
  addMenuItem: (item: Omit<MenuItem, 'id' | 'updatedAt'>) => void;
  updateMenuItem: (id: string, patch: Omit<MenuItem, 'id' | 'updatedAt'>) => void;
  deleteMenuItem: (id: string) => void;
  addOrder: (
    order: Omit<
      Order,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'status'
      | 'scheduledDate'
      | 'scheduledTime'
      | 'groupMemberNames'
      | 'addOns'
    > & {
      scheduledDate?: string | null;
      scheduledTime?: string | null;
      groupMemberNames?: string[];
      addOns?: OrderAddOn[];
    }
  ) => void;
  updateOrder: (id: string, patch: Partial<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  deleteOrder: (id: string) => void;
  replaceAll: (data: AppData) => void;
  /**
   * Manually triggers a full two-way cloud reconciliation (see
   * reconcileFull in utils/cloudSync.ts) and reports the outcome — used by
   * the "Sync Sekarang" button in ReportScreen as a troubleshooting/
   * peace-of-mind action for staff who just reconnected to the internet.
   * Sync itself is otherwise automatic (realtime + launch/foreground
   * reconcile), so this is purely additive to the CRUD API above.
   */
  syncNow: () => Promise<{ ok: boolean; message: string }>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await migrateFromAsyncStorageIfNeeded();
        const [loadedMenuItems, loadedOrders] = await Promise.all([getAllMenuItems(), getAllOrders()]);
        setMenuItems(loadedMenuItems);
        setOrders(loadedOrders);
      } catch (error) {
        console.warn('[AppContext] failed to load data from SQLite', error);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Applies a remote-wins change (from a realtime event or reconcileFull)
  // to React state. Soft-deleted rows (deletedAt set) are simply dropped
  // from state — the UI never learns soft-delete exists, it just sees the
  // item disappear, same as a hard delete would look.
  const applyIncomingMenuItem = (record: MenuItemRecord) => {
    setMenuItems((prev) => {
      const withoutId = prev.filter((m) => m.id !== record.id);
      if (record.deletedAt) return withoutId;
      const { deletedAt: _deletedAt, ...item } = record;
      return [...withoutId, item];
    });
  };

  const applyIncomingOrder = (record: OrderRecord) => {
    setOrders((prev) => {
      const withoutId = prev.filter((o) => o.id !== record.id);
      if (record.deletedAt) return withoutId;
      const { deletedAt: _deletedAt, ...order } = record;
      return [...withoutId, order];
    });
  };

  const realtimeCallbacks: RealtimeCallbacks = {
    onMenuItemChange: applyIncomingMenuItem,
    onOrderChange: applyIncomingOrder,
  };

  // Realtime subscription + reconciliation. reconcileFull runs once on
  // launch and again every time the app returns to the foreground (a
  // safety net for realtime events missed while offline/backgrounded/
  // killed); subscribeToRealtimeChanges keeps state live in between. Both
  // are no-ops when Supabase isn't configured, and neither ever throws.
  useEffect(() => {
    if (!isLoaded) return;

    reconcileFull(realtimeCallbacks).catch(() => {});
    const unsubscribe = subscribeToRealtimeChanges(realtimeCallbacks);

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        reconcileFull(realtimeCallbacks).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  const addMenuItem: AppContextValue['addMenuItem'] = (item) => {
    const now = new Date().toISOString();
    const newItem: MenuItem = { ...item, id: generateId(), updatedAt: now };
    setMenuItems((prev) => [...prev, newItem]);
    insertMenuItem(newItem)
      .then((record) => pushRow('menu_items', record))
      .catch((error) => console.warn('[AppContext] insertMenuItem failed', error));
  };

  const updateMenuItem: AppContextValue['updateMenuItem'] = (id, patch) => {
    const now = new Date().toISOString();
    let updated: MenuItem | undefined;
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        updated = { ...m, ...patch, updatedAt: now };
        return updated;
      })
    );
    if (updated) {
      updateMenuItemRow(updated)
        .then((record) => pushRow('menu_items', record))
        .catch((error) => console.warn('[AppContext] updateMenuItemRow failed', error));
    }
  };

  const deleteMenuItem: AppContextValue['deleteMenuItem'] = (id) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    deleteMenuItemRow(id)
      .then((record) => record && pushRow('menu_items', record))
      .catch((error) => console.warn('[AppContext] deleteMenuItemRow failed', error));
  };

  const addOrder: AppContextValue['addOrder'] = (order) => {
    const now = new Date().toISOString();
    const newOrder: Order = {
      ...order,
      scheduledDate: order.scheduledDate ?? null,
      scheduledTime: order.scheduledTime ?? null,
      groupMemberNames: order.groupMemberNames ?? [],
      addOns: order.addOns ?? [],
      id: generateId(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    setOrders((prev) => [...prev, newOrder]);
    insertOrder(newOrder)
      .then((record) => pushRow('orders', record))
      .catch((error) => console.warn('[AppContext] insertOrder failed', error));
  };

  const updateOrder: AppContextValue['updateOrder'] = (id, patch) => {
    const now = new Date().toISOString();
    let updated: Order | undefined;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        updated = { ...o, ...patch, updatedAt: now };
        return updated;
      })
    );
    if (updated) {
      updateOrderRow(updated)
        .then((record) => pushRow('orders', record))
        .catch((error) => console.warn('[AppContext] updateOrderRow failed', error));
    }
  };

  const deleteOrder: AppContextValue['deleteOrder'] = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    deleteOrderRow(id)
      .then((record) => record && pushRow('orders', record))
      .catch((error) => console.warn('[AppContext] deleteOrderRow failed', error));
  };

  const replaceAll: AppContextValue['replaceAll'] = (data) => {
    setMenuItems(data.menuItems);
    setOrders(data.orders);
    replaceAllData(data)
      .then(() => {
        for (const item of data.menuItems) pushRow('menu_items', { ...item, deletedAt: null });
        for (const order of data.orders) pushRow('orders', { ...order, deletedAt: null });
      })
      .catch((error) => console.warn('[AppContext] replaceAllData failed', error));
  };

  const syncNow: AppContextValue['syncNow'] = async () => {
    if (!isCloudSyncConfigured()) {
      return { ok: false, message: 'Supabase belum dikonfigurasi. Isi file .env terlebih dahulu.' };
    }
    await reconcileFull(realtimeCallbacks).catch(() => {});
    const finalStatus = getSyncStatus();
    if (finalStatus === 'offline') {
      return { ok: false, message: 'Tidak ada koneksi internet.' };
    }
    if (finalStatus === 'error') {
      return { ok: false, message: 'Gagal sync dengan cloud. Coba lagi nanti.' };
    }
    return { ok: true, message: 'Berhasil sync dengan cloud.' };
  };

  return (
    <AppContext.Provider
      value={{
        menuItems,
        orders,
        isLoaded,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        addOrder,
        updateOrder,
        deleteOrder,
        replaceAll,
        syncNow,
      }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}

export function getOrderStatus(order: Order): OrderStatus {
  return order.status ?? 'pending';
}
