import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import type { InArgs } from "@libsql/client";
import { logger } from "./logger";
import type { OrderStatus, OrderPriority, PaymentStatus } from "./orders";
import { DEFAULT_LATE_MINUTES } from "./orders";
import { formatOrderLine } from "./cart";
import {
  CASHBOX_METHODS,
  CASHBOX_TX_TYPES,
  defaultDirection,
  txEffectCents,
} from "./cashbox";
import type {
  CashboxActor,
  CashboxByTypeStat,
  CashboxDayStat,
  CashboxListFilters,
  CashboxSessionDetail,
  CashboxSessionRow,
  CashboxSummary,
  CashboxSummaryPeriod,
  CashboxTxInput,
  CashboxTxRow,
  CashboxTxType,
} from "./cashbox";
import {
  STOCK_ITEM_TYPES,
  STOCK_KIND_LABELS,
  STOCK_MOVEMENT_KINDS,
  STOCK_UNITS,
  roundQty,
} from "./stock";
import type {
  ProductIngredientRow,
  ProductIngredientsView,
  StockItemRow,
  StockListFilters,
  StockMovementFilters,
  StockMovementKind,
  StockMovementRow,
  StockSummary,
  StockConsumptionRow,
} from "./stock";

function dataDir(): string {
  return process.env.OGT_DATA_DIR ?? join(process.cwd(), "data");
}

function dbPath(): string {
  return join(dataDir(), "menu.db");
}

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
  paymentMethod: string;
  confirmedAt: number | null;
  preparingAt: number | null;
  deliveredAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  paidAt: number | null;
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
  paymentMethod?: string;
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

export interface AddonGroupRow {
  id: number;
  name: string;
  isActive: number;
  sortOrder: number;
}

export interface AddonOptionRow {
  id: number;
  groupId: number;
  name: string;
  priceCents: number;
  sortOrder: number;
}

