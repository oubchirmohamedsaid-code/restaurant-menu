import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import type { InArgs } from "@libsql/client";
import { logger } from "./logger";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "menu.db");

export interface CategoryRow {
  id: number;
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
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
}

export interface ProductRow {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: number;
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
  createdAt INTEGER NOT NULL
);
`;

type Row = Record<string, unknown>;

interface Statement {
  all(...args: unknown[]): Promise<Row[]>;
  get(...args: unknown[]): Promise<Row | undefined>;
  run(...args: unknown[]): Promise<{ lastInsertRowid: number | bigint }>;
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
        return { lastInsertRowid: rs.lastInsertRowid ?? 0 };
      },
    };
  }
}

async function hasColumn(db: DbHandle, table: string, col: string): Promise<boolean> {
  const rows = await db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === col);
}

async function openLocal(): Promise<DbHandle> {
  const { DatabaseSync } = await import("node:sqlite");
  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  const db = new LocalDb(conn);
  if (!(await hasColumn(db, "Category", "imageUrl"))) {
    await db.exec("ALTER TABLE Category ADD COLUMN imageUrl TEXT NOT NULL DEFAULT ''");
  }
  if (!(await hasColumn(db, "Ingredient", "isRequired"))) {
    await db.exec("ALTER TABLE Ingredient ADD COLUMN isRequired INTEGER NOT NULL DEFAULT 0");
  }
  return db;
}

async function openTurso(): Promise<DbHandle> {
  const url = process.env.TURSO_URL!;
  const token = process.env.TURSO_TOKEN;
  const db = new TursoDb(url, token);
  await db.exec(SCHEMA);
  if (!(await hasColumn(db, "Category", "imageUrl"))) {
    await db.exec("ALTER TABLE Category ADD COLUMN imageUrl TEXT NOT NULL DEFAULT ''");
  }
  if (!(await hasColumn(db, "Ingredient", "isRequired"))) {
    await db.exec("ALTER TABLE Ingredient ADD COLUMN isRequired INTEGER NOT NULL DEFAULT 0");
  }
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

export async function createCategory(
  slug: string,
  nameAr: string,
  icon: string,
  imageUrl: string,
  sortOrder: number,
): Promise<number> {
  const db = await getDb();
  const result = await db
    .prepare("INSERT INTO Category (slug, nameAr, icon, imageUrl, sortOrder) VALUES (?, ?, ?, ?, ?)")
    .run(slug, nameAr, icon, imageUrl, sortOrder);
  return Number(result.lastInsertRowid);
}

export async function updateCategoryImage(id: number, imageUrl: string): Promise<void> {
  const db = await getDb();
  await db.prepare("UPDATE Category SET imageUrl = ? WHERE id = ?").run(imageUrl, id);
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

export async function createOrder(items: string, totalCents: number): Promise<number> {
  const db = await getDb();
  const result = await db
    .prepare("INSERT INTO orders (items, totalCents, createdAt) VALUES (?, ?, ?)")
    .run(items, totalCents, Date.now());
  return Number(result.lastInsertRowid);
}

export async function listOrders(): Promise<OrderRow[]> {
  const db = await getDb();
  return (await db.prepare("SELECT * FROM orders ORDER BY id DESC").all()) as unknown as OrderRow[];
}

export async function deleteOrder(id: number): Promise<void> {
  const db = await getDb();
  await db.prepare("DELETE FROM orders WHERE id = ?").run(id);
}
