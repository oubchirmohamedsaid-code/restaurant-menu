import { clipboard, shell } from "electron";
import {
  countAll,
  getOrder,
  getSetting,
  listAllProducts,
  listOrderSummaries,
  listOrders,
  setOrderPaymentStatus,
  setOrderPriority,
  updateOrderStatus,
  addCashboxTransaction,
  cashboxSummary,
  closeCashboxSession,
  correctCashboxTransaction,
  getOpenCashboxSession,
  listCashboxSessions,
  listCashboxTransactions,
  openCashboxSession,
  updateCashboxOpening,
  cashboxSessionDetail as getCashboxSessionDetail,
  addAddonOption,
  createAddonGroup,
  createCategory,
  createIngredient,
  createProduct,
  deleteAddonGroup,
  deleteAddonOption,
  deleteCategory,
  deleteIngredient,
  deleteProduct,
  getMenuSnapshot,
  getProductById,
  listAddonGroupsWithOptions,
  listCategories,
  listIngredientsByProduct,
  listProductsByCategory,
  reorderCategories,
  reorderProducts,
  setProductAddonGroups,
  setProductHidden,
  updateAddonGroup,
  updateAddonOption,
  updateCategory,
  updateCategoryImage,
  updateIngredient,
  updateProduct,
  addStockMovement,
  archiveStockItem,
  createStockItem,
  getStockItem,
  getStockSummary,
  listProductIngredients,
  listStockItems,
  listStockMovements,
  setProductIngredients,
  updateStockItem,
} from "../../../lib/db";
import type { ProductRow } from "../../../lib/db";
import { CASHBOX_METHODS, CASHBOX_TX_TYPES } from "../../../lib/cashbox";
import type { CashboxDirection, CashboxTxType } from "../../../lib/cashbox";
import {
  DEFAULT_LATE_MINUTES,
  ORDER_STATUSES,
  PRIORITIES,
} from "../../../lib/orders";
import { canManageCashbox, canManageMenu, canManageOrders, canManageStock, roleCanAccess } from "../../../lib/perms";
import type { SectionKey } from "../../../lib/perms";
import { logger } from "../../../lib/logger";
import { deleteStoredImage, saveImageUpload } from "../../../lib/upload";
import {
  countUsers,
  createUser,
  deleteUser,
  getUserById,
  getUserByUsername,
  listUsers,
  toPublic,
  updateUserRole,
  USER_ROLES,
} from "../../../lib/users";
import type { UserRole } from "../../../lib/users";
import type {
  OgtCashboxListInput,
  OgtLoginInput,
  OgtOrderPriority,
  OgtOrderStatus,
  OgtPaymentStatus,
  OgtSetupInput,
  OgtStockItemInput,
  OgtStockListInput,
  OgtStockMovementInput,
  OgtUserCreateInput,
  OgtUserDeleteInput,
  OgtUserRoleInput,
} from "../shared/types";
import { getSession, hashPassword, setSession, verifyPassword } from "./auth";
import type { SessionUser } from "./auth";

export class RpcError extends Error {
  constructor(
    message: string,
    public code: string = "ERROR",
  ) {
    super(message);
  }
}

function requireUser(): SessionUser {
  const user = getSession();
  if (!user) throw new RpcError("غير مصرح — سجل الدخول أولاً", "UNAUTHORIZED");
  return user;
}

function requireOwner(): SessionUser {
  const user = requireUser();
  if (user.role !== "OWNER") throw new RpcError("هذه العملية تتطلب صلاحيات المالك", "FORBIDDEN");
  return user;
}

function requireSection(section: SectionKey): SessionUser {
  const user = requireUser();
  if (!roleCanAccess(user.role, section)) {
    throw new RpcError("لا تملك صلاحية الوصول إلى هذا القسم", "FORBIDDEN");
  }
  return user;
}

const USERNAME_RE = /^[a-zA-Z0-9_.-]{3,32}$/;

