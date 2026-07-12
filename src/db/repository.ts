import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb } from '@/db/client';
import type { AppData, MenuItem, Order, OrderAddOn, OrderItem, OrderStatus, PaymentMethod } from '@/db/types';

type MenuItemRow = {
  id: string;
  name: string;
  imageUri: string | null;
  price: number;
};

type OrderRow = {
  id: string;
  customerName: string;
  customerWhatsapp: string;
  customerInstagram: string;
  items: string;
  paymentMethod: string;
  totalHarga: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  groupMemberNames: string;
  addOns: string;
};

function rowToMenuItem(row: MenuItemRow): MenuItem {
  return {
    id: row.id,
    name: row.name,
    imageUri: row.imageUri,
    price: row.price,
  };
}

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerName: row.customerName,
    customerWhatsapp: row.customerWhatsapp,
    customerInstagram: row.customerInstagram,
    items: JSON.parse(row.items) as OrderItem[],
    paymentMethod: row.paymentMethod as PaymentMethod,
    totalHarga: row.totalHarga,
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    groupMemberNames: JSON.parse(row.groupMemberNames) as string[],
    addOns: JSON.parse(row.addOns) as OrderAddOn[],
  };
}

export async function getAllMenuItems(): Promise<MenuItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MenuItemRow>('SELECT * FROM menu_items');
  return rows.map(rowToMenuItem);
}

export async function getAllOrders(): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OrderRow>('SELECT * FROM orders');
  return rows.map(rowToOrder);
}

export async function insertMenuItem(item: MenuItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO menu_items (id, name, imageUri, price) VALUES (?, ?, ?, ?)',
    item.id,
    item.name,
    item.imageUri,
    item.price
  );
}

export async function updateMenuItemRow(item: MenuItem): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE menu_items SET name = ?, imageUri = ?, price = ? WHERE id = ?',
    item.name,
    item.imageUri,
    item.price,
    item.id
  );
}

export async function deleteMenuItemRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM menu_items WHERE id = ?', id);
}

export async function insertOrder(order: Order): Promise<void> {
  const db = await getDb();
  await runInsertOrder(db, order);
}

export async function updateOrderRow(order: Order): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE orders SET
      customerName = ?, customerWhatsapp = ?, customerInstagram = ?, items = ?,
      paymentMethod = ?, totalHarga = ?, status = ?, createdAt = ?, updatedAt = ?,
      scheduledDate = ?, scheduledTime = ?, groupMemberNames = ?, addOns = ?
     WHERE id = ?`,
    order.customerName,
    order.customerWhatsapp,
    order.customerInstagram,
    JSON.stringify(order.items),
    order.paymentMethod,
    order.totalHarga,
    order.status,
    order.createdAt,
    order.updatedAt,
    order.scheduledDate,
    order.scheduledTime,
    JSON.stringify(order.groupMemberNames),
    JSON.stringify(order.addOns),
    order.id
  );
}

export async function deleteOrderRow(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM orders WHERE id = ?', id);
}

async function runInsertMenuItem(db: SQLiteDatabase, item: MenuItem): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO menu_items (id, name, imageUri, price) VALUES (?, ?, ?, ?)',
    item.id,
    item.name,
    item.imageUri,
    item.price
  );
}

async function runInsertOrder(db: SQLiteDatabase, order: Order): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO orders (
      id, customerName, customerWhatsapp, customerInstagram, items, paymentMethod,
      totalHarga, status, createdAt, updatedAt, scheduledDate, scheduledTime,
      groupMemberNames, addOns
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    order.id,
    order.customerName,
    order.customerWhatsapp,
    order.customerInstagram,
    JSON.stringify(order.items),
    order.paymentMethod,
    order.totalHarga,
    order.status,
    order.createdAt,
    order.updatedAt,
    order.scheduledDate,
    order.scheduledTime,
    JSON.stringify(order.groupMemberNames),
    JSON.stringify(order.addOns)
  );
}

/**
 * Overwrites the entire local database with `data`, replacing whatever was
 * there before (used by restore-from-cloud and the one-time AsyncStorage
 * migration). Wrapped in a manual BEGIN/COMMIT (with ROLLBACK on failure)
 * rather than db.withExclusiveTransactionAsync — the latter throws
 * "not supported on web" on expo-sqlite's WASM backend, and plain SQL
 * transaction statements work identically on native and web.
 */
export async function replaceAllData(data: AppData): Promise<void> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    await db.execAsync('DELETE FROM menu_items; DELETE FROM orders;');
    for (const item of data.menuItems) {
      await runInsertMenuItem(db, item);
    }
    for (const order of data.orders) {
      await runInsertOrder(db, order);
    }
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;').catch(() => {});
    throw error;
  }
}
