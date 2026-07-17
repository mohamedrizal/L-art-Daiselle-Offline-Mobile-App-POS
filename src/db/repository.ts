import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb } from '@/db/client';
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

// These row shapes are deliberately exported: cloudSync.ts reuses them
// verbatim as the shape of the row it upserts to / receives from Supabase,
// since supabase/schema.sql mirrors these exact column names and TEXT-JSON
// encoding for nested fields (items/groupMemberNames/addOns). Sharing the
// type (and the row<->record conversion helpers below) means there is only
// one JSON (de)serialization path for these fields, not a local one and a
// separate cloud one.
export type MenuItemRow = {
  id: string;
  name: string;
  imageUri: string | null;
  price: number;
  updatedAt: string;
  deletedAt: string | null;
};

export type OrderRow = {
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
  deletedAt: string | null;
};

export function rowToMenuItemRecord(row: MenuItemRow): MenuItemRecord {
  return {
    id: row.id,
    name: row.name,
    imageUri: row.imageUri,
    price: row.price,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function rowToMenuItem(row: MenuItemRow): MenuItem {
  const { deletedAt: _deletedAt, ...item } = rowToMenuItemRecord(row);
  return item;
}

export function rowToOrderRecord(row: OrderRow): OrderRecord {
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
    deletedAt: row.deletedAt,
  };
}

function rowToOrder(row: OrderRow): Order {
  const { deletedAt: _deletedAt, ...order } = rowToOrderRecord(row);
  return order;
}

export function menuItemRecordToRow(record: MenuItemRecord): MenuItemRow {
  return { ...record };
}

export function orderRecordToRow(record: OrderRecord): OrderRow {
  return {
    id: record.id,
    customerName: record.customerName,
    customerWhatsapp: record.customerWhatsapp,
    customerInstagram: record.customerInstagram,
    items: JSON.stringify(record.items),
    paymentMethod: record.paymentMethod,
    totalHarga: record.totalHarga,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    scheduledDate: record.scheduledDate,
    scheduledTime: record.scheduledTime,
    groupMemberNames: JSON.stringify(record.groupMemberNames),
    addOns: JSON.stringify(record.addOns),
    deletedAt: record.deletedAt,
  };
}

/** Live menu items only (deletedAt IS NULL) — what every normal UI screen wants. */
export async function getAllMenuItems(): Promise<MenuItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MenuItemRow>('SELECT * FROM menu_items WHERE deletedAt IS NULL');
  return rows.map(rowToMenuItem);
}

/**
 * ALL menu item rows, including soft-deleted tombstones. Only for
 * sync/reconciliation (cloudSync.ts) — never for UI.
 */
export async function getAllMenuItemsIncludingDeleted(): Promise<MenuItemRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<MenuItemRow>('SELECT * FROM menu_items');
  return rows.map(rowToMenuItemRecord);
}

export async function getMenuItemRecordById(id: string): Promise<MenuItemRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MenuItemRow>('SELECT * FROM menu_items WHERE id = ?', id);
  return row ? rowToMenuItemRecord(row) : null;
}

/** Live orders only (deletedAt IS NULL) — what every normal UI screen wants. */
export async function getAllOrders(): Promise<Order[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OrderRow>('SELECT * FROM orders WHERE deletedAt IS NULL');
  return rows.map(rowToOrder);
}

/**
 * ALL order rows, including soft-deleted tombstones. Only for
 * sync/reconciliation (cloudSync.ts) — never for UI.
 */
export async function getAllOrdersIncludingDeleted(): Promise<OrderRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OrderRow>('SELECT * FROM orders');
  return rows.map(rowToOrderRecord);
}

export async function getOrderRecordById(id: string): Promise<OrderRecord | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<OrderRow>('SELECT * FROM orders WHERE id = ?', id);
  return row ? rowToOrderRecord(row) : null;
}

export async function insertMenuItem(item: MenuItem): Promise<MenuItemRecord> {
  const db = await getDb();
  const record: MenuItemRecord = { ...item, deletedAt: null };
  await db.runAsync(
    'INSERT INTO menu_items (id, name, imageUri, price, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)',
    record.id,
    record.name,
    record.imageUri,
    record.price,
    record.updatedAt,
    record.deletedAt
  );
  return record;
}

export async function updateMenuItemRow(item: MenuItem): Promise<MenuItemRecord> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE menu_items SET name = ?, imageUri = ?, price = ?, updatedAt = ? WHERE id = ?',
    item.name,
    item.imageUri,
    item.price,
    item.updatedAt,
    item.id
  );
  return { ...item, deletedAt: null };
}

