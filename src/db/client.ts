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
