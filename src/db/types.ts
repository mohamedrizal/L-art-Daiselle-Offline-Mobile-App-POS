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