/**
 * Soft-deletes a menu item (sets deletedAt/updatedAt) instead of a hard
 * DELETE, so the tombstone can propagate to other devices via Supabase
 * Realtime. Returns the resulting record (for the caller to push to the
 * cloud), or null if no row with that id existed.
 */
export async function deleteMenuItemRow(id: string): Promise<MenuItemRecord | null> {
  const db = await getDb();
  const existing = await getMenuItemRecordById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  await db.runAsync('UPDATE menu_items SET deletedAt = ?, updatedAt = ? WHERE id = ?', now, now, id);
  return { ...existing, updatedAt: now, deletedAt: now };
}

export async function insertOrder(order: Order): Promise<OrderRecord> {
  const db = await getDb();
  const record: OrderRecord = { ...order, deletedAt: null };
  await runInsertOrderRecord(db, record);
  return record;
}

export async function updateOrderRow(order: Order): Promise<OrderRecord> {
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
  return { ...order, deletedAt: null };
}

/**
 * Soft-deletes an order (sets deletedAt/updatedAt) instead of a hard DELETE,
 * so the tombstone can propagate to other devices via Supabase Realtime.
 * Returns the resulting record (for the caller to push to the cloud), or
 * null if no row with that id existed.
 */
export async function deleteOrderRow(id: string): Promise<OrderRecord | null> {
  const db = await getDb();
  const existing = await getOrderRecordById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  await db.runAsync('UPDATE orders SET deletedAt = ?, updatedAt = ? WHERE id = ?', now, now, id);
  return { ...existing, updatedAt: now, deletedAt: now };
}

async function runInsertMenuItemRecord(db: SQLiteDatabase, record: MenuItemRecord): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO menu_items (id, name, imageUri, price, updatedAt, deletedAt) VALUES (?, ?, ?, ?, ?, ?)',
    record.id,
    record.name,
    record.imageUri,
    record.price,
    record.updatedAt,
    record.deletedAt
  );
}

async function runInsertOrderRecord(db: SQLiteDatabase, record: OrderRecord): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO orders (
      id, customerName, customerWhatsapp, customerInstagram, items, paymentMethod,
      totalHarga, status, createdAt, updatedAt, scheduledDate, scheduledTime,
      groupMemberNames, addOns, deletedAt
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.customerName,
    record.customerWhatsapp,
    record.customerInstagram,
    JSON.stringify(record.items),
    record.paymentMethod,
    record.totalHarga,
    record.status,
    record.createdAt,
    record.updatedAt,
    record.scheduledDate,
    record.scheduledTime,
    JSON.stringify(record.groupMemberNames),
    JSON.stringify(record.addOns),
    record.deletedAt
  );
}

/**
 * Upserts a single menu item record coming from cloud reconciliation or a
 * realtime event into local SQLite (including its deletedAt tombstone, if
 * any). Only used by cloudSync.ts — regular UI-driven CRUD goes through
 * insertMenuItem/updateMenuItemRow/deleteMenuItemRow above.
 */
export async function upsertMenuItemRecord(record: MenuItemRecord): Promise<void> {
  const db = await getDb();
  await runInsertMenuItemRecord(db, record);
}

/**
 * Upserts a single order record coming from cloud reconciliation or a
 * realtime event into local SQLite (including its deletedAt tombstone, if
 * any). Only used by cloudSync.ts — regular UI-driven CRUD goes through
 * insertOrder/updateOrderRow/deleteOrderRow above.
 */
export async function upsertOrderRecord(record: OrderRecord): Promise<void> {
  const db = await getDb();
  await runInsertOrderRecord(db, record);
}

/**
 * Overwrites the entire local database with `data`, replacing whatever was
 * there before (used by the one-time AsyncStorage migration, and by
 * AppContext's replaceAll). Wrapped in a manual BEGIN/COMMIT (with ROLLBACK
 * on failure) rather than db.withExclusiveTransactionAsync — the latter
 * throws "not supported on web" on expo-sqlite's WASM backend, and plain SQL
 * transaction statements work identically on native and web.
 *
 * Rows written this way are always treated as live (deletedAt: null) — this
 * is a full local replacement, not a merge, so there's nothing to tombstone.
 */
export async function replaceAllData(data: AppData): Promise<void> {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    await db.execAsync('DELETE FROM menu_items; DELETE FROM orders;');
    for (const item of data.menuItems) {
      await runInsertMenuItemRecord(db, { ...item, deletedAt: null });
    }
    for (const order of data.orders) {
      await runInsertOrderRecord(db, { ...order, deletedAt: null });
    }
    await db.execAsync('COMMIT;');
  } catch (error) {
    await db.execAsync('ROLLBACK;').catch(() => {});
    throw error;
  }
}