export interface ProductAddonGroupRow {
  productId: number;
  groupId: number;
  sortOrder: number;
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
CREATE TABLE IF NOT EXISTS AddonGroup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  isActive INTEGER NOT NULL DEFAULT 1,
  sortOrder INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS AddonOption (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  groupId INTEGER NOT NULL REFERENCES AddonGroup(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priceCents INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_addon_option_group ON AddonOption(groupId);
CREATE TABLE IF NOT EXISTS ProductAddonGroup (
  productId INTEGER NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  groupId INTEGER NOT NULL REFERENCES AddonGroup(id) ON DELETE CASCADE,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (productId, groupId)
);
CREATE INDEX IF NOT EXISTS idx_product_addon_group_group ON ProductAddonGroup(groupId);
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
  paymentMethod TEXT NOT NULL DEFAULT 'cash',
  confirmedAt INTEGER,
  preparingAt INTEGER,
  deliveredAt INTEGER,
  completedAt INTEGER,
  cancelledAt INTEGER,
  paidAt INTEGER
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
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fullName TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'EMPLOYEE',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cashbox_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txNumber INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'income',
  direction TEXT NOT NULL DEFAULT 'in',
  amountCents INTEGER NOT NULL,
  paymentMethod TEXT NOT NULL DEFAULT 'cash',
  source TEXT NOT NULL DEFAULT 'manual',
  orderId INTEGER,
  sessionId INTEGER,
  userId INTEGER NOT NULL DEFAULT 0,
  userName TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  correctsTxId INTEGER,
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cashbox_created ON cashbox_transactions(createdAt);
CREATE INDEX IF NOT EXISTS idx_cashbox_session ON cashbox_transactions(sessionId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashbox_order_income_active ON cashbox_transactions(orderId)
  WHERE orderId IS NOT NULL AND type = 'income' AND source = 'order' AND status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashbox_corrects ON cashbox_transactions(correctsTxId)
  WHERE correctsTxId IS NOT NULL;
CREATE TABLE IF NOT EXISTS cashbox_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openedAt INTEGER NOT NULL,
  openingBalanceCents INTEGER NOT NULL DEFAULT 0,
  openedById INTEGER NOT NULL DEFAULT 0,
  openedByName TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  closedAt INTEGER,
  closedById INTEGER NOT NULL DEFAULT 0,
  closedByName TEXT NOT NULL DEFAULT '',
  expectedCents INTEGER NOT NULL DEFAULT 0,
  actualCents INTEGER NOT NULL DEFAULT 0,
  diffCents INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  closeReason TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_cashbox_sessions_status ON cashbox_sessions(status);
CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  imageUrl TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'raw',
  quantity REAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'piece',
  minQuantity REAL NOT NULL DEFAULT 0,
  unitCostCents INTEGER NOT NULL DEFAULT 0,
  supplier TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  archived INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_items_type ON stock_items(type);
CREATE INDEX IF NOT EXISTS idx_stock_items_archived ON stock_items(archived);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  itemId INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  quantity REAL NOT NULL,
  prevQuantity REAL NOT NULL,
  newQuantity REAL NOT NULL,
  refType TEXT NOT NULL DEFAULT '',
  refId INTEGER,
  supplier TEXT NOT NULL DEFAULT '',
  invoice TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  userId INTEGER NOT NULL DEFAULT 0,
  userName TEXT NOT NULL DEFAULT '',
  createdAt INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(itemId);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(createdAt);
CREATE INDEX IF NOT EXISTS idx_stock_movements_kind ON stock_movements(kind);
CREATE TABLE IF NOT EXISTS product_ingredients (
  productId INTEGER NOT NULL REFERENCES Product(id) ON DELETE CASCADE,
  itemId INTEGER NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
  qty REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (productId, itemId)
);
CREATE INDEX IF NOT EXISTS idx_product_ingredients_item ON product_ingredients(itemId);
CREATE TABLE IF NOT EXISTS stock_consumption (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId INTEGER NOT NULL,
  orderLineId INTEGER NOT NULL,
  itemId INTEGER NOT NULL,
  qty REAL NOT NULL,
  restored INTEGER NOT NULL DEFAULT 0,
  createdAt INTEGER NOT NULL,
  UNIQUE (orderLineId, itemId)
);
CREATE INDEX IF NOT EXISTS idx_stock_consumption_order ON stock_consumption(orderId);
CREATE INDEX IF NOT EXISTS idx_stock_consumption_item ON stock_consumption(itemId);
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
  ["orders", "paymentMethod", "TEXT NOT NULL DEFAULT 'cash'"],
  ["orders", "confirmedAt", "INTEGER"],
  ["orders", "preparingAt", "INTEGER"],
  ["orders", "deliveredAt", "INTEGER"],
  ["orders", "completedAt", "INTEGER"],
  ["orders", "cancelledAt", "INTEGER"],
  ["orders", "paidAt", "INTEGER"],
  ["cashbox_sessions", "note", "TEXT NOT NULL DEFAULT ''"],
  ["cashbox_sessions", "closeReason", "TEXT NOT NULL DEFAULT ''"],
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
  mkdirSync(dataDir(), { recursive: true });
  const conn = new DatabaseSync(dbPath());
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

export function getDb(): Promise<DbHandle> {
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

export async function listAllProducts(): Promise<ProductRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM Product ORDER BY id").all()) as unknown as ProductRow[];
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

export async function setProductHidden(id: number, isHidden: number): Promise<void> {
  const db = await getDb();
  await db.prepare("UPDATE Product SET isHidden = ? WHERE id = ?").run(isHidden, id);
}

export async function reorderProducts(categoryId: number, ids: number[]): Promise<void> {
  const db = await getDb();
  const unique = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  for (let i = 0; i < unique.length; i++) {
    await db
      .prepare("UPDATE Product SET sortOrder = ? WHERE id = ? AND categoryId = ?")
      .run(i, unique[i], categoryId);
  }
}

export interface AddonGroupWithOptions extends AddonGroupRow {
  options: AddonOptionRow[];
  productCount: number;
}

export async function listAddonGroupsWithOptions(): Promise<AddonGroupWithOptions[]> {
  const db = await getDb();
  const groups = (await db
    .prepare("SELECT * FROM AddonGroup ORDER BY sortOrder, id")
    .all()) as unknown as AddonGroupRow[];
  const options = (await db
    .prepare("SELECT * FROM AddonOption ORDER BY groupId, sortOrder, id")
    .all()) as unknown as AddonOptionRow[];
  const links = (await db
    .prepare("SELECT productId, groupId FROM ProductAddonGroup")
    .all()) as unknown as ProductAddonGroupRow[];
  const byGroup = new Map<number, AddonOptionRow[]>();
  for (const o of options) {
    const list = byGroup.get(o.groupId) ?? [];
    list.push(o);
    byGroup.set(o.groupId, list);
  }
  const counts = new Map<number, number>();
  for (const l of links) counts.set(l.groupId, (counts.get(l.groupId) ?? 0) + 1);
  return groups.map((g) => ({
    ...g,
    options: byGroup.get(g.id) ?? [],
    productCount: counts.get(g.id) ?? 0,
  }));
}

export async function createAddonGroup(name: string): Promise<number> {
  const db = await getDb();
  const n = (await db.prepare("SELECT COUNT(*) AS n FROM AddonGroup").get()) as { n: number };
  const result = await db
    .prepare("INSERT INTO AddonGroup (name, isActive, sortOrder) VALUES (?, 1, ?)")
    .run(String(name).trim(), Number(n.n));
  return Number(result.lastInsertRowid);
}

export async function updateAddonGroup(id: number, name: string, isActive: number): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE AddonGroup SET name = ?, isActive = ? WHERE id = ?")
    .run(String(name).trim(), isActive, id);
}

export async function deleteAddonGroup(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM AddonGroup WHERE id = ?").run(id);
}

export async function addAddonOption(groupId: number, name: string, priceCents: number): Promise<number> {
  const db = await getDb();
  const n = (await db
    .prepare("SELECT COUNT(*) AS n FROM AddonOption WHERE groupId = ?")
    .get(groupId)) as { n: number };
  const result = await db
    .prepare("INSERT INTO AddonOption (groupId, name, priceCents, sortOrder) VALUES (?, ?, ?, ?)")
    .run(groupId, String(name).trim(), priceCents, Number(n.n));
  return Number(result.lastInsertRowid);
}

export async function updateAddonOption(
  id: number,
  name: string,
  priceCents: number,
): Promise<void> {
  const db = await getDb();
  await db
    .prepare("UPDATE AddonOption SET name = ?, priceCents = ? WHERE id = ?")
    .run(String(name).trim(), priceCents, id);
}

export async function deleteAddonOption(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM AddonOption WHERE id = ?").run(id);
}

export async function listProductAddonGroupIds(productId: number): Promise<number[]> {
  const db = await getDb();
  const rows = (await db
    .prepare("SELECT groupId FROM ProductAddonGroup WHERE productId = ? ORDER BY sortOrder, groupId")
    .all(productId)) as unknown as ProductAddonGroupRow[];
  return rows.map((r) => r.groupId);
}

export async function setProductAddonGroups(productId: number, groupIds: number[]): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM ProductAddonGroup WHERE productId = ?").run(productId);
  const unique = [...new Set(groupIds)].filter((id) => Number.isInteger(id) && id > 0);
  for (let i = 0; i < unique.length; i++) {
    await db
      .prepare("INSERT INTO ProductAddonGroup (productId, groupId, sortOrder) VALUES (?, ?, ?)")
      .run(productId, unique[i], i);
  }
}

export interface MenuSnapshotProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: number;
  isHidden: number;
  sortOrder: number;
  ingredients: IngredientRow[];
  addonGroupIds: number[];
}

export interface MenuSnapshotCategory {
  id: number;
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
  isHidden: number;
  sortOrder: number;
  products: MenuSnapshotProduct[];
}

export async function getMenuSnapshot(): Promise<MenuSnapshotCategory[]> {
  const db = await getDb();
  const categories = (await db
    .prepare("SELECT * FROM Category ORDER BY sortOrder, id")
    .all()) as unknown as CategoryRow[];
  const products = (await db
    .prepare("SELECT * FROM Product ORDER BY categoryId, sortOrder, id")
    .all()) as unknown as ProductRow[];
  const ingredients = (await db
    .prepare("SELECT * FROM Ingredient ORDER BY productId, isExtra, sortOrder, id")
    .all()) as unknown as IngredientRow[];
  const links = (await db
    .prepare("SELECT productId, groupId FROM ProductAddonGroup ORDER BY productId, sortOrder")
    .all()) as unknown as ProductAddonGroupRow[];

  const ingByProduct = new Map<number, IngredientRow[]>();
  for (const i of ingredients) {
    const list = ingByProduct.get(i.productId) ?? [];
    list.push(i);
    ingByProduct.set(i.productId, list);
  }
  const groupsByProduct = new Map<number, number[]>();
  for (const l of links) {
    const list = groupsByProduct.get(l.productId) ?? [];
    list.push(l.groupId);
    groupsByProduct.set(l.productId, list);
  }
  const productsByCategory = new Map<number, MenuSnapshotProduct[]>();
  for (const p of products) {
    const list = productsByCategory.get(p.categoryId) ?? [];
    list.push({
      ...p,
      ingredients: ingByProduct.get(p.id) ?? [],
      addonGroupIds: groupsByProduct.get(p.id) ?? [],
    });
    productsByCategory.set(p.categoryId, list);
  }
  return categories.map((c) => ({
    ...c,
    products: productsByCategory.get(c.id) ?? [],
  }));
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
      `INSERT INTO orders (items, totalCents, createdAt, updatedAt, status, priority, customerName, customerPhone, customerAddress, notes, deliveryFeeCents, discountCents, paymentStatus, paymentMethod)
       VALUES (?, ?, ?, ?, 'new', 'normal', ?, ?, ?, ?, ?, ?, 'unpaid', ?)`,
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
      opts.paymentMethod && CASHBOX_METHODS.includes(opts.paymentMethod) ? opts.paymentMethod : "cash",
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

export interface OrderSummaryRow extends OrderRow {
  lastActor: string;
}

export async function listOrders(): Promise<OrderRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM orders ORDER BY id DESC").all()) as unknown as OrderRow[];
}

export async function listOrderSummaries(): Promise<OrderSummaryRow[]> {
  const db = await getDb();
  const rows = (await db
    .prepare(
      `SELECT o.*,
         COALESCE(
           (SELECT a.actor FROM order_activity a WHERE a.orderId = o.id ORDER BY a.id DESC LIMIT 1),
           'system'
         ) AS lastActor
       FROM orders o
       ORDER BY o.id DESC`,
    )
    .all()) as unknown as OrderSummaryRow[];
  return rows;
}

export async function listAllOrderLines(): Promise<OrderLineRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM order_line ORDER BY orderId, id").all()) as unknown as OrderLineRow[];
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
  const wasPaid = order.paymentStatus === "paid";
  const now = Date.now();
  const cols: Record<string, string | number | null> = { status, updatedAt: now };
  if (status === "new") {
    cols.confirmedAt = null;
    cols.preparingAt = null;
    cols.deliveredAt = null;
    cols.completedAt = null;
    cols.cancelledAt = null;
  } else if (status === "preparing") {
    cols.confirmedAt = now;
    cols.preparingAt = now;
    cols.deliveredAt = null;
    cols.completedAt = null;
    cols.cancelledAt = null;
  } else if (status === "delivered") {
    cols.deliveredAt = now;
    cols.completedAt = null;
    cols.cancelledAt = null;
  } else if (status === "completed") {
    cols.completedAt = now;
    cols.cancelledAt = null;
    cols.paymentStatus = "paid";
    cols.paidAt = now;
    cols.paymentMethod = order.paymentMethod || "cash";
  } else if (status === "cancelled") {
    cols.cancelledAt = now;
    cols.cancelReason = opts.reason ?? "";
    cols.paymentStatus = "unpaid";
    cols.paidAt = null;
  }
  if (order.status === "completed" && status !== "completed") {
    cols.paymentStatus = "unpaid";
    cols.paidAt = null;
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
    if (order.paymentStatus !== "paid") {
      await logActivity(db, id, "payment", actor, "تم الدفع تلقائياً عند الإكمال");
    }
  } else if (status === "cancelled") {
    await logActivity(db, id, "cancelled", actor, opts.reason ? `الإلغاء: ${opts.reason}` : "تم إلغاء الطلب");
  }
  if (order.status === "completed" && status !== "completed" && order.paymentStatus === "paid") {
    await logActivity(db, id, "payment", actor, "أُلغي الدفع عند الإرجاع من المكتمل");
  }
  const nowPaid = cols.paymentStatus === "paid";
  if (wasPaid && !nowPaid) {
    await recordOrderIncomeReversal(id, actor);
  } else if (!wasPaid && nowPaid) {
    await recordOrderIncome(id, actor);
  }
  if (status === "completed" && order.status !== "completed") {
    await deductStockForOrder(id, actor);
  } else if (order.status === "completed" && status !== "completed") {
    await restoreStockForOrder(id, actor);
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
  paymentMethod?: string,
): Promise<void> {
  const db = await getDb();
  const order = await getOrderRow(id);
  const wasPaid = order?.paymentStatus === "paid";
  const method = paymentMethod && CASHBOX_METHODS.includes(paymentMethod) ? paymentMethod : order?.paymentMethod || "cash";
  const cols: Record<string, string | number | null> = { paymentStatus, updatedAt: Date.now() };
  cols.paidAt = paymentStatus === "paid" ? Date.now() : null;
  cols.paymentMethod = paymentStatus === "paid" ? method : order?.paymentMethod || "cash";
  await db
    .prepare("UPDATE orders SET paymentStatus = ?, updatedAt = ?, paidAt = ?, paymentMethod = ? WHERE id = ?")
    .run(cols.paymentStatus, cols.updatedAt, cols.paidAt, cols.paymentMethod, id);
  await logActivity(db, id, "payment", actor, paymentStatus === "paid" ? `تم الدفع (${method})` : "غير مدفوع");
  if (wasPaid && paymentStatus !== "paid") {
    await recordOrderIncomeReversal(id, actor);
  } else if (!wasPaid && paymentStatus === "paid") {
    await recordOrderIncome(id, actor);
  }
}

export async function deleteOrder(id: number): Promise<void> {
  const db = await getDb();
  await recordOrderIncomeReversal(id, "system").catch(() => undefined);
  await restoreStockForOrder(id, "system").catch(() => undefined);
  await db.prepare("DELETE FROM order_activity WHERE orderId = ?").run(id);
  await db.prepare("DELETE FROM order_line WHERE orderId = ?").run(id);
  await db.prepare("DELETE FROM orders WHERE id = ?").run(id);
}

async function getOpenSession(db: DbHandle): Promise<CashboxSessionRow | undefined> {
  return plainRow<CashboxSessionRow>(
    await db
      .prepare("SELECT * FROM cashbox_sessions WHERE status = 'open' ORDER BY openedAt DESC LIMIT 1")
      .get(),
  );
}

async function nextTxNumber(db: DbHandle): Promise<number> {
  const row = (await db.prepare("SELECT COALESCE(MAX(txNumber), 0) + 1 AS n FROM cashbox_transactions").get()) as {
    n: number;
  };
  return Number(row.n);
}

export async function getCashboxTransaction(id: number): Promise<CashboxTxRow | undefined> {
  const db = await getDb();
  return plainRow<CashboxTxRow>(
    await db.prepare("SELECT * FROM cashbox_transactions WHERE id = ?").get(id),
  );
}

export async function addCashboxTransaction(input: CashboxTxInput): Promise<CashboxTxRow> {
  const db = await getDb();
  const type = input.type;
  if (!CASHBOX_TX_TYPES.includes(type)) throw new Error("نوع عملية غير صالح");
  const amount = Number(input.amountCents);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new Error("المبلغ يجب أن يكون عدداً صحيحاً أكبر من صفر");
  }
  const direction = input.direction ?? defaultDirection(type);
  if (direction !== "in" && direction !== "out") throw new Error("اتجاه العملية غير صالح");
  const method = input.paymentMethod ?? "cash";
  if (!CASHBOX_METHODS.includes(method)) throw new Error("طريقة دفع غير صالحة");
  const session = await getOpenSession(db);
  const orderId = input.orderId != null ? Number(input.orderId) : null;
  if (orderId != null && (!Number.isInteger(orderId) || orderId < 1)) {
    throw new Error("رقم الطلب غير صالح");
  }
  const actor = input.actor ?? { id: 0, username: "system" };
  const note = String(input.note ?? "").trim().slice(0, 500);
  const txNumber = await nextTxNumber(db);
  const result = await db
    .prepare(
      `INSERT INTO cashbox_transactions
        (txNumber, type, direction, amountCents, paymentMethod, source, orderId, sessionId, userId, userName, note, status, correctsTxId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, ?)`,
    )
    .run(
      txNumber,
      type,
      direction,
      amount,
      method,
      input.source ?? "manual",
      orderId,
      session ? session.id : null,
      actor.id,
      actor.username,
      note,
      Date.now(),
    );
  const row = await getCashboxTransaction(Number(result.lastInsertRowid));
  if (!row) throw new Error("تعذر إنشاء العملية");
  return row;
}

export async function recordOrderIncome(orderId: number, actor = "system"): Promise<boolean> {
  const db = await getDb();
  const order = await getOrderRow(orderId);
  if (!order || order.paymentStatus !== "paid") return false;
  const existing = await db
    .prepare(
      "SELECT id FROM cashbox_transactions WHERE orderId = ? AND type = 'income' AND source = 'order' AND status = 'active' LIMIT 1",
    )
    .get(orderId);
  if (existing) return false;
  const tx = await addCashboxTransaction({
    type: "income",
    amountCents: order.totalCents,
    source: "order",
    orderId,
    paymentMethod: order.paymentMethod || "cash",
    note: `دخل تلقائي من الطلب #${orderId}`,
    actor: { id: 0, username: actor },
  });
  return tx != null;
}

export async function recordOrderIncomeReversal(orderId: number, actor = "system"): Promise<boolean> {
  const db = await getDb();
  const active = plainRow<CashboxTxRow>(
    await db
      .prepare(
        "SELECT * FROM cashbox_transactions WHERE orderId = ? AND type = 'income' AND source = 'order' AND status = 'active' ORDER BY id LIMIT 1",
      )
      .get(orderId),
  );
  if (!active) return false;
  const rev = await addCashboxTransaction({
    type: "adjustment",
    direction: "out",
    amountCents: active.amountCents,
    source: "order",
    orderId,
    note: `استرجاع دخل الطلب #${orderId} (غير مدفوع)`,
    actor: { id: 0, username: actor },
  });
  await db.prepare("UPDATE cashbox_transactions SET correctsTxId = ? WHERE id = ?").run(active.id, rev.id);
  await db.prepare("UPDATE cashbox_transactions SET status = 'reversed' WHERE id = ?").run(active.id);
  return rev != null;
}

async function sumActiveEffects(db: DbHandle, where: string, args: unknown[]): Promise<number> {
  const rows = (await db
    .prepare(
      `SELECT direction, amountCents FROM cashbox_transactions WHERE status = 'active' AND correctsTxId IS NULL AND paymentMethod = 'cash' AND ${where}`,
    )
    .all(...args)) as unknown as CashboxTxRow[];
  return rows.reduce((s, r) => s + txEffectCents(r), 0);
}

export async function currentCashboxBalance(): Promise<number> {
  const db = await getDb();
  const open = await getOpenSession(db);
  if (open) {
    const movement = await sumActiveEffects(
      db,
      "(sessionId = ? OR (sessionId IS NULL AND createdAt >= ?))",
      [open.id, open.openedAt],
    );
    return open.openingBalanceCents + movement;
  }
  const last = plainRow<CashboxSessionRow>(
    await db
      .prepare("SELECT * FROM cashbox_sessions WHERE status = 'closed' ORDER BY closedAt DESC LIMIT 1")
      .get(),
  );
  if (last && last.closedAt != null) {
    const movement = await sumActiveEffects(db, "sessionId IS NULL AND createdAt >= ?", [last.closedAt]);
    return last.actualCents + movement;
  }
  const movement = await sumActiveEffects(db, "sessionId IS NULL", []);
  return movement;
}

export async function getOpenCashboxSession(): Promise<CashboxSessionRow | undefined> {
  const db = await getDb();
  return getOpenSession(db);
}

export async function openCashboxSession(input: {
  openingBalanceCents: number;
  note?: string;
  actor?: CashboxActor;
}): Promise<CashboxSessionRow> {
  const db = await getDb();
  if (await getOpenSession(db)) throw new Error("يوجد صندوق مفتوح بالفعل");
  const opening = Number(input.openingBalanceCents);
  if (!Number.isInteger(opening) || opening < 0) throw new Error("الرصيد الافتتاحي غير صالح");
  const actor = input.actor ?? { id: 0, username: "system" };
  const note = String(input.note ?? "").trim().slice(0, 500);
  const result = await db
    .prepare(
      `INSERT INTO cashbox_sessions (openedAt, openingBalanceCents, openedById, openedByName, status, note)
       VALUES (?, ?, ?, ?, 'open', ?)`,
    )
    .run(Date.now(), opening, actor.id, actor.username, note);
  const row = plainRow<CashboxSessionRow>(
    await db.prepare("SELECT * FROM cashbox_sessions WHERE id = ?").get(Number(result.lastInsertRowid)),
  );
  if (!row) throw new Error("تعذر فتح الصندوق");
  return row;
}

export async function updateCashboxOpening(
  id: number,
  openingBalanceCents: number,
  actor?: CashboxActor,
): Promise<CashboxSessionRow> {
  const db = await getDb();
  const session = plainRow<CashboxSessionRow>(await db.prepare("SELECT * FROM cashbox_sessions WHERE id = ?").get(id));
  if (!session) throw new Error("الجلسة غير موجودة");
  if (session.status !== "open") throw new Error("الصندوق مغلق");
  const opening = Number(openingBalanceCents);
  if (!Number.isInteger(opening) || opening < 0) throw new Error("الرصيد الافتتاحي غير صالح");
  const activity = (await db
    .prepare("SELECT COUNT(*) AS n FROM cashbox_transactions WHERE sessionId = ? OR (sessionId IS NULL AND createdAt >= ?)")
    .get(id, session.openedAt)) as { n: number };
  if (Number(activity.n) > 0 && actor?.role !== "OWNER") {
    throw new Error("لا يمكن تعديل الرصيد الافتتاحي بعد بدء الحركة إلا بصلاحية المالك");
  }
  await db.prepare("UPDATE cashbox_sessions SET openingBalanceCents = ? WHERE id = ?").run(opening, id);
  const updated = plainRow<CashboxSessionRow>(await db.prepare("SELECT * FROM cashbox_sessions WHERE id = ?").get(id));
  if (!updated) throw new Error("تعذر تحديث الرصيد");
  return updated;
}

export async function closeCashboxSession(
  id: number,
  actualCents: number,
  actor?: CashboxActor,
  reason?: string,
): Promise<CashboxSessionRow> {
  const db = await getDb();
  const session = plainRow<CashboxSessionRow>(await db.prepare("SELECT * FROM cashbox_sessions WHERE id = ?").get(id));
  if (!session) throw new Error("الجلسة غير موجودة");
  if (session.status !== "open") throw new Error("الصندوق مغلق بالفعل");
  const actual = Number(actualCents);
  if (!Number.isInteger(actual) || actual < 0) throw new Error("الرصيد الفعلي غير صالح");
  const movement = await sumActiveEffects(
    db,
    "(sessionId = ? OR (sessionId IS NULL AND createdAt >= ?))",
    [id, session.openedAt],
  );
  const expected = session.openingBalanceCents + movement;
  const diff = actual - expected;
  const a = actor ?? { id: 0, username: "system" };
  const why = diff !== 0 ? String(reason ?? "").trim().slice(0, 500) : "";
  await db
    .prepare(
      `UPDATE cashbox_sessions
         SET status = 'closed', closedAt = ?, closedById = ?, closedByName = ?, expectedCents = ?, actualCents = ?, diffCents = ?, closeReason = ?
       WHERE id = ?`,
    )
    .run(Date.now(), a.id, a.username, expected, actual, diff, why, id);
  const updated = plainRow<CashboxSessionRow>(await db.prepare("SELECT * FROM cashbox_sessions WHERE id = ?").get(id));
  if (!updated) throw new Error("تعذر إغلاق الصندوق");
  return updated;
}

export async function listCashboxSessions(): Promise<CashboxSessionRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM cashbox_sessions ORDER BY openedAt DESC").all()) as unknown as CashboxSessionRow[];
}

