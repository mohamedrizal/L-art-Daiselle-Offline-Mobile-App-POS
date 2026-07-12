import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
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
import type { AppData, MenuItem, Order, OrderAddOn, OrderItem, OrderStatus, PaymentMethod } from '@/db/types';
import { scheduleAutoSync, tryAutoSyncOnLaunch } from '@/utils/cloudSync';
import { generateId } from '@/utils/id';

// Re-exported so existing screens can keep importing these types from
// '@/context/AppContext' unchanged — the canonical definitions now live in
// '@/db/types' so the db layer doesn't have to import from this file.
export type { AppData, MenuItem, Order, OrderAddOn, OrderItem, OrderStatus, PaymentMethod };

type AppContextValue = {
  menuItems: MenuItem[];
  orders: Order[];
  isLoaded: boolean;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, patch: Omit<MenuItem, 'id'>) => void;
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
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const menuItemsRef = useRef(menuItems);
  const ordersRef = useRef(orders);

  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const getSnapshot = (): AppData => ({
    menuItems: menuItemsRef.current,
    orders: ordersRef.current,
  });

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

  // Silent auto-sync to cloud on launch and whenever the app returns to the
  // foreground. No-ops instantly if Supabase isn't configured or the device
  // is offline — offline is this app's normal operating mode.
  useEffect(() => {
    if (!isLoaded) return;
    tryAutoSyncOnLaunch(getSnapshot).catch(() => {});

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        tryAutoSyncOnLaunch(getSnapshot).catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [isLoaded]);

  const addMenuItem: AppContextValue['addMenuItem'] = (item) => {
    const newItem: MenuItem = { ...item, id: generateId() };
    setMenuItems((prev) => [...prev, newItem]);
    insertMenuItem(newItem).catch((error) =>
      console.warn('[AppContext] insertMenuItem failed', error)
    );
    scheduleAutoSync(getSnapshot);
  };

  const updateMenuItem: AppContextValue['updateMenuItem'] = (id, patch) => {
    let updated: MenuItem | undefined;
    setMenuItems((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        updated = { ...m, ...patch };
        return updated;
      })
    );
    if (updated) {
      updateMenuItemRow(updated).catch((error) =>
        console.warn('[AppContext] updateMenuItemRow failed', error)
      );
    }
    scheduleAutoSync(getSnapshot);
  };

  const deleteMenuItem: AppContextValue['deleteMenuItem'] = (id) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
    deleteMenuItemRow(id).catch((error) =>
      console.warn('[AppContext] deleteMenuItemRow failed', error)
    );
    scheduleAutoSync(getSnapshot);
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
    insertOrder(newOrder).catch((error) => console.warn('[AppContext] insertOrder failed', error));
    scheduleAutoSync(getSnapshot);
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
      updateOrderRow(updated).catch((error) =>
        console.warn('[AppContext] updateOrderRow failed', error)
      );
    }
    scheduleAutoSync(getSnapshot);
  };

  const deleteOrder: AppContextValue['deleteOrder'] = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
    deleteOrderRow(id).catch((error) => console.warn('[AppContext] deleteOrderRow failed', error));
    scheduleAutoSync(getSnapshot);
  };

  const replaceAll: AppContextValue['replaceAll'] = (data) => {
    setMenuItems(data.menuItems);
    setOrders(data.orders);
    replaceAllData(data).catch((error) =>
      console.warn('[AppContext] replaceAllData failed', error)
    );
    scheduleAutoSync(() => data);
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