function validateCredentials(fullName: string, username: string, password: string): void {
  if (!fullName.trim()) throw new RpcError("الاسم الكامل مطلوب", "VALIDATION");
  if (!USERNAME_RE.test(username)) {
    throw new RpcError("اسم المستخدم يجب أن يكون 3-32 حرفاً (حروف، أرقام، _ . -)", "VALIDATION");
  }
  if (password.length < 8) throw new RpcError("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "VALIDATION");
}

async function ensureUsernameFree(username: string): Promise<void> {
  const existing = await getUserByUsername(username);
  if (existing) throw new RpcError("اسم المستخدم مستخدم بالفعل", "VALIDATION");
}

async function verifyOwnerCredentials(ownerUsername: string | undefined, ownerPassword: string): Promise<number> {
  if (!ownerUsername || !ownerPassword) {
    throw new RpcError("إضافة مستخدم جديد يتطلب تحقق المالك", "UNAUTHORIZED");
  }
  const owner = await getUserByUsername(ownerUsername.trim());
  if (!owner || owner.role !== "OWNER" || !verifyPassword(ownerPassword, owner.passwordHash)) {
    throw new RpcError("بيانات المالك غير صحيحة", "UNAUTHORIZED");
  }
  return owner.id;
}

const AR_TO_EN: Record<string, string> = {
  "المشروبات": "drinks",
  "البيتزا": "pizza",
  "البرجر": "burgers",
  "الحلويات": "desserts",
  "المقبلات": "starters",
  "السلطات": "salads",
  "الشاورما": "shawarma",
  "المأكولات البحرية": "seafood",
  "الأطباق الرئيسية": "mains",
  "المعجنات": "pastries",
  "الإفطار": "breakfast",
  "الغداء": "lunch",
  "العشاء": "dinner",
};

function makeCategorySlug(nameAr: string): string {
  const known = AR_TO_EN[nameAr.trim()];
  if (known) return known;
  return `category-${Date.now().toString(36)}`;
}

function requireMenuManage(user: SessionUser): void {
  if (!canManageMenu(user.role)) {
    throw new RpcError("تعديل المينيو يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
  }
}

function requireStockManage(user: SessionUser): void {
  if (!canManageStock(user.role)) {
    throw new RpcError("إدارة الستوك تتطلب صلاحية المدير أو المالك", "FORBIDDEN");
  }
}

function parsePrice(value: unknown, message: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new RpcError(message, "VALIDATION");
  return Math.round(n);
}

function parseFlag(value: unknown): 0 | 1 {
  return value === 1 || value === "1" || value === true ? 1 : 0;
}

async function resolveExistingProduct(id: number): Promise<ProductRow> {
  const existing = await getProductById(id);
  if (!existing) throw new RpcError("الطبق غير موجود", "NOT_FOUND");
  return existing;
}

async function uploadImageBytes(bytes: unknown, originalName: string): Promise<{ path: string }> {
  const name = String(originalName ?? "").trim();
  const buf =
    bytes instanceof Uint8Array ? bytes : new Uint8Array(Array.from((bytes as ArrayLike<number>) ?? []));
  const result = await saveImageUpload(buf, name || "image.jpg");
  if ("error" in result) throw new RpcError(result.error, "VALIDATION");
  return { path: result.path };
}

export const handlers = {
  async authStatus() {
    const total = await countUsers();
    const user = getSession();
    if (user) return { phase: "ready" as const, user };
    const phase: "setup" | "login" = total === 0 ? "setup" : "login";
    return { phase, user: null };
  },

  async authSetup(input: OgtSetupInput) {
    const total = await countUsers();
    if (total !== 0) throw new RpcError("تم الإعداد الأولي من قبل", "FORBIDDEN");
    const fullName = String(input.fullName ?? "").trim();
    const username = String(input.username ?? "").trim();
    const password = String(input.password ?? "");
    validateCredentials(fullName, username, password);
    await ensureUsernameFree(username);
    const id = await createUser({
      fullName,
      username,
      passwordHash: hashPassword(password),
      role: "OWNER",
    });
    const user = await getUserById(id);
    if (!user) throw new RpcError("تعذر إنشاء الحساب", "ERROR");
    const pub = toPublic(user);
    setSession(pub);
    logger.info("owner created", { username });
    return pub;
  },

  async authLogin(input: OgtLoginInput) {
    const username = String(input.username ?? "").trim();
    const password = String(input.password ?? "");
    const user = await getUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new RpcError("بيانات الدخول غير صحيحة", "UNAUTHORIZED");
    }
    const pub = toPublic(user);
    setSession(pub);
    logger.info("user logged in", { username });
    return pub;
  },

  async authLogout() {
    setSession(null);
    return { ok: true };
  },

  async usersList() {
    requireOwner();
    const users = await listUsers();
    return users.map(toPublic);
  },

  async usersCreate(input: OgtUserCreateInput) {
    const session = getSession();
    let ownerId: number;
    if (session && session.role === "OWNER") {
      const me = await getUserById(session.id);
      if (!me || !verifyPassword(String(input.ownerPassword ?? ""), me.passwordHash)) {
        throw new RpcError("كلمة مرور المالك غير صحيحة", "UNAUTHORIZED");
      }
      ownerId = me.id;
    } else {
      ownerId = await verifyOwnerCredentials(input.ownerUsername, String(input.ownerPassword ?? ""));
    }

    const fullName = String(input.fullName ?? "").trim();
    const username = String(input.username ?? "").trim();
    const password = String(input.password ?? "");
    const role = String(input.role ?? "") as UserRole;
    if (!USER_ROLES.includes(role)) throw new RpcError("الدور غير صالح", "VALIDATION");
    validateCredentials(fullName, username, password);
    await ensureUsernameFree(username);

    const id = await createUser({
      fullName,
      username,
      passwordHash: hashPassword(password),
      role,
    });
    const user = await getUserById(id);
    if (!user) throw new RpcError("تعذر إنشاء المستخدم", "ERROR");
    logger.info("user created", { ownerId, username, role });
    return toPublic(user);
  },

  async usersUpdateRole(input: OgtUserRoleInput) {
    const owner = requireOwner();
    const target = await getUserById(Number(input.id));
    if (!target) throw new RpcError("المستخدم غير موجود", "NOT_FOUND");
    if (target.id === owner.id) throw new RpcError("لا يمكن تغيير دور حسابك الحالي", "FORBIDDEN");
    const role = String(input.role ?? "") as UserRole;
    if (!USER_ROLES.includes(role)) throw new RpcError("الدور غير صالح", "VALIDATION");
    const me = await getUserById(owner.id);
    if (!me || !verifyPassword(String(input.password ?? ""), me.passwordHash)) {
      throw new RpcError("كلمة مرور المالك غير صحيحة", "UNAUTHORIZED");
    }
    if (target.role === "OWNER" && role !== "OWNER") {
      const owners = (await listUsers()).filter((u) => u.role === "OWNER");
      if (owners.length <= 1) throw new RpcError("لا يمكن إزالة المالك الأخير", "FORBIDDEN");
    }
    await updateUserRole(target.id, role);
    logger.info("user role updated", { id: target.id, role, by: owner.username });
    return toPublic({ ...target, role });
  },

  async usersDelete(input: OgtUserDeleteInput) {
    const owner = requireOwner();
    const target = await getUserById(Number(input.id));
    if (!target) throw new RpcError("المستخدم غير موجود", "NOT_FOUND");
    if (target.id === owner.id) throw new RpcError("لا يمكن حذف حسابك الحالي", "FORBIDDEN");
    if (target.role === "OWNER") {
      const owners = (await listUsers()).filter((u) => u.role === "OWNER");
      if (owners.length <= 1) throw new RpcError("لا يمكن حذف المالك الأخير", "FORBIDDEN");
    }
    const me = await getUserById(owner.id);
    if (!me || !verifyPassword(String(input.password ?? ""), me.passwordHash)) {
      throw new RpcError("كلمة مرور المالك غير صحيحة", "UNAUTHORIZED");
    }
    await deleteUser(target.id);
    logger.info("user deleted", { id: target.id, by: owner.username });
    return { ok: true };
  },

  async dashboardOverview() {
    const user = requireUser();
    const isStaff = user.role === "EMPLOYEE";
    const orders = await listOrders();
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dayStart = now.getTime();
    const today = orders.filter((o) => o.createdAt >= dayStart);
    const revenueToday = isStaff
      ? null
      : today.filter((o) => o.status !== "cancelled").reduce((sum, o) => sum + o.totalCents, 0);
    const products = isStaff ? null : (await countAll()).products;
    return {
      todayOrders: today.length,
      todayNew: today.filter((o) => o.status === "new").length,
      preparing: orders.filter((o) => o.status === "preparing").length,
      totalOrders: orders.length,
      revenueToday,
      products,
    };
  },

  async ordersList() {
    requireSection("orders");
    return listOrderSummaries();
  },

  async ordersDetail(id: number) {
    requireSection("orders");
    const detail = await getOrder(Number(id));
    if (!detail) throw new RpcError("الطلب غير موجود", "NOT_FOUND");
    return detail;
  },

  async ordersUpdateStatus(
    id: number,
    status: OgtOrderStatus,
    opts: { reason?: string } = {},
  ) {
    const user = requireSection("orders");
    if (!ORDER_STATUSES.includes(status)) throw new RpcError("حالة غير صالحة", "VALIDATION");
    if (status === "cancelled" && !canManageOrders(user.role)) {
      throw new RpcError("إلغاء الطلب يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    const detail = await getOrder(Number(id));
    if (!detail) throw new RpcError("الطلب غير موجود", "NOT_FOUND");
    if (!canManageOrders(user.role)) {
      const from = ORDER_STATUSES.indexOf(detail.order.status);
      const to = ORDER_STATUSES.indexOf(status);
      if (to < from) {
        throw new RpcError("لا يمكنك الرجوع بالطلب إلى مرحلة سابقة", "FORBIDDEN");
      }
    }
    await updateOrderStatus(Number(id), status, { actor: user.username, reason: opts.reason });
    logger.info("order status updated", { id, status, by: user.username });
    return { ok: true };
  },

  async ordersSetPriority(id: number, priority: OgtOrderPriority) {
    const user = requireSection("orders");
    if (!canManageOrders(user.role)) {
      throw new RpcError("تغيير الأولوية يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    if (!PRIORITIES.includes(priority)) throw new RpcError("أولوية غير صالحة", "VALIDATION");
    await setOrderPriority(Number(id), priority, user.username);
    logger.info("order priority set", { id, priority, by: user.username });
    return { ok: true };
  },

  async ordersSetPayment(id: number, payment: OgtPaymentStatus, method?: string) {
    const user = requireSection("orders");
    if (!canManageOrders(user.role)) {
      throw new RpcError("تغيير حالة الدفع يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    if (payment !== "paid" && payment !== "unpaid") {
      throw new RpcError("حالة دفع غير صالحة", "VALIDATION");
    }
    let paymentMethod: string | undefined;
    if (method != null) {
      paymentMethod = String(method);
      if (!CASHBOX_METHODS.includes(paymentMethod)) {
        throw new RpcError("طريقة دفع غير صالحة", "VALIDATION");
      }
    }
    await setOrderPaymentStatus(Number(id), payment, user.username, paymentMethod);
    logger.info("order payment set", { id, payment, method: paymentMethod, by: user.username });
    return { ok: true };
  },

  async ordersThresholds() {
    requireSection("orders");
    const [n, p, d] = await Promise.all([
      getSetting("late_new_minutes"),
      getSetting("late_preparing_minutes"),
      getSetting("late_delivered_minutes"),
    ]);
    return {
      new: Number.parseInt(n ?? "", 10) || DEFAULT_LATE_MINUTES.new,
      preparing: Number.parseInt(p ?? "", 10) || DEFAULT_LATE_MINUTES.preparing,
      delivered: Number.parseInt(d ?? "", 10) || DEFAULT_LATE_MINUTES.delivered,
    };
  },

  async productsList() {
    requireSection("orders");
    const products = await listAllProducts();
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      imageUrl: p.imageUrl,
    }));
  },

  async appOpenExternal(url: string) {
    requireUser();
    const safe = String(url ?? "").trim();
    if (!safe) throw new RpcError("رابط فارغ", "VALIDATION");
    let parsed: URL;
    try {
      parsed = new URL(safe);
    } catch {
      throw new RpcError("رابط غير صالح", "VALIDATION");
    }
    if (!["http:", "https:", "tel:", "mailto:"].includes(parsed.protocol)) {
      throw new RpcError("نوع الرابط غير مسموح", "FORBIDDEN");
    }
    await shell.openExternal(safe);
    return { ok: true };
  },

  async appCopyText(text: string) {
    requireUser();
    clipboard.writeText(String(text ?? ""));
    return { ok: true };
  },

  async cashboxSummary(input: { from?: number; to?: number } = {}) {
    requireSection("cashbox");
    const from = input.from != null ? Number(input.from) : undefined;
    const to = input.to != null ? Number(input.to) : undefined;
    return cashboxSummary(from, to);
  },

  async cashboxList(input: OgtCashboxListInput = {}) {
    requireSection("cashbox");
    return listCashboxTransactions({
      from: input.from != null ? Number(input.from) : undefined,
      to: input.to != null ? Number(input.to) : undefined,
      type: input.type,
      method: input.method,
      user: input.user,
      source: input.source,
      orderId: input.orderId != null ? Number(input.orderId) : undefined,
      search: input.search,
      limit: input.limit,
    });
  },

  async cashboxAdd(input: {
    type: string;
    direction?: string;
    amountCents: number;
    paymentMethod?: string;
    note?: string;
    orderId?: number;
  }) {
    const user = requireSection("cashbox");
    const type = String(input.type ?? "") as CashboxTxType;
    if (!CASHBOX_TX_TYPES.includes(type)) throw new RpcError("نوع عملية غير صالح", "VALIDATION");
    const direction = input.direction != null ? (String(input.direction) as CashboxDirection) : undefined;
    if (direction !== undefined && direction !== "in" && direction !== "out") {
      throw new RpcError("اتجاه العملية غير صالح", "VALIDATION");
    }
    const amount = Number(input.amountCents);
    if (!Number.isInteger(amount) || amount < 1) {
      throw new RpcError("المبلغ يجب أن يكون عدداً صحيحاً أكبر من صفر", "VALIDATION");
    }
    const method = String(input.paymentMethod ?? "cash");
    if (!CASHBOX_METHODS.includes(method)) throw new RpcError("طريقة دفع غير صالحة", "VALIDATION");
    const orderId = input.orderId != null ? Number(input.orderId) : undefined;
    if (orderId != null && (!Number.isInteger(orderId) || orderId < 1)) {
      throw new RpcError("رقم الطلب غير صالح", "VALIDATION");
    }
    return addCashboxTransaction({
      type,
      direction,
      amountCents: amount,
      paymentMethod: method,
      orderId,
      note: input.note,
      actor: { id: user.id, username: user.username },
    });
  },

  async cashboxOpenSession(input: { openingBalanceCents: number; note?: string }) {
    const user = requireSection("cashbox");
    if (!canManageCashbox(user.role)) {
      throw new RpcError("فتح الصندوق يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    return openCashboxSession({
      openingBalanceCents: Number(input.openingBalanceCents),
      note: input.note,
      actor: { id: user.id, username: user.username },
    });
  },

  async cashboxUpdateOpening(input: { sessionId: number; openingBalanceCents: number }) {
    const user = requireSection("cashbox");
    if (!canManageCashbox(user.role)) {
      throw new RpcError("تعديل الرصيد الافتتاحي يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    return updateCashboxOpening(Number(input.sessionId), Number(input.openingBalanceCents), {
      id: user.id,
      username: user.username,
      role: user.role,
    });
  },

  async cashboxCloseSession(input: { sessionId: number; actualCents: number; reason?: string }) {
    const user = requireSection("cashbox");
    if (!canManageCashbox(user.role)) {
      throw new RpcError("إغلاق الصندوق يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    return closeCashboxSession(Number(input.sessionId), Number(input.actualCents), {
      id: user.id,
      username: user.username,
    }, input.reason);
  },

  async cashboxSessions() {
    requireSection("cashbox");
    return listCashboxSessions();
  },

  async cashboxSessionDetail(sessionId: number) {
    requireSection("cashbox");
    const detail = await getCashboxSessionDetail(Number(sessionId));
    if (!detail) throw new RpcError("الجلسة غير موجودة", "NOT_FOUND");
    return detail;
  },

  async cashboxByOrder(orderId: number) {
    requireSection("cashbox");
    const order = Number(orderId);
    const res = await listCashboxTransactions({ orderId: order, limit: 100 });
    const open = await getOpenCashboxSession();
    return { tx: res.rows, openSession: open ?? null };
  },

  async cashboxCorrect(input: { txId: number; reason: string }) {
    const user = requireSection("cashbox");
    if (!canManageCashbox(user.role)) {
      throw new RpcError("تصحيح العملية يتطلب صلاحية المدير أو المالك", "FORBIDDEN");
    }
    return correctCashboxTransaction(Number(input.txId), String(input.reason ?? ""), {
      id: user.id,
      username: user.username,
    });
  },

  async stockList(input: OgtStockListInput) {
    requireSection("stock");
    const rows = await listStockItems({
      type: (input?.type as never) || "",
      search: input?.search,
      archived: input?.archived,
    });
    return rows.map((r) => ({
      ...r,
      status:
        r.quantity <= 0 ? "out" : r.minQuantity > 0 && r.quantity < r.minQuantity ? "low" : "available",
      valueCents: Math.round(r.quantity * r.unitCostCents),
    }));
  },

  async stockGet(input: { id: number }) {
    requireSection("stock");
    const row = await getStockItem(Number(input?.id));
    if (!row) throw new RpcError("الصنف غير موجود", "NOT_FOUND");
    return row;
  },

  async stockCreate(input: OgtStockItemInput) {
    const user = requireSection("stock");
    requireStockManage(user);
    const row = await createStockItem({
      name: input?.name,
      imageUrl: input?.imageUrl,
      type: input?.type,
      unit: input?.unit,
      minQuantity: input?.minQuantity,
      unitCostCents: input?.unitCostCents,
      supplier: input?.supplier,
      note: input?.note,
    });
    logger.info("stock item created", { id: row.id, by: user.username });
    return row;
  },

  async stockUpdate(input: OgtStockItemInput & { id: number }) {
    const user = requireSection("stock");
    requireStockManage(user);
    const id = Number(input?.id);
    if (!Number.isInteger(id) || id < 1) throw new RpcError("معرّف الصنف غير صالح", "VALIDATION");
    const row = await updateStockItem(id, {
      name: input?.name,
      imageUrl: input?.imageUrl,
      type: input?.type,
      unit: input?.unit,
      minQuantity: input?.minQuantity,
      unitCostCents: input?.unitCostCents,
      supplier: input?.supplier,
      note: input?.note,
    });
    logger.info("stock item updated", { id, by: user.username });
    return row;
  },

  async stockArchive(input: { id: number }) {
    const user = requireSection("stock");
    requireStockManage(user);
    const id = Number(input?.id);
    if (!Number.isInteger(id) || id < 1) throw new RpcError("معرّف الصنف غير صالح", "VALIDATION");
    const row = await archiveStockItem(id);
    logger.info("stock item archived", { id, by: user.username });
    return row;
  },

  async stockMove(input: OgtStockMovementInput) {
    const user = requireSection("stock");
    const kind = String(input?.kind ?? "");
    if (kind === "adjust" || kind === "count") requireStockManage(user);
    const row = await addStockMovement({
      itemId: Number(input?.itemId),
      kind: kind as never,
      quantity: input?.quantity,
      newQuantity: input?.newQuantity,
      actualQuantity: input?.actualQuantity,
      supplier: input?.supplier,
      invoice: input?.invoice,
      reason: input?.reason,
      note: input?.note,
      actor: { id: user.id, username: user.username },
    });
    logger.info("stock movement recorded", { id: row.id, kind, itemId: row.itemId, by: user.username });
    return row;
  },

  async stockMovements(input: {
    from?: number;
    to?: number;
    itemId?: number;
    kind?: string;
    user?: string;
    search?: string;
    limit?: number;
  }) {
    requireSection("stock");
    return listStockMovements({
      from: input?.from,
      to: input?.to,
      itemId: input?.itemId,
      kind: (input?.kind as never) || "",
      user: input?.user,
      search: input?.search,
      limit: input?.limit,
    });
  },

  async stockSummary() {
    requireSection("stock");
    const sum = await getStockSummary();
    return {
      ...sum,
      reorderItems: sum.reorderItems.map((r) => ({
        ...r,
        status: r.quantity <= 0 ? "out" : "low",
        valueCents: Math.round(r.quantity * r.unitCostCents),
      })),
    };
  },

  async stockIngredients() {
    requireSection("stock");
    return listProductIngredients();
  },

  async stockSetIngredients(input: { productId: number; items: { itemId: number; qty: number }[] }) {
    const user = requireSection("stock");
    requireStockManage(user);
    const productId = Number(input?.productId);
    if (!Number.isInteger(productId) || productId < 1) {
      throw new RpcError("معرّف الطبق غير صالح", "VALIDATION");
    }
    await setProductIngredients(productId, Array.isArray(input?.items) ? input.items : []);
    logger.info("product ingredients updated", { productId, by: user.username });
    return { ok: true };
  },

  async menuSnapshot() {
    requireSection("menu");
    return getMenuSnapshot();
  },

  async menuAddonGroups() {
    requireSection("menu");
    return listAddonGroupsWithOptions();
  },

  async menuCreateCategory(input: { nameAr: string; icon: string }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const nameAr = String(input.nameAr ?? "").trim();
    if (!nameAr) throw new RpcError("اسم الصنف مطلوب", "VALIDATION");
    const icon = String(input.icon ?? "").trim() || "🍽️";
    const categories = await listCategories();
    const sortOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sortOrder)) + 1 : 0;
    const id = await createCategory({ slug: makeCategorySlug(nameAr), nameAr, icon, imageUrl: "", sortOrder });
    logger.info("menu category created", { id, nameAr, by: user.username });
    return id;
  },

  async menuUpdateCategory(input: { id: number; nameAr: string; isHidden: 0 | 1 }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const nameAr = String(input.nameAr ?? "").trim();
    if (!nameAr) throw new RpcError("اسم الصنف مطلوب", "VALIDATION");
    await updateCategory(Number(input.id), { nameAr, isHidden: parseFlag(input.isHidden) });
    logger.info("menu category updated", { id: input.id, nameAr, by: user.username });
    return { ok: true };
  },

  async menuUpdateCategoryImage(input: { id: number; imageUrl: string }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const id = Number(input.id);
    const categories = await listCategories();
    const existing = categories.find((c) => c.id === id);
    if (!existing) throw new RpcError("الصنف غير موجود", "NOT_FOUND");
    const imageUrl = String(input.imageUrl ?? "").trim();
    if (!imageUrl) throw new RpcError("رابط الصورة مطلوب", "VALIDATION");
    await updateCategoryImage(id, imageUrl);
    if (existing.imageUrl && existing.imageUrl !== imageUrl) await deleteStoredImage(existing.imageUrl);
    logger.info("menu category image updated", { id, by: user.username });
    return { ok: true };
  },

  async menuDeleteCategory(input: { id: number }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const id = Number(input.id);
    const categories = await listCategories();
    const existing = categories.find((c) => c.id === id);
    if (!existing) throw new RpcError("الصنف غير موجود", "NOT_FOUND");
    const products = await listProductsByCategory(id);
    await deleteCategory(id);
    for (const p of products) if (p.imageUrl) await deleteStoredImage(p.imageUrl);
    if (existing.imageUrl) await deleteStoredImage(existing.imageUrl);
    logger.info("menu category deleted", { id, products: products.length, by: user.username });
    return { ok: true };
  },

  async menuReorderCategories(ids: number[]) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await reorderCategories((ids ?? []).map(Number));
    logger.info("menu categories reordered", { count: (ids ?? []).length, by: user.username });
    return { ok: true };
  },

  async menuCreateProduct(input: {
    categoryId: number;
    name: string;
    description: string;
    priceCents: number;
    imageUrl: string;
    isAvailable: 0 | 1;
  }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const name = String(input.name ?? "").trim();
    if (!name) throw new RpcError("اسم الطبق مطلوب", "VALIDATION");
    const priceCents = parsePrice(input.priceCents, "السعر غير صالح");
    const categoryId = Number(input.categoryId);
    const categories = await listCategories();
    if (!categories.some((c) => c.id === categoryId)) throw new RpcError("الصنف غير موجود", "VALIDATION");
    const id = await createProduct({
      categoryId,
      name,
      description: String(input.description ?? "").trim(),
      priceCents,
      imageUrl: String(input.imageUrl ?? "").trim(),
      isAvailable: parseFlag(input.isAvailable),
    });
    logger.info("menu product created", { id, categoryId, name, by: user.username });
    return id;
  },

  async menuUpdateProduct(input: {
    id: number;
    categoryId: number;
    name: string;
    description: string;
    priceCents: number;
    imageUrl?: string;
    isAvailable: 0 | 1;
  }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const existing = await resolveExistingProduct(Number(input.id));
    const name = String(input.name ?? "").trim();
    if (!name) throw new RpcError("اسم الطبق مطلوب", "VALIDATION");
    const priceCents = parsePrice(input.priceCents, "السعر غير صالح");
    const imageUrl = input.imageUrl != null && String(input.imageUrl).trim() !== "" ? String(input.imageUrl).trim() : existing.imageUrl;
    await updateProduct(existing.id, {
      categoryId: Number(input.categoryId),
      name,
      description: String(input.description ?? "").trim(),
      priceCents,
      imageUrl,
      isAvailable: parseFlag(input.isAvailable),
    });
    if (imageUrl !== existing.imageUrl) await deleteStoredImage(existing.imageUrl);
    logger.info("menu product updated", { id: existing.id, name, by: user.username });
    return { ok: true };
  },

  async menuDeleteProduct(input: { id: number }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const existing = await resolveExistingProduct(Number(input.id));
    await deleteProduct(existing.id);
    if (existing.imageUrl) await deleteStoredImage(existing.imageUrl);
    logger.info("menu product deleted", { id: existing.id, by: user.username });
    return { ok: true };
  },

  async menuSetProductAvailability(input: { id: number; isAvailable: 0 | 1 }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const existing = await resolveExistingProduct(Number(input.id));
    await updateProduct(existing.id, {
      categoryId: existing.categoryId,
      name: existing.name,
      description: existing.description,
      priceCents: existing.priceCents,
      imageUrl: existing.imageUrl,
      isAvailable: parseFlag(input.isAvailable),
    });
    logger.info("menu product availability set", { id: existing.id, isAvailable: input.isAvailable, by: user.username });
    return { ok: true };
  },

  async menuSetProductHidden(input: { id: number; isHidden: 0 | 1 }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const existing = await resolveExistingProduct(Number(input.id));
    await setProductHidden(existing.id, parseFlag(input.isHidden));
    logger.info("menu product hidden set", { id: existing.id, isHidden: input.isHidden, by: user.username });
    return { ok: true };
  },

  async menuReorderProducts(input: { categoryId: number; ids: number[] }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await reorderProducts(Number(input.categoryId), (input.ids ?? []).map(Number));
    logger.info("menu products reordered", { categoryId: input.categoryId, count: (input.ids ?? []).length, by: user.username });
    return { ok: true };
  },

  async menuSaveIngredient(input: {
    id?: number;
    productId: number;
    name: string;
    priceCents: number;
    isExtra: 0 | 1;
    isRequired: 0 | 1;
  }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const name = String(input.name ?? "").trim();
    if (!name) throw new RpcError("اسم المكوّن مطلوب", "VALIDATION");
    const priceCents = parsePrice(input.priceCents, "سعر المكوّن غير صالح");
    const isExtra = parseFlag(input.isExtra);
    const isRequired = isExtra === 1 ? parseFlag(input.isRequired) : 0;
    if (input.id != null) {
      await updateIngredient(Number(input.id), name, priceCents, isExtra, isRequired);
    } else {
      await createIngredient(Number(input.productId), name, priceCents, isExtra, isRequired);
    }
    logger.info("menu ingredient saved", { id: input.id, productId: input.productId, name, by: user.username });
    return { ok: true };
  },

  async menuDeleteIngredient(input: { id: number }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await deleteIngredient(Number(input.id));
    logger.info("menu ingredient deleted", { id: input.id, by: user.username });
    return { ok: true };
  },

  async menuCreateAddonGroup(input: { name: string }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const name = String(input.name ?? "").trim();
    if (!name) throw new RpcError("اسم المجموعة مطلوب", "VALIDATION");
    const id = await createAddonGroup(name);
    logger.info("menu addon group created", { id, name, by: user.username });
    return id;
  },

  async menuUpdateAddonGroup(input: { id: number; name: string; isActive: 0 | 1 }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const name = String(input.name ?? "").trim();
    if (!name) throw new RpcError("اسم المجموعة مطلوب", "VALIDATION");
    await updateAddonGroup(Number(input.id), name, parseFlag(input.isActive));
    logger.info("menu addon group updated", { id: input.id, name, by: user.username });
    return { ok: true };
  },

  async menuDeleteAddonGroup(input: { id: number }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await deleteAddonGroup(Number(input.id));
    logger.info("menu addon group deleted", { id: input.id, by: user.username });
    return { ok: true };
  },

  async menuSaveAddonOption(input: { id?: number; groupId: number; name: string; priceCents: number }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    const name = String(input.name ?? "").trim();
    if (!name) throw new RpcError("اسم الخيار مطلوب", "VALIDATION");
    const priceCents = parsePrice(input.priceCents, "سعر الخيار غير صالح");
    if (input.id != null) {
      await updateAddonOption(Number(input.id), name, priceCents);
    } else {
      await addAddonOption(Number(input.groupId), name, priceCents);
    }
    logger.info("menu addon option saved", { id: input.id, groupId: input.groupId, name, by: user.username });
    return { ok: true };
  },

  async menuDeleteAddonOption(input: { id: number }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await deleteAddonOption(Number(input.id));
    logger.info("menu addon option deleted", { id: input.id, by: user.username });
    return { ok: true };
  },

  async menuSetProductAddonGroups(input: { productId: number; groupIds: number[] }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await setProductAddonGroups(Number(input.productId), (input.groupIds ?? []).map(Number));
    logger.info("menu product addon groups set", { productId: input.productId, by: user.username });
    return { ok: true };
  },

  async menuUploadImage(input: { bytes: Uint8Array; originalName: string }) {
    requireSection("menu");
    return uploadImageBytes(input.bytes, input.originalName);
  },

  async menuDeleteImage(input: { url: string }) {
    const user = requireSection("menu");
    requireMenuManage(user);
    await deleteStoredImage(String(input.url ?? ""));
    logger.info("menu image deleted", { url: input.url, by: user.username });
    return { ok: true };
  },
};