export async function getCashboxSession(id: number): Promise<CashboxSessionRow | undefined> {
  const db = await getDb();
  return plainRow<CashboxSessionRow>(await db.prepare("SELECT * FROM cashbox_sessions WHERE id = ?").get(id));
}

export async function cashboxSessionDetail(id: number): Promise<CashboxSessionDetail | undefined> {
  const db = await getDb();
  const session = await getCashboxSession(id);
  if (!session) return undefined;
  const rows = (await db
    .prepare("SELECT * FROM cashbox_transactions WHERE sessionId = ? ORDER BY id ASC")
    .all(id)) as unknown as CashboxTxRow[];
  const active = rows.filter((r) => r.status === "active" && r.correctsTxId == null);
  const breakdown = {
    salesCents: 0,
    manualIncomeCents: 0,
    depositCents: 0,
    expenseCents: 0,
    withdrawalCents: 0,
    adjustmentInCents: 0,
    adjustmentOutCents: 0,
  };
  for (const r of active) {
    if (r.type === "income" && r.source === "order") breakdown.salesCents += r.amountCents;
    else if (r.type === "income") breakdown.manualIncomeCents += r.amountCents;
    else if (r.type === "deposit") breakdown.depositCents += r.amountCents;
    else if (r.type === "expense") breakdown.expenseCents += r.amountCents;
    else if (r.type === "withdrawal") breakdown.withdrawalCents += r.amountCents;
    else if (r.direction === "in") breakdown.adjustmentInCents += r.amountCents;
    else breakdown.adjustmentOutCents += r.amountCents;
  }
  return { session, breakdown, rows };
}

