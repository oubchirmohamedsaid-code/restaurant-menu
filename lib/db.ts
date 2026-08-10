import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import type { InArgs } from "@libsql/client";
import { logger } from "./logger";
import type { OrderStatus, OrderPriority, PaymentStatus } from "./orders";
import { DEFAULT_LATE_MINUTES } from "./orders";
import { formatOrderLine } from "./cart";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "menu.db");

export interface CategoryRow {
  id: number;
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
  isHidden: number;
  sortOrder: number;
}

export interface IngredientRow {
  id: number;
  productId: number;
  name: string;
  priceCents: number;
  isExtra: number;
  isRequired: number;
  sortOrder: number;
}

export interface OrderRow {
  id: number;
  items: string;
  totalCents: number;
  createdAt: number;
  updatedAt: number;
  status: OrderStatus;
  priority: OrderPriority;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  cancelReason: string;
  deliveryFeeCents: number;
  discountCents: number;
  paymentStatus: PaymentStatus;
  confirmedAt: number | null;
  preparingAt: number | null;
  deliveredAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
}

export interface OrderLineInput {
  productId: number;
  name: string;
  qty: number;
  unitCents: number;
  extras: string[];
  removed: string[];
}

export interface OrderLineRow {
  id: number;
  orderId: number;
  productId: number;
  name: string;
  qty: number;
  unitCents: number;
  lineCents: number;
  extras: string;
  removed: string;
}

export interface OrderActivityRow {
  id: number;
  orderId: number;
  at: number;
  actor: string;
  action: string;
  detail: string;
}

export interface OrderDetail {
  order: OrderRow;
  lines: OrderLineRow[];
  activity: OrderActivityRow[];
}

export interface CreateOrderOptions {
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  deliveryFeeCents?: number;
  discountCents?: number;
  actor?: string;
}

export interface ProductRow {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: number;
  isHidden: number;
  sortOrder: number;
}

export interface ProductInput {
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: number;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS Category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  nameAr TEXT NOT NULL,
  icon TEXT NOT NULL,
  imageUrl TEXT NOT NULL DEFAULT '',
  isHidden INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS Product (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  categoryId INTEGER NOT NULL REFERENCES Category(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priceCents INTEGER NOT NULL,
  imageUrl TEXT NOT NULL,
  isAvailable INTEGER NOT NULL DEFAULT 1,
  isHidden INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_product_category ON Product(categoryId);
CREATE TABLE IF NOT EXISTS Ingredient (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  productId INTEGER NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priceCents INTEGER NOT NULL DEFAULT 0,
  isExtra INTEGER NOT NULL DEFAULT 0,
  isRequired INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_ingredient_product ON Ingredient(productId);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  items TEXT NOT NULL,
  totalCents INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT NOT NULL DEFAULT 'normal',
  customerName TEXT NOT NULL DEFAULT '',
  customerPhone TEXT NOT NULL DEFAULT '',
  customerAddress TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  cancelReason TEXT NOT NULL DEFAULT '',
  deliveryFeeCents INTEGER NOT NULL DEFAULT 0,
  discountCents INTEGER NOT NULL DEFAULT 0,
  paymentStatus TEXT NOT NULL DEFAULT 'unpaid',
  confirmedAt INTEGER,
  preparingAt INTEGER,
  deliveredAt INTEGER,
  completedAt INTEGER,
  cancelledAt INTEGER
);
CREATE TABLE IF NOT EXISTS order_line (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  productId INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unitCents INTEGER NOT NULL,
  lineCents INTEGER NOT NULL,
  extras TEXT NOT NULL DEFAULT '[]',
  removed TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_order_line_order ON order_line(orderId);
CREATE TABLE IF NOT EXISTS order_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  at INTEGER NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_activity_order ON order_activity(orderId);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

type Row = Record<string, unknown>;

interface Statement {
  all(...args: unknown[]): Promise<Row[]>;
  get(...args: unknown[]): Promise<Row | undefined>;
  run(...args: unknown[]): Promise<{ lastInsertRowid: number | bigint; changes: number }>;
}

interface DbHandle {
  exec(sql: string): Promise<void>;
  prepare(sql: string): Statement;
}

class LocalDb implements DbHandle {
  private conn: { exec(s: string): void; prepare(s: string): unknown };
  constructor(conn: { exec(s: string): void; prepare(s: string): unknown }) {
    this.conn = conn;
  }
  exec(sql: string): Promise<void> {
    this.conn.exec(sql);
    return Promise.resolve();
  }
  prepare(sql: string): Statement {
    const stmt = this.conn.prepare(sql) as {
      all(...a: unknown[]): unknown;
      get(...a: unknown[]): unknown;
      run(...a: unknown[]): unknown;
    };
    const toPlain = (r: Row) => ({ ...r });
    return {
      all: (...args) =>
        Promise.resolve(
          (stmt.all(...args) as Row[]).map(toPlain),
        ),
      get: (...args) => {
        const row = stmt.get(...args) as Row | undefined;
        return Promise.resolve(row ? { ...row } : undefined);
      },
      run: (...args) =>
        Promise.resolve(
          stmt.run(...args) as unknown as {
            lastInsertRowid: number | bigint;
            changes: number;
          },
        ),
    };
  }
}

class TursoDb implements DbHandle {
  private client: ReturnType<typeof createClient>;
  constructor(url: string, token?: string) {
    this.client = createClient({ url, authToken: token });
  }
  async exec(sql: string): Promise<void> {
    await this.client.executeMultiple(sql);
  }
  prepare(sql: string): Statement {
    return {
      all: async (...args) => {
        const rs = await this.client.execute({ sql, args: args as InArgs });
        return rs.rows.map((r) =>
          Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])),
        ) as Row[];
      },
      get: async (...args) => {
        const rows = await this.prepare(sql).all(...args);
        return rows[0];
      },
      run: async (...args) => {
        const rs = await this.client.execute({ sql, args: args as InArgs });
        return { lastInsertRowid: rs.lastInsertRowid ?? 0, changes: rs.rowsAffected };
      },
    };
  }
}

async function hasColumn(db: DbHandle, table: string, col: string): Promise<boolean> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === col);
}

