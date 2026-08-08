import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

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

const globalForDb = globalThis as unknown as { sqlite?: DatabaseSync };

function open(): DatabaseSync {
  mkdirSync(DATA_DIR, { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  const catCols = conn.prepare("PRAGMA table_info(Category)").all() as { name: string }[];
  if (!catCols.some((c) => c.name === "imageUrl")) {
    conn.exec("ALTER TABLE Category ADD COLUMN imageUrl TEXT NOT NULL DEFAULT ''");
  }
  const ingCols = conn.prepare("PRAGMA table_info(Ingredient)").all() as { name: string }[];
  if (!ingCols.some((c) => c.name === "isRequired")) {
    conn.exec("ALTER TABLE Ingredient ADD COLUMN isRequired INTEGER NOT NULL DEFAULT 0");
  }
  return conn;
}

const sqlite = globalForDb.sqlite ?? open();
if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlite = sqlite;
}

function plainRow<T>(r: Record<string, unknown> | undefined): T | undefined {
  return r ? ({ ...r } as T) : undefined;
}

export function listCategories(): CategoryRow[] {
  return sqlite
    .prepare("SELECT * FROM Category ORDER BY sortOrder, id")
    .all()
    .map((r) => ({ ...r })) as unknown as CategoryRow[];
}

export function getCategoryBySlug(slug: string): CategoryRow | undefined {
  return plainRow<CategoryRow>(sqlite.prepare("SELECT * FROM Category WHERE slug = ?").get(slug));
}

export function getCategoryById(id: number): CategoryRow | undefined {
  return plainRow<CategoryRow>(sqlite.prepare("SELECT * FROM Category WHERE id = ?").get(id));
}

export function listProductsByCategory(categoryId: number): ProductRow[] {
  return sqlite
    .prepare("SELECT * FROM Product WHERE categoryId = ? ORDER BY sortOrder, id")
    .all(categoryId)
    .map((r) => ({ ...r })) as unknown as ProductRow[];
}

export function getProductById(id: number): ProductRow | undefined {
  return plainRow<ProductRow>(sqlite.prepare("SELECT * FROM Product WHERE id = ?").get(id));
}

export function createCategory(
  slug: string,
  nameAr: string,
  icon: string,
  imageUrl: string,
  sortOrder: number,
): number {
  const result = sqlite
    .prepare("INSERT INTO Category (slug, nameAr, icon, imageUrl, sortOrder) VALUES (?, ?, ?, ?, ?)")
    .run(slug, nameAr, icon, imageUrl, sortOrder);
  return Number(result.lastInsertRowid);
}

export function updateCategoryImage(id: number, imageUrl: string): void {
  sqlite.prepare("UPDATE Category SET imageUrl = ? WHERE id = ?").run(imageUrl, id);
}

export function createProduct(input: ProductInput): number {
  const result = sqlite
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

export function updateProduct(id: number, input: ProductInput): void {
  sqlite
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

export function deleteProduct(id: number): void {
  sqlite.prepare("DELETE FROM Product WHERE id = ?").run(id);
}

export interface CategoryWithCount extends CategoryRow {
  productCount: number;
}

export function listCategoriesWithCounts(): CategoryWithCount[] {
  return sqlite
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM Product p WHERE p.categoryId = c.id) AS productCount
       FROM Category c ORDER BY c.sortOrder, c.id`,
    )
    .all()
    .map((r) => ({ ...r })) as unknown as CategoryWithCount[];
}

export function countAll(): { categories: number; products: number } {
  const c = sqlite.prepare("SELECT COUNT(*) AS n FROM Category").get() as { n: number };
  const p = sqlite.prepare("SELECT COUNT(*) AS n FROM Product").get() as { n: number };
  return { categories: c.n, products: p.n };
}

export function clearAll(): void {
  sqlite.exec("DELETE FROM orders; DELETE FROM Product; DELETE FROM Category;");
}

export function listIngredientsByProduct(productId: number): IngredientRow[] {
  return sqlite
    .prepare("SELECT * FROM Ingredient WHERE productId = ? ORDER BY isExtra, sortOrder, id")
    .all(productId)
    .map((r) => ({ ...r })) as unknown as IngredientRow[];
}

export function createIngredient(
  productId: number,
  name: string,
  priceCents: number,
  isExtra: number,
  isRequired: number,
): number {
  const n = sqlite
    .prepare("SELECT COUNT(*) AS n FROM Ingredient WHERE productId = ?")
    .get(productId) as { n: number };
  const result = sqlite
    .prepare(
      "INSERT INTO Ingredient (productId, name, priceCents, isExtra, isRequired, sortOrder) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(productId, name, priceCents, isExtra, isRequired, n.n);
  return Number(result.lastInsertRowid);
}

export function updateIngredient(
  id: number,
  name: string,
  priceCents: number,
  isExtra: number,
  isRequired: number,
): void {
  sqlite
    .prepare(
      "UPDATE Ingredient SET name = ?, priceCents = ?, isExtra = ?, isRequired = ? WHERE id = ?",
    )
    .run(name, priceCents, isExtra, isRequired, id);
}

export function deleteIngredient(id: number): void {
  sqlite.prepare("DELETE FROM Ingredient WHERE id = ?").run(id);
}

export function createOrder(items: string, totalCents: number): number {
  const result = sqlite
    .prepare("INSERT INTO orders (items, totalCents, createdAt) VALUES (?, ?, ?)")
    .run(items, totalCents, Date.now());
  return Number(result.lastInsertRowid);
}

export function listOrders(): OrderRow[] {
  return sqlite
    .prepare("SELECT * FROM orders ORDER BY id DESC")
    .all()
    .map((r) => ({ ...r })) as unknown as OrderRow[];
}

export function deleteOrder(id: number): void {
  sqlite.prepare("DELETE FROM orders WHERE id = ?").run(id);
}