export async function correctCashboxTransaction(
  txId: number,
  reason: string,
  actor?: CashboxActor,
): Promise<CashboxTxRow> {
  const db = await getDb();
  const tx = await getCashboxTransaction(txId);
  if (!tx) throw new Error("العملية غير موجودة");
  if (tx.status === "reversed") throw new Error("هذه العملية مصححة بالفعل");
  const why = String(reason ?? "").trim();
  if (!why) throw new Error("سبب التصحيح مطلوب");
  const rev = await addCashboxTransaction({
    type: "adjustment",
    direction: tx.direction === "in" ? "out" : "in",
    amountCents: tx.amountCents,
    source: tx.source === "order" ? "order" : "manual",
    orderId: tx.orderId,
    note: `تصحيح العملية #${tx.txNumber}: ${why}`,
    actor: actor ?? { id: 0, username: "system" },
  });
  await db.prepare("UPDATE cashbox_transactions SET correctsTxId = ? WHERE id = ?").run(txId, rev.id);
  await db.prepare("UPDATE cashbox_transactions SET status = 'reversed' WHERE id = ?").run(txId);
  const updatedRev = plainRow<CashboxTxRow>(await db.prepare("SELECT * FROM cashbox_transactions WHERE id = ?").get(rev.id));
  return updatedRev ?? rev;
}