const MIGRATIONS: Array<[string, string, string]> = [
  ["Category", "imageUrl", "TEXT NOT NULL DEFAULT ''"],
  ["Category", "isHidden", "INTEGER NOT NULL DEFAULT 0"],
  ["Ingredient", "isRequired", "INTEGER NOT NULL DEFAULT 0"],
  ["Product", "isHidden", "INTEGER NOT NULL DEFAULT 0"],
  ["orders", "updatedAt", "INTEGER NOT NULL DEFAULT 0"],
  ["orders", "status", "TEXT NOT NULL DEFAULT 'new'"],
  ["orders", "priority", "TEXT NOT NULL DEFAULT 'normal'"],
  ["orders", "customerName", "TEXT NOT NULL DEFAULT ''"],
  ["orders", "customerPhone", "TEXT NOT NULL DEFAULT ''"],
  ["orders", "customerAddress", "TEXT NOT NULL DEFAULT ''"],
  ["orders", "notes", "TEXT NOT NULL DEFAULT ''"],
  ["orders", "cancelReason", "TEXT NOT NULL DEFAULT ''"],
  ["orders", "deliveryFeeCents", "INTEGER NOT NULL DEFAULT 0"],
  ["orders", "discountCents", "INTEGER NOT NULL DEFAULT 0"],
  ["orders", "paymentStatus", "TEXT NOT NULL DEFAULT 'unpaid'"],
  ["orders", "confirmedAt", "INTEGER"],
  ["orders", "preparingAt", "INTEGER"],
  ["orders", "deliveredAt", "INTEGER"],
  ["orders", "completedAt", "INTEGER"],
  ["orders", "cancelledAt", "INTEGER"],
];

async function migrate(db: DbHandle): Promise<void> {
  for (const [table, col, ddl] of MIGRATIONS) {
    if (!(await hasColumn(db, table, col))) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
    }
  }
  await db.exec("UPDATE orders SET updatedAt = createdAt WHERE updatedAt = 0");
  for (const [status, minutes] of Object.entries(DEFAULT_LATE_MINUTES)) {
    await db
      .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
      .run(`late_${status}_minutes`, String(minutes));
  }
}

