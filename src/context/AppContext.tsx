import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';

import { writeAutoBackupSnapshot } from '@/utils/autoBackup';
import { generateId } from '@/utils/id';

export type PaymentMethod = 'cash' | 'qris' | 'transfer';

export type OrderStatus = 'pending' | 'on_progress' | 'completed' | 'refund';

export type MenuItem = {
  id: string;
  name: string;
  imageUri: string | null;
  price: number;
};

export type OrderItem = {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
};

export type Order = {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  customerInstagram: string;
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  totalHarga: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type AppData = {
  menuItems: MenuItem[];
  orders: Order[];
};

const MENU_STORAGE_KEY = '@lartdaiselle/menuItems';
const ORDERS_STORAGE_KEY = '@lartdaiselle/orders';

type AppContextValue = {
  menuItems: MenuItem[];
  orders: Order[];
  isLoaded: boolean;
  addMenuItem: (item: Omit<MenuItem, 'id'>) => void;
  updateMenuItem: (id: string, patch: Omit<MenuItem, 'id'>) => void;
  deleteMenuItem: (id: string) => void;
  addOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
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

  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  useEffect(() => {
    (async () => {
      try {
        const [menuRaw, ordersRaw] = await Promise.all([
          AsyncStorage.getItem(MENU_STORAGE_KEY),
          AsyncStorage.getItem(ORDERS_STORAGE_KEY),
        ]);
        if (menuRaw) setMenuItems(JSON.parse(menuRaw));
        if (ordersRaw) setOrders(JSON.parse(ordersRaw));
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuItems)).catch(() => {});
  }, [menuItems, isLoaded]);

  useEffect(() => {
    if (!isLoaded) return;
    AsyncStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders)).catch(() => {});
  }, [orders, isLoaded]);

  const addMenuItem: AppContextValue['addMenuItem'] = (item) => {
    setMenuItems((prev) => [...prev, { ...item, id: generateId() }]);
  };

  const updateMenuItem: AppContextValue['updateMenuItem'] = (id, patch) => {
    setMenuItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const deleteMenuItem: AppContextValue['deleteMenuItem'] = (id) => {
    setMenuItems((prev) => prev.filter((m) => m.id !== id));
  };

  const addOrder: AppContextValue['addOrder'] = (order) => {
    const now = new Date().toISOString();
    const newOrder: Order = {
      ...order,
      id: generateId(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };
    setOrders((prev) => {
      const next = [...prev, newOrder];
      writeAutoBackupSnapshot({ menuItems: menuItemsRef.current, orders: next }).catch(() => {});
      return next;
    });
  };

  const updateOrder: AppContextValue['updateOrder'] = (id, patch) => {
    const now = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: now } : o))
    );
  };

  const deleteOrder: AppContextValue['deleteOrder'] = (id) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const replaceAll: AppContextValue['replaceAll'] = (data) => {
    setMenuItems(data.menuItems);
    setOrders(data.orders);
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