export async function listCashboxTransactions(
  filters: CashboxListFilters = {},
): Promise<{ rows: CashboxTxRow[]; total: number }> {
  const db = await getDb();
  const where: string[] = [];
  const args: unknown[] = [];
  if (filters.from != null) {
    where.push("createdAt >= ?");
    args.push(filters.from);
  }
  if (filters.to != null) {
    where.push("createdAt <= ?");
    args.push(filters.to);
  }
  if (filters.type && filters.type !== "all") {
    where.push("type = ?");
    args.push(filters.type);
  }
  if (filters.method) {
    where.push("paymentMethod = ?");
    args.push(filters.method);
  }
  if (filters.methodIn && filters.methodIn.length > 0) {
    where.push(`paymentMethod IN (${filters.methodIn.map(() => "?").join(", ")})`);
    args.push(...filters.methodIn);
  }
  if (filters.direction) {
    where.push("direction = ?");
    args.push(filters.direction);
  }
  if (filters.user) {
    where.push("userName = ?");
    args.push(filters.user);
  }
  if (filters.source) {
    where.push("source = ?");
    args.push(filters.source);
  }
  if (filters.orderId != null) {
    where.push("orderId = ?");
    args.push(Number(filters.orderId));
  }
  if (filters.sessionId != null) {
    where.push("sessionId = ?");
    args.push(Number(filters.sessionId));
  }
  if (filters.search) {
    const q = `%${String(filters.search).trim()}%`;
    where.push("(note LIKE ? OR CAST(txNumber AS TEXT) LIKE ? OR CAST(orderId AS TEXT) LIKE ? OR userName LIKE ?)");
    args.push(q, q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number(
    ((await db.prepare(`SELECT COUNT(*) AS n FROM cashbox_transactions ${whereSql}`).get(...args)) as { n: number }).n,
  );
  const limit = Math.min(Math.max(Number(filters.limit ?? 200) || 200, 1), 500);
  const rows = (await db
    .prepare(`SELECT * FROM cashbox_transactions ${whereSql} ORDER BY id DESC LIMIT ?`)
    .all(...args, limit)) as unknown as CashboxTxRow[];
  return { rows, total };
}

function dayKeyLocal(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayStartLocal(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabelLocal(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekdays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  return weekdays[new Date(y, m - 1, d).getDay()];
}

export async function cashboxSummary(from?: number, to?: number): Promise<CashboxSummary> {
  const db = await getDb();
  const open = await getOpenSession(db);
  const currentBalanceCents = await currentCashboxBalance();
  const f = from ?? 0;
  const t = to ?? Number.MAX_SAFE_INTEGER;
  const periodRows = (await db
    .prepare(
      `SELECT * FROM cashbox_transactions WHERE status = 'active' AND correctsTxId IS NULL AND createdAt >= ? AND createdAt <= ? ORDER BY createdAt`,
    )
    .all(f, t)) as unknown as CashboxTxRow[];
  const period: CashboxSummaryPeriod = {
    incomeCents: 0,
    expenseCents: 0,
    depositCents: 0,
    withdrawalCents: 0,
    adjustmentInCents: 0,
    adjustmentOutCents: 0,
    salesCashCents: 0,
    salesElectronicCents: 0,
  };
  const byTypeMap = new Map<CashboxTxType, { count: number; amountCents: number }>();
  const orderSet = new Set<number>();
  let salesCents = 0;
  for (const row of periodRows) {
    const amount = row.amountCents;
    if (row.type === "income") period.incomeCents += amount;
    else if (row.type === "expense") period.expenseCents += amount;
    else if (row.type === "deposit") period.depositCents += amount;
    else if (row.type === "withdrawal") period.withdrawalCents += amount;
    else if (row.direction === "in") period.adjustmentInCents += amount;
    else period.adjustmentOutCents += amount;
    const stat = byTypeMap.get(row.type) ?? { count: 0, amountCents: 0 };
    stat.count += 1;
    stat.amountCents += amount;
    byTypeMap.set(row.type, stat);
    if (row.type === "income" && row.source === "order" && row.orderId != null) {
      salesCents += amount;
      orderSet.add(row.orderId);
      if (row.paymentMethod === "cash") period.salesCashCents += amount;
      else period.salesElectronicCents += amount;
    }
  }
  const byType: CashboxByTypeStat[] = CASHBOX_TX_TYPES.map((type, i) => {
    const s = byTypeMap.get(type) ?? { count: 0, amountCents: 0 };
    return { type: CASHBOX_TX_TYPES[i], count: s.count, amountCents: s.amountCents };
  });
  const byDay: CashboxDayStat[] = [];
  if (t >= f && t - f <= 32 * 86400000) {
    const buckets = new Map<string, CashboxDayStat>();
    for (let start = dayStartLocal(f); start <= t; start += 86400000) {
      const key = dayKeyLocal(start);
      buckets.set(key, { key, label: dayLabelLocal(key), inCents: 0, outCents: 0 });
    }
    for (const row of periodRows) {
      const bucket = buckets.get(dayKeyLocal(row.createdAt));
      if (!bucket) continue;
      if (row.direction === "in") bucket.inCents += row.amountCents;
      else bucket.outCents += row.amountCents;
    }
    byDay.push(...buckets.values());
  }
  return {
    currentBalanceCents,
    openSession: open ?? null,
    period,
    salesCents,
    paidOrders: orderSet.size,
    txCount: periodRows.length,
    byDay,
    byType,
  };
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

// ---------------------------------------------------------------------------
// Stock (المخزون)
// ---------------------------------------------------------------------------

export interface StockItemInput {
  name: string;
  imageUrl?: string;
  type: string;
  unit: string;
  minQuantity?: number;
  unitCostCents?: number;
  supplier?: string;
  note?: string;
}

function validateStockItemInput(input: StockItemInput): void {
  const name = String(input.name ?? "").trim();
  if (!name) throw new Error("اسم الصنف مطلوب");
  if (!STOCK_ITEM_TYPES.includes(input.type as never)) throw new Error("نوع الصنف غير صالح");
  if (!STOCK_UNITS.includes(input.unit as never)) throw new Error("وحدة قياس غير صالحة");
  const min = Number(input.minQuantity ?? 0);
  if (!Number.isFinite(min) || min < 0) throw new Error("الحد الأدنى يجب أن يكون رقماً موجباً");
  const cost = Number(input.unitCostCents ?? 0);
  if (!Number.isFinite(cost) || cost < 0) throw new Error("سعر الوحدة غير صالح");
  if (cost % 1 !== 0) throw new Error("سعر الوحدة يجب أن يكون مبلغاً صحيحاً");
}

async function getStockItemRow(db: DbHandle, id: number): Promise<StockItemRow | undefined> {
  return plainRow<StockItemRow>(await db.prepare("SELECT * FROM stock_items WHERE id = ?").get(id));
}

export async function listStockItems(filters: StockListFilters = {}): Promise<StockItemRow[]> {
  const db = await getDb();
  const where: string[] = [];
  const args: unknown[] = [];
  if (filters.archived != null) {
    where.push("archived = ?");
    args.push(filters.archived);
  } else {
    where.push("archived = 0");
  }
  if (filters.type) {
    where.push("type = ?");
    args.push(filters.type);
  }
  if (filters.search) {
    const q = `%${String(filters.search).trim()}%`;
    where.push("(name LIKE ? OR supplier LIKE ? OR note LIKE ?)");
    args.push(q, q, q);
  }
  return (await db
    .prepare(`SELECT * FROM stock_items ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY name, id`)
    .all(...args)) as unknown as StockItemRow[];
}

export async function getStockItem(id: number): Promise<StockItemRow | undefined> {
  const db = await getDb();
  return getStockItemRow(db, id);
}

export async function createStockItem(input: StockItemInput): Promise<StockItemRow> {
  const db = await getDb();
  validateStockItemInput(input);
  const now = Date.now();
  const result = await db
    .prepare(
      `INSERT INTO stock_items
        (name, imageUrl, type, quantity, unit, minQuantity, unitCostCents, supplier, note, archived, createdAt, updatedAt)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, 0, ?, ?)`,
    )
    .run(
      String(input.name).trim(),
      String(input.imageUrl ?? ""),
      String(input.type),
      String(input.unit),
      roundQty(Number(input.minQuantity ?? 0)),
      Math.round(Number(input.unitCostCents ?? 0)),
      String(input.supplier ?? ""),
      String(input.note ?? ""),
      now,
      now,
    );
  const row = await getStockItemRow(db, Number(result.lastInsertRowid));
  if (!row) throw new Error("تعذر إنشاء الصنف");
  return row;
}

export async function updateStockItem(id: number, input: StockItemInput): Promise<StockItemRow> {
  const db = await getDb();
  validateStockItemInput(input);
  const existing = await getStockItemRow(db, id);
  if (!existing) throw new Error("الصنف غير موجود");
  await db
    .prepare(
      `UPDATE stock_items SET
         name = ?, imageUrl = ?, type = ?, unit = ?, minQuantity = ?, unitCostCents = ?, supplier = ?, note = ?, updatedAt = ?
       WHERE id = ?`,
    )
    .run(
      String(input.name).trim(),
      String(input.imageUrl ?? existing.imageUrl),
      String(input.type),
      String(input.unit),
      roundQty(Number(input.minQuantity ?? 0)),
      Math.round(Number(input.unitCostCents ?? 0)),
      String(input.supplier ?? ""),
      String(input.note ?? ""),
      Date.now(),
      id,
    );
  const row = await getStockItemRow(db, id);
  if (!row) throw new Error("تعذر تحديث الصنف");
  return row;
}

export async function archiveStockItem(id: number): Promise<StockItemRow> {
  const db = await getDb();
  const existing = await getStockItemRow(db, id);
  if (!existing) throw new Error("الصنف غير موجود");
  await db.prepare("UPDATE stock_items SET archived = 1, updatedAt = ? WHERE id = ?").run(Date.now(), id);
  const row = await getStockItemRow(db, id);
  if (!row) throw new Error("تعذر أرشفة الصنف");
  return row;
}

export interface StockMovementInput {
  itemId: number;
  kind: StockMovementKind;
  quantity?: number;
  newQuantity?: number;
  actualQuantity?: number;
  supplier?: string;
  invoice?: string;
  reason?: string;
  note?: string;
  actor?: { id: number; username: string };
}

function requireReason(reason: string | undefined, kind: string): void {
  if (kind === "out" || kind === "adjust" || kind === "count") {
    const r = String(reason ?? "").trim();
    if (!r) throw new Error("السبب إجباري لهذه الحركة");
  }
}

export async function addStockMovement(input: StockMovementInput): Promise<StockMovementRow> {
  const db = await getDb();
  const kind = input.kind;
  if (!STOCK_MOVEMENT_KINDS.slice(0, 4).includes(kind)) throw new Error("نوع حركة غير صالح");
  const item = await getStockItemRow(db, Number(input.itemId));
  if (!item) throw new Error("الصنف غير موجود");
  requireReason(input.reason, kind);

  const prev = roundQty(item.quantity);
  let delta = 0;
  if (kind === "in") {
    const q = Number(input.quantity);
    if (!Number.isFinite(q) || q <= 0) throw new Error("كمية الإدخال يجب أن تكون أكبر من صفر");
    delta = q;
  } else if (kind === "out") {
    const q = Number(input.quantity);
    if (!Number.isFinite(q) || q <= 0) throw new Error("كمية الإخراج يجب أن تكون أكبر من صفر");
    if (q > prev + 1e-9) throw new Error("كمية الإخراج تتجاوز الكمية المتاحة");
    delta = -q;
  } else if (kind === "adjust") {
    const q = Number(input.newQuantity);
    if (!Number.isFinite(q) || q < 0) throw new Error("الكمية الجديدة غير صالحة");
    delta = roundQty(q) - prev;
  } else if (kind === "count") {
    const q = Number(input.actualQuantity);
    if (!Number.isFinite(q) || q < 0) throw new Error("الكمية الفعلية غير صالحة");
    delta = roundQty(q) - prev;
  }
  if (delta === 0) throw new Error("لا يوجد تغيير في الكمية");

  const next = roundQty(prev + delta);
  const actor = input.actor ?? { id: 0, username: "system" };
  const now = Date.now();
  await db
    .prepare("UPDATE stock_items SET quantity = ?, updatedAt = ? WHERE id = ?")
    .run(next, now, item.id);
  const result = await db
    .prepare(
      `INSERT INTO stock_movements
        (itemId, kind, quantity, prevQuantity, newQuantity, refType, refId, supplier, invoice, reason, note, userId, userName, createdAt)
       VALUES (?, ?, ?, ?, ?, '', NULL, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      item.id,
      kind,
      delta,
      prev,
      next,
      String(input.supplier ?? ""),
      String(input.invoice ?? ""),
      String(input.reason ?? ""),
      String(input.note ?? ""),
      actor.id,
      actor.username,
      now,
    );
  const row = await getStockMovementRow(db, Number(result.lastInsertRowid));
  if (!row) throw new Error("تعذر تسجيل الحركة");
  return row;
}

async function getStockMovementRow(db: DbHandle, id: number): Promise<StockMovementRow | undefined> {
  const row = plainRow<StockMovementRow>(
    await db
      .prepare(
        `SELECT m.*, i.name AS itemName FROM stock_movements m
         JOIN stock_items i ON i.id = m.itemId WHERE m.id = ?`,
      )
      .get(id),
  );
  return row;
}

export async function listStockMovements(filters: StockMovementFilters = {}): Promise<{
  rows: StockMovementRow[];
  total: number;
}> {
  const db = await getDb();
  const where: string[] = [];
  const args: unknown[] = [];
  if (filters.from != null) {
    where.push("m.createdAt >= ?");
    args.push(filters.from);
  }
  if (filters.to != null) {
    where.push("m.createdAt <= ?");
    args.push(filters.to);
  }
  if (filters.itemId != null) {
    where.push("m.itemId = ?");
    args.push(Number(filters.itemId));
  }
  if (filters.kind) {
    where.push("m.kind = ?");
    args.push(filters.kind);
  }
  if (filters.user) {
    where.push("m.userName = ?");
    args.push(filters.user);
  }
  if (filters.search) {
    const q = `%${String(filters.search).trim()}%`;
    where.push("(i.name LIKE ? OR m.note LIKE ? OR m.reason LIKE ? OR m.supplier LIKE ? OR m.invoice LIKE ? OR CAST(m.refId AS TEXT) LIKE ?)");
    args.push(q, q, q, q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number(
    ((await db
      .prepare(`SELECT COUNT(*) AS n FROM stock_movements m JOIN stock_items i ON i.id = m.itemId ${whereSql}`)
      .get(...args)) as { n: number }).n,
  );
  const limit = Math.min(Math.max(Number(filters.limit ?? 300) || 300, 1), 1000);
  const rows = (await db
    .prepare(
      `SELECT m.*, i.name AS itemName FROM stock_movements m
       JOIN stock_items i ON i.id = m.itemId ${whereSql} ORDER BY m.id DESC LIMIT ?`,
    )
    .all(...args, limit)) as unknown as StockMovementRow[];
  return { rows, total };
}

export async function getStockSummary(): Promise<StockSummary> {
  const db = await getDb();
  const rows = (await db
    .prepare("SELECT * FROM stock_items WHERE archived = 0")
    .all()) as unknown as StockItemRow[];
  let totalItems = 0;
  let lowItems = 0;
  let outItems = 0;
  let stockValueCents = 0;
  const reorderItems: StockItemRow[] = [];
  for (const r of rows) {
    totalItems += 1;
    stockValueCents += Math.round(r.quantity * r.unitCostCents);
    if (r.quantity <= 0) outItems += 1;
    else if (r.minQuantity > 0 && r.quantity < r.minQuantity) lowItems += 1;
    if (r.quantity <= 0 || (r.minQuantity > 0 && r.quantity < r.minQuantity)) {
      reorderItems.push(r);
    }
  }
  return { totalItems, lowItems, outItems, stockValueCents, reorderItems };
}

export async function listProductIngredients(): Promise<ProductIngredientsView[]> {
  const db = await getDb();
  const products = (await db
    .prepare("SELECT id, name, priceCents, isAvailable, isHidden FROM Product ORDER BY name, id")
    .all()) as unknown as { id: number; name: string; priceCents: number; isAvailable: number; isHidden: number }[];
  const ing = (await db
    .prepare(
      `SELECT pi.productId AS productId, i.id AS itemId, i.name AS name, i.unit AS unit, i.quantity AS quantity, i.minQuantity AS minQuantity, pi.qty AS qty
       FROM product_ingredients pi
       JOIN stock_items i ON i.id = pi.itemId
       WHERE i.archived = 0
       ORDER BY i.name, pi.itemId`,
    )
    .all()) as unknown as ProductIngredientsView["items"][number][] & {
    productId: number;
  }[];
  const byProduct = new Map<number, ProductIngredientsView["items"]>();
  for (const r of ing) {
    const list = byProduct.get(r.productId) ?? [];
    const item = {
      itemId: r.itemId,
      name: r.name,
      unit: r.unit,
      qty: r.qty,
      quantity: r.quantity,
      minQuantity: r.minQuantity,
      status: r.quantity <= 0 ? "out" as const : r.minQuantity > 0 && r.quantity < r.minQuantity ? "low" as const : "available" as const,
    };
    list.push(item);
    byProduct.set(r.productId, list);
  }
  return products.map((p) => {
    const items = byProduct.get(p.id) ?? [];
    const unavailable = items.some((i) => i.status === "out");
    return {
      productId: p.id,
      name: p.name,
      priceCents: p.priceCents,
      isAvailable: p.isAvailable,
      isHidden: p.isHidden,
      hasRecipes: items.length > 0,
      unavailable,
      items,
    };
  });
}

export async function setProductIngredients(
  productId: number,
  rows: { itemId: number; qty: number }[],
): Promise<void> {
  const db = await getDb();
  const product = await db.prepare("SELECT id FROM Product WHERE id = ?").get(productId);
  if (!product) throw new Error("الطبق غير موجود");
  const clean: { itemId: number; qty: number }[] = [];
  for (const r of rows) {
    const itemId = Number(r.itemId);
    const qty = Number(r.qty);
    if (!Number.isInteger(itemId) || itemId < 1) throw new Error("صنف مكوّن غير صالح");
    const item = await getStockItemRow(db, itemId);
    if (!item) throw new Error("صنف المكوّن غير موجود");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("كمية المكوّن يجب أن تكون أكبر من صفر");
    clean.push({ itemId, qty: roundQty(qty) });
  }
  const seen = new Set<number>();
  for (const r of clean) {
    if (seen.has(r.itemId)) throw new Error("لا يمكن تكرار نفس المكوّن");
    seen.add(r.itemId);
  }
  await db.prepare("DELETE FROM product_ingredients WHERE productId = ?").run(productId);
  for (const r of clean) {
    await db
      .prepare("INSERT INTO product_ingredients (productId, itemId, qty) VALUES (?, ?, ?)")
      .run(productId, r.itemId, r.qty);
  }
}

export async function productIngredients(productId: number): Promise<ProductIngredientRow[]> {
  const db = await getDb();
  return (await db
    .prepare("SELECT productId, itemId, qty FROM product_ingredients WHERE productId = ? ORDER BY itemId")
    .all(productId)) as unknown as ProductIngredientRow[];
}

async function getOrderLines(db: DbHandle, orderId: number): Promise<{
  id: number;
  productId: number;
  qty: number;
  items: { itemId: number; qty: number }[];
}[]> {
  const lines = (await db.prepare("SELECT id, productId, qty FROM order_line WHERE orderId = ?").all(orderId)) as unknown as {
    id: number;
    productId: number;
    qty: number;
  }[];
  const out: {
    id: number;
    productId: number;
    qty: number;
    items: { itemId: number; qty: number }[];
  }[] = [];
  for (const line of lines) {
    const rows = (await db
      .prepare("SELECT itemId, qty FROM product_ingredients WHERE productId = ?")
      .all(line.productId)) as unknown as { itemId: number; qty: number }[];
    out.push({ ...line, items: rows });
  }
  return out;
}

export async function deductStockForOrder(orderId: number, actor = "system"): Promise<number> {
  const db = await getDb();
  const order = await getOrderRow(orderId);
  if (!order) return 0;
  const existing = await db
    .prepare("SELECT COUNT(*) AS n FROM stock_consumption WHERE orderId = ? AND restored = 0")
    .get(orderId);
  if (Number((existing as { n: number }).n) > 0) return 0;
  const lines = await getOrderLines(db, orderId);
  const actorObj = { id: 0, username: actor };
  let created = 0;
  for (const line of lines) {
    for (const ing of line.items) {
      const used = roundQty(ing.qty * line.qty);
      const item = await getStockItemRow(db, ing.itemId);
      if (!item) continue;
      const prev = roundQty(item.quantity);
      const next = roundQty(prev - used);
      await db.prepare("UPDATE stock_items SET quantity = ?, updatedAt = ? WHERE id = ?").run(next, Date.now(), item.id);
      await db
        .prepare(
          `INSERT INTO stock_movements
            (itemId, kind, quantity, prevQuantity, newQuantity, refType, refId, supplier, invoice, reason, note, userId, userName, createdAt)
           VALUES (?, 'sale', ?, ?, ?, 'order', ?, '', '', ?, ?, ?, ?, ?)`,
        )
        .run(
          item.id,
          -used,
          prev,
          next,
          orderId,
          `استهلاك تلقائي من الطلب #${orderId}`,
          `طلب #${orderId}: ${line.qty} × ${ing.qty} ${item.unit}`,
          actorObj.id,
          actorObj.username,
          Date.now(),
        );
      await db
        .prepare(
          "INSERT OR IGNORE INTO stock_consumption (orderId, orderLineId, itemId, qty, restored, createdAt) VALUES (?, ?, ?, ?, 0, ?)",
        )
        .run(orderId, line.id, item.id, used, Date.now());
      await db
        .prepare("UPDATE stock_consumption SET restored = 0, qty = ?, createdAt = ? WHERE orderLineId = ? AND itemId = ?")
        .run(used, Date.now(), line.id, item.id);
      created += 1;
    }
  }
  return created;
}

export async function restoreStockForOrder(orderId: number, actor = "system"): Promise<number> {
  const db = await getDb();
  const consumptions = (await db
    .prepare("SELECT * FROM stock_consumption WHERE orderId = ? AND restored = 0")
    .all(orderId)) as unknown as StockConsumptionRow[];
  const actorObj = { id: 0, username: actor };
  let restored = 0;
  for (const c of consumptions) {
    const item = await getStockItemRow(db, c.itemId);
    if (!item) continue;
    const prev = roundQty(item.quantity);
    const next = roundQty(prev + c.qty);
    await db.prepare("UPDATE stock_items SET quantity = ?, updatedAt = ? WHERE id = ?").run(next, Date.now(), item.id);
    await db
      .prepare(
        `INSERT INTO stock_movements
          (itemId, kind, quantity, prevQuantity, newQuantity, refType, refId, supplier, invoice, reason, note, userId, userName, createdAt)
         VALUES (?, 'restore', ?, ?, ?, 'order', ?, '', '', ?, ?, ?, ?, ?)`,
      )
      .run(
        item.id,
        c.qty,
        prev,
        next,
        orderId,
        `استرجاع مخزون الطلب #${orderId}`,
        `طلب #${orderId}`,
        actorObj.id,
        actorObj.username,
        Date.now(),
      );
    await db.prepare("UPDATE stock_consumption SET restored = 1 WHERE id = ?").run(c.id);
    restored += 1;
  }
  return restored;
}