async function openLocal(): Promise<DbHandle> {
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  const db = new LocalDb(conn);
  await migrate(db);
  return db;
}

async function openTurso(): Promise<DbHandle> {
  const url = process.env.TURSO_URL!;
  const token = process.env.TURSO_TOKEN;
  const db = new TursoDb(url, token);
  await db.exec(SCHEMA);
  await migrate(db);
  return db;
}

const globalForDb = globalThis as unknown as { db?: Promise<DbHandle> };

function getDb(): Promise<DbHandle> {
  if (!globalForDb.db) {
    if (process.env.TURSO_URL) {
      logger.info("db backend: turso", { url: process.env.TURSO_URL });
      globalForDb.db = openTurso();
    } else if (process.env.NODE_ENV === "production") {
      const msg =
        "TURSO_URL is not configured. On a hosted deployment (Vercel) set TURSO_URL and TURSO_TOKEN in Environment Variables, then redeploy.";
      logger.error(msg);
      globalForDb.db = Promise.reject(new Error(msg));
    } else {
      logger.info("db backend: local sqlite");
      globalForDb.db = openLocal();
    }
  }
  return globalForDb.db;
}

function plainRow<T>(r: Row | undefined): T | undefined {
  return r ? ({ ...r } as T) : undefined;
}

export async function listCategories(): Promise<CategoryRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM Category ORDER BY sortOrder, id").all()) as unknown as CategoryRow[];
}

export async function getCategoryBySlug(slug: string): Promise<CategoryRow | undefined> {
  const db = await getDb();
  return plainRow<CategoryRow>(await db.prepare("SELECT * FROM Category WHERE slug = ?").get(slug));
}

export async function getCategoryById(id: number): Promise<CategoryRow | undefined> {
  const db = await getDb();
  return plainRow<CategoryRow>(await db.prepare("SELECT * FROM Category WHERE id = ?").get(id));
}

export async function listProductsByCategory(categoryId: number): Promise<ProductRow[]> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM Product WHERE categoryId = ? ORDER BY sortOrder, id")
    .all(categoryId)) as unknown as ProductRow[];
}

export async function getProductById(id: number): Promise<ProductRow | undefined> {
  const db = await getDb();
  return plainRow<ProductRow>(await db.prepare("SELECT * FROM Product WHERE id = ?").get(id));
}

export async function updateCategoryImage(id: number, imageUrl: string): Promise<void> {
  const db = await getDb();
  await db.prepare("UPDATE Category SET imageUrl = ? WHERE id = ?").run(imageUrl, id);
}

export async function createCategory(input: {
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
  sortOrder: number;
}): Promise<number> {
  const db = await getDb();
  const { lastInsertRowid } = await db
    .prepare(
      "INSERT INTO Category (slug, nameAr, icon, imageUrl, sortOrder) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.slug, input.nameAr, input.icon, input.imageUrl, input.sortOrder);
  return Number(lastInsertRowid);
}

export async function updateCategory(
  id: number,
  input: { nameAr: string; isHidden: number },
): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE Category SET nameAr = ?, isHidden = ? WHERE id = ?")
    .run(input.nameAr, input.isHidden, id);
}

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM Category WHERE id = ?").run(id);
}

export async function reorderCategories(ids: number[]): Promise<void> {
  const db = await getDb();
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  for (let i = 0; i < unique.length; i++) {
    await db.prepare("UPDATE Category SET sortOrder = ? WHERE id = ?").run(i, unique[i]);
  }
}

export async function createProduct(input: ProductInput): Promise<number> {
  const db = await getDb();
  const result = await db
    .prepare(
      "INSERT INTO Product (categoryId, name, description, priceCents, imageUrl, isAvailable) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(
      input.categoryId,
      input.name,
      input.description,
      input.priceCents,
      input.imageUrl,
      input.isAvailable,
    );
  return Number(result.lastInsertRowid);
}

export async function updateProduct(id: number, input: ProductInput): Promise<void> {
  const db = await getDb();
  await db
    .prepare(
      "UPDATE Product SET categoryId = ?, name = ?, description = ?, priceCents = ?, imageUrl = ?, isAvailable = ? WHERE id = ?",
    )
    .run(
      input.categoryId,
      input.name,
      input.description,
      input.priceCents,
      input.imageUrl,
      input.isAvailable,
      id,
    );
}

