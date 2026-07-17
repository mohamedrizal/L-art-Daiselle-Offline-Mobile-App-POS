import * as SQLite from 'expo-sqlite';

const DB_NAME = 'lartdaiselle.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function initSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  // Nested/array fields (items, addOns, groupMemberNames) are stored as
  // JSON-serialized TEXT columns on purpose: they are never queried
  // relationally, only ever loaded/saved whole alongside their parent order.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      imageUri TEXT,
      price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      customerName TEXT NOT NULL,
      customerWhatsapp TEXT NOT NULL,
      customerInstagram TEXT NOT NULL,
      items TEXT NOT NULL,
      paymentMethod TEXT NOT NULL,
      totalHarga REAL NOT NULL,
      status TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      scheduledDate TEXT,
      scheduledTime TEXT,
      groupMemberNames TEXT NOT NULL,
      addOns TEXT NOT NULL
    );
  `);

  await migrateSyncColumns(db);
}

type ColumnInfoRow = { name: string };

async function hasColumn(db: SQLite.SQLiteDatabase, table: string, column: string): Promise<boolean> {
  // expo-sqlite's bound-parameter placeholders aren't valid inside PRAGMA
  // statements on every backend, and table names here are always our own
  // hardcoded constants (never user input), so plain string interpolation
  // is safe.
  const columns = await db.getAllAsync<ColumnInfoRow>(`PRAGMA table_info(${table});`);
  return columns.some((c) => c.name === column);
}

/**
 * Non-destructive migration adding the columns needed for multi-device
 * realtime sync (added after the app's initial SQLite-only release):
 *   - menu_items.updatedAt — last-write-wins conflict resolution, mirroring
 *     the column `orders` already had from the start.
 *   - menu_items.deletedAt / orders.deletedAt — soft-delete tombstones so
 *     deletions propagate to other devices via Supabase Realtime instead of
 *     silently hard-deleting a row other devices have no way to learn about.
 *
 * expo-sqlite has no "ADD COLUMN IF NOT EXISTS", so each column is guarded
 * with a PRAGMA table_info check first — running this repeatedly (every app
 * launch) is always a safe no-op once the columns exist. Existing menu_items
 * rows get `updatedAt` backfilled to "now" (best guess — their real last
 * local-write time isn't tracked) so they don't look infinitely stale for
 * conflict resolution. This never drops or rewrites the tables themselves,
 * so previously-tested local data survives the upgrade untouched.
 */
async function migrateSyncColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();

  if (!(await hasColumn(db, 'menu_items', 'updatedAt'))) {
    await db.execAsync('ALTER TABLE menu_items ADD COLUMN updatedAt TEXT;');
    await db.runAsync('UPDATE menu_items SET updatedAt = ? WHERE updatedAt IS NULL;', now);
  }
  if (!(await hasColumn(db, 'menu_items', 'deletedAt'))) {
    await db.execAsync('ALTER TABLE menu_items ADD COLUMN deletedAt TEXT;');
  }
  if (!(await hasColumn(db, 'orders', 'deletedAt'))) {
    await db.execAsync('ALTER TABLE orders ADD COLUMN deletedAt TEXT;');
  }
}

/**
 * Returns the single shared SQLite connection for the app, opening and
 * initializing the schema on first call. Safe to call concurrently — all
 * callers await the same in-flight open/init promise.
 */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
      await initSchema(db);
      return db;
    });
  }
  return dbPromise;
}
