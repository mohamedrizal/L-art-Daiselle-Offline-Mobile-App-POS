// Shared data shapes for the app's local database. These live outside
// AppContext.tsx so both the context and the db layer can import them
// without creating a circular dependency; AppContext.tsx re-exports them
// so every screen can keep importing types from '@/context/AppContext'.

export type PaymentMethod = 'cash' | 'qris';

export type OrderStatus = 'pending' | 'on_progress' | 'completed' | 'refund';

export type MenuItem = {
  id: string;
  name: string;
  imageUri: string | null;
  price: number;
  updatedAt: string;
};

export type OrderItem = {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
};

export type OrderAddOn = {
  id: string;
  name: string;
  price: number;
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
  scheduledDate: string | null;
  scheduledTime: string | null;
  groupMemberNames: string[];
  addOns: OrderAddOn[];
};

export type AppData = {
  menuItems: MenuItem[];
  orders: Order[];
};

// --- Internal sync/reconciliation types ------------------------------------
//
// MenuItemRecord / OrderRecord extend the public MenuItem/Order shapes with a
// `deletedAt` soft-delete tombstone (null = not deleted, ISO timestamp =
// deleted at that time). They exist ONLY for the db layer (repository.ts)
// and the cloud sync layer (utils/cloudSync.ts) to do reconciliation/merge
// logic and propagate deletions to other devices via Supabase Realtime.
//
// AppContextValue and every UI screen only ever see MenuItem/Order — rows
// with a non-null deletedAt are filtered out before they ever reach React
// state, so the UI never needs to know soft-delete exists.
export type MenuItemRecord = MenuItem & { deletedAt: string | null };
export type OrderRecord = Order & { deletedAt: string | null };