export async function deleteProduct(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM Product WHERE id = ?").run(id);
}

const MAX_BULK_IDS = 200;

export async function hideUnavailableProducts(categoryId: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .prepare(
      "UPDATE Product SET isHidden = 1 WHERE categoryId = ? AND isAvailable = 0 AND isHidden = 0",
    )
    .run(categoryId);
  return result.changes;
}

export async function showHiddenProducts(categoryId: number, ids: number[]): Promise<number> {
  const unique = [...new Set(ids)]
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, MAX_BULK_IDS);
  if (unique.length === 0) return 0;
  const db = await getDb();
  const placeholders = unique.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `UPDATE Product SET isHidden = 0 WHERE categoryId = ? AND isHidden = 1 AND id IN (${placeholders})`,
    )
    .run(categoryId, ...unique);
  return result.changes;
}

export interface CategoryWithCount extends CategoryRow {
  productCount: number;
}

export async function listCategoriesWithCounts(): Promise<CategoryWithCount[]> {
  const db = await getDb();
  return (await db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM Product p WHERE p.categoryId = c.id) AS productCount
       FROM Category c ORDER BY c.sortOrder, c.id`,
    )
    .all()) as unknown as CategoryWithCount[];
}

export async function countAll(): Promise<{ categories: number; products: number }> {
  const db = await getDb();
  const c = (await db.prepare("SELECT COUNT(*) AS n FROM Category").get()) as { n: number };
  const p = (await db.prepare("SELECT COUNT(*) AS n FROM Product").get()) as { n: number };
  return { categories: c.n, products: p.n };
}

export async function clearAll(): Promise<void> {
  const db = await getDb();
  await db.exec("DELETE FROM orders; DELETE FROM Product; DELETE FROM Category;");
}

export async function listIngredientsByProduct(productId: number): Promise<IngredientRow[]> {
  const db = await getDb();
  return (await db
    .prepare("SELECT * FROM Ingredient WHERE productId = ? ORDER BY isExtra, sortOrder, id")
    .all(productId)) as unknown as IngredientRow[];
}

export async function createIngredient(
  productId: number,
  name: string,
  priceCents: number,
  isExtra: number,
  isRequired: number,
): Promise<number> {
  const db = await getDb();
  const n = (await db
    .prepare("SELECT COUNT(*) AS n FROM Ingredient WHERE productId = ?")
    .get(productId)) as { n: number };
  const result = await db
    .prepare(
      "INSERT INTO Ingredient (productId, name, priceCents, isExtra, isRequired, sortOrder) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(productId, name, priceCents, isExtra, isRequired, n.n);
  return Number(result.lastInsertRowid);
}

export async function updateIngredient(
  id: number,
  name: string,
  priceCents: number,
  isExtra: number,
  isRequired: number,
): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE Ingredient SET name = ?, priceCents = ?, isExtra = ?, isRequired = ? WHERE id = ?")
    .run(name, priceCents, isExtra, isRequired, id);
}

export async function deleteIngredient(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM Ingredient WHERE id = ?").run(id);
}

async function logActivity(
  db: DbHandle,
  orderId: number,
  action: string,
  actor: string,
  detail = "",
): Promise<void> {
  await db
    .prepare("INSERT INTO order_activity (orderId, at, actor, action, detail) VALUES (?, ?, ?, ?, ?)")
    .run(orderId, Date.now(), actor, action, detail);
}

export async function createOrder(
  lines: OrderLineInput[],
  totalCents: number,
  opts: CreateOrderOptions = {},
): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const items = lines.map((l) =>
    formatOrderLine({
      name: l.name,
      qty: l.qty,
      priceCents: l.unitCents,
      extras: l.extras,
      removed: l.removed,
    }),
  );
  const result = await db
    .prepare(
      `INSERT INTO orders (items, totalCents, createdAt, updatedAt, status, priority, customerName, customerPhone, customerAddress, notes, deliveryFeeCents, discountCents, paymentStatus)
       VALUES (?, ?, ?, ?, 'new', 'normal', ?, ?, ?, ?, ?, ?, 'unpaid')`,
    )
    .run(
      JSON.stringify(items),
      totalCents,
      now,
      now,
      opts.customerName ?? "",
      opts.customerPhone ?? "",
      opts.customerAddress ?? "",
      opts.notes ?? "",
      opts.deliveryFeeCents ?? 0,
      opts.discountCents ?? 0,
    );
  const orderId = Number(result.lastInsertRowid);
  for (const l of lines) {
    await db
      .prepare(
        `INSERT INTO order_line (orderId, productId, name, qty, unitCents, lineCents, extras, removed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        orderId,
        l.productId,
        l.name,
        l.qty,
        l.unitCents,
        l.unitCents * l.qty,
        JSON.stringify(l.extras ?? []),
        JSON.stringify(l.removed ?? []),
      );
  }
  await logActivity(db, orderId, "created", opts.actor ?? "system", "تم إنشاء الطلب");
  return orderId;
}

export async function listOrders(): Promise<OrderRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM orders ORDER BY id DESC").all()) as unknown as OrderRow[];
}

async function getOrderRow(id: number): Promise<OrderRow | undefined> {
  const db = await getDb();
  return plainRow<OrderRow>(await db.prepare("SELECT * FROM orders WHERE id = ?").get(id));
}

export async function getOrder(id: number): Promise<OrderDetail | undefined> {
  const db = await getDb();
  const order = await getOrderRow(id);
  if (!order) return undefined;
  const lines = (await db.prepare("SELECT * FROM order_line WHERE orderId = ? ORDER BY id").all(id)) as unknown as OrderLineRow[];
  const activity = (await db.prepare("SELECT * FROM order_activity WHERE orderId = ? ORDER BY id").all(id)) as unknown as OrderActivityRow[];
  return { order, lines, activity };
}

export async function updateOrderStatus(
  id: number,
  status: OrderStatus,
  opts: { actor?: string; reason?: string } = {},
): Promise<void> {
  const db = await getDb();
  const order = await getOrderRow(id);
  if (!order || order.status === status) return;
  const now = Date.now();
  const cols: Record<string, string | number> = { status, updatedAt: now };
  if (status === "preparing") {
    cols.confirmedAt = now;
    cols.preparingAt = now;
  } else if (status === "delivered") {
    cols.deliveredAt = now;
  } else if (status === "completed") {
    cols.completedAt = now;
  } else if (status === "cancelled") {
    cols.cancelledAt = now;
    cols.cancelReason = opts.reason ?? "";
  }
  const keys = Object.keys(cols);
  await db
    .prepare(`UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`)
    .run(...keys.map((k) => cols[k]), id);
  const actor = opts.actor ?? "admin";
  if (status === "preparing") {
    await logActivity(db, id, "confirmed", actor, "تم تأكيد الطلب");
    await logActivity(db, id, "preparing", actor, "بدأ التحضير");
  } else if (status === "delivered") {
    await logActivity(db, id, "delivered", actor, "تم التوصيل");
  } else if (status === "completed") {
    await logActivity(db, id, "completed", actor, "تم إكمال الطلب");
  } else if (status === "cancelled") {
    await logActivity(db, id, "cancelled", actor, opts.reason ? `الإلغاء: ${opts.reason}` : "تم إلغاء الطلب");
  }
}

export async function setOrderPriority(
  id: number,
  priority: OrderPriority,
  actor = "admin",
): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE orders SET priority = ?, updatedAt = ? WHERE id = ?")
    .run(priority, Date.now(), id);
  await logActivity(db, id, "priority", actor, `الأولوية: ${priority}`);
}

export async function setOrderPaymentStatus(
  id: number,
  paymentStatus: PaymentStatus,
  actor = "admin",
): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE orders SET paymentStatus = ?, updatedAt = ? WHERE id = ?")
    .run(paymentStatus, Date.now(), id);
  await logActivity(db, id, "payment", actor, paymentStatus === "paid" ? "تم الدفع" : "غير مدفوع");
}

export async function deleteOrder(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM order_activity WHERE orderId = ?").run(id);
  await db.prepare("DELETE FROM order_line WHERE orderId = ?").run(id);
  await db.prepare("DELETE FROM orders WHERE id = ?").run(id);
}

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? String(row.value) : undefined;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db
    .prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}
