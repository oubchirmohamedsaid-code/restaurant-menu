export type Role = "OWNER" | "ADMIN" | "EMPLOYEE";

export interface OgtUser {
  id: number;
  fullName: string;
  username: string;
  role: Role;
  createdAt: number;
}

export type OgtPhase = "setup" | "login" | "ready";

export interface OgtAuthStatus {
  phase: OgtPhase;
  user: OgtUser | null;
}

export interface OgtSetupInput {
  fullName: string;
  username: string;
  password: string;
}

export interface OgtLoginInput {
  username: string;
  password: string;
}

export interface OgtUserCreateInput {
  ownerUsername?: string;
  ownerPassword: string;
  fullName: string;
  username: string;
  password: string;
  role: Role;
}

export interface OgtUserRoleInput {
  id: number;
  role: Role;
  password: string;
}

export interface OgtUserDeleteInput {
  id: number;
  password: string;
}

export type OgtOrderStatus = "new" | "preparing" | "delivered" | "completed" | "cancelled";

export type OgtOrderPriority = "normal" | "important" | "urgent";

export type OgtPaymentStatus = "unpaid" | "paid";

export type OgtStageStatus = "new" | "preparing" | "delivered";

export interface OgtLateThresholds {
  new: number;
  preparing: number;
  delivered: number;
}

export interface OgtOrder {
  id: number;
  items: string;
  totalCents: number;
  createdAt: number;
  updatedAt: number;
  status: OgtOrderStatus;
  priority: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  notes: string;
  cancelReason: string;
  deliveryFeeCents: number;
  discountCents: number;
  paymentStatus: string;
  paymentMethod: string;
  confirmedAt: number | null;
  preparingAt: number | null;
  deliveredAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  paidAt: number | null;
}

export interface OgtOrderSummary extends OgtOrder {
  lastActor: string;
}

export interface OgtProduct {
  id: number;
  name: string;
  imageUrl: string;
}

export type OgtFlag = 0 | 1;

export interface OgtMenuIngredient {
  id: number;
  productId: number;
  name: string;
  priceCents: number;
  isExtra: OgtFlag;
  isRequired: OgtFlag;
  sortOrder: number;
}

export interface OgtMenuProduct {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  isAvailable: OgtFlag;
  isHidden: OgtFlag;
  sortOrder: number;
  ingredients: OgtMenuIngredient[];
  addonGroupIds: number[];
}

export interface OgtMenuCategory {
  id: number;
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
  isHidden: OgtFlag;
  sortOrder: number;
  products: OgtMenuProduct[];
}

export interface OgtAddonOption {
  id: number;
  groupId: number;
  name: string;
  priceCents: number;
  sortOrder: number;
}

export interface OgtAddonGroup {
  id: number;
  name: string;
  isActive: OgtFlag;
  sortOrder: number;
  options: OgtAddonOption[];
  productCount: number;
}

export type OgtUploadResult = { path: string } | { error: string };

export interface OgtOrderDetail {
  order: OgtOrder;
  lines: Array<{
    id: number;
    orderId: number;
    productId: number;
    name: string;
    qty: number;
    unitCents: number;
    lineCents: number;
    extras: string;
    removed: string;
  }>;
  activity: Array<{ id: number; orderId: number; at: number; actor: string; action: string; detail: string }>;
}

export interface OgtOverview {
  todayOrders: number;
  todayNew: number;
  preparing: number;
  totalOrders: number;
  revenueToday: number | null;
  products: number | null;
}

export type OgtCashboxTxType = "income" | "expense" | "adjustment" | "deposit" | "withdrawal";
export type OgtCashboxDirection = "in" | "out";

export interface OgtCashboxTx {
  id: number;
  txNumber: number;
  type: OgtCashboxTxType;
  direction: OgtCashboxDirection;
  amountCents: number;
  paymentMethod: string;
  source: string;
  orderId: number | null;
  sessionId: number | null;
  userId: number;
  userName: string;
  note: string;
  status: string;
  correctsTxId: number | null;
  createdAt: number;
}

export interface OgtCashboxSession {
  id: number;
  openedAt: number;
  openingBalanceCents: number;
  openedById: number;
  openedByName: string;
  status: string;
  closedAt: number | null;
  closedById: number;
  closedByName: string;
  expectedCents: number;
  actualCents: number;
  diffCents: number;
  note: string;
  closeReason: string;
}

export interface OgtCashboxSessionDetail {
  session: OgtCashboxSession;
  breakdown: {
    salesCents: number;
    manualIncomeCents: number;
    depositCents: number;
    expenseCents: number;
    withdrawalCents: number;
    adjustmentInCents: number;
    adjustmentOutCents: number;
  };
  rows: OgtCashboxTx[];
}

export interface OgtCashboxSummary {
  currentBalanceCents: number;
  openSession: OgtCashboxSession | null;
  period: {
    incomeCents: number;
    expenseCents: number;
    depositCents: number;
    withdrawalCents: number;
    adjustmentInCents: number;
    adjustmentOutCents: number;
    salesCashCents: number;
    salesElectronicCents: number;
  };
  salesCents: number;
  paidOrders: number;
  txCount: number;
  byDay: Array<{ key: string; label: string; inCents: number; outCents: number }>;
  byType: Array<{ type: OgtCashboxTxType; count: number; amountCents: number }>;
}

export interface OgtCashboxListInput {
  from?: number;
  to?: number;
  type?: string;
  method?: string;
  methodIn?: string[];
  direction?: OgtCashboxDirection;
  user?: string;
  source?: string;
  orderId?: number;
  sessionId?: number;
  search?: string;
  limit?: number;
}

export type OgtStockItemType = "raw" | "component" | "finished" | "packaging" | "other";

export type OgtStockItemStatus = "available" | "low" | "out";

export type OgtStockMovementKind = "in" | "out" | "adjust" | "count" | "sale" | "restore";

export interface OgtStockItem {
  id: number;
  name: string;
  imageUrl: string;
  type: OgtStockItemType;
  quantity: number;
  unit: string;
  minQuantity: number;
  unitCostCents: number;
  supplier: string;
  note: string;
  archived: number;
  createdAt: number;
  updatedAt: number;
}

export interface OgtStockItemWithStatus extends OgtStockItem {
  status: OgtStockItemStatus;
  valueCents: number;
}

export interface OgtStockMovement {
  id: number;
  itemId: number;
  itemName: string;
  kind: OgtStockMovementKind;
  quantity: number;
  prevQuantity: number;
  newQuantity: number;
  refType: string;
  refId: number | null;
  supplier: string;
  invoice: string;
  reason: string;
  note: string;
  userId: number;
  userName: string;
  createdAt: number;
}

export interface OgtStockSummary {
  totalItems: number;
  lowItems: number;
  outItems: number;
  stockValueCents: number;
  reorderItems: OgtStockItemWithStatus[];
}

export interface OgtProductIngredientView {
  productId: number;
  name: string;
  priceCents: number;
  isAvailable: number;
  isHidden: number;
  hasRecipes: boolean;
  unavailable: boolean;
  items: {
    itemId: number;
    name: string;
    unit: string;
    qty: number;
    quantity: number;
    minQuantity: number;
    status: OgtStockItemStatus;
  }[];
}

export interface OgtStockListInput {
  type?: OgtStockItemType | "";
  search?: string;
  archived?: 0 | 1;
}

export interface OgtStockMovementInput {
  kind: "in" | "out" | "adjust" | "count";
  itemId: number;
  quantity?: number;
  newQuantity?: number;
  actualQuantity?: number;
  supplier?: string;
  invoice?: string;
  reason?: string;
  note?: string;
}

export interface OgtStockItemInput {
  name: string;
  imageUrl?: string;
  type: string;
  unit: string;
  minQuantity?: number;
  unitCostCents?: number;
  supplier?: string;
  note?: string;
}

export interface OgtApi {
  auth: {
    status(): Promise<OgtAuthStatus>;
    setup(input: OgtSetupInput): Promise<OgtUser>;
    login(input: OgtLoginInput): Promise<OgtUser>;
    logout(): Promise<{ ok: boolean }>;
  };
  users: {
    list(): Promise<OgtUser[]>;
    create(input: OgtUserCreateInput): Promise<OgtUser>;
    updateRole(input: OgtUserRoleInput): Promise<OgtUser>;
    remove(input: OgtUserDeleteInput): Promise<{ ok: boolean }>;
  };
  dashboard: {
    overview(): Promise<OgtOverview>;
  };
  orders: {
    list(): Promise<OgtOrderSummary[]>;
    detail(id: number): Promise<OgtOrderDetail | undefined>;
    updateStatus(
      id: number,
      status: OgtOrderStatus,
      opts?: { reason?: string },
    ): Promise<{ ok: boolean }>;
    setPriority(id: number, priority: OgtOrderPriority): Promise<{ ok: boolean }>;
    setPayment(id: number, payment: OgtPaymentStatus, method?: string): Promise<{ ok: boolean }>;
    thresholds(): Promise<OgtLateThresholds>;
  };
  products: {
    list(): Promise<OgtProduct[]>;
  };
  menu: {
    snapshot(): Promise<OgtMenuCategory[]>;
    addonGroups(): Promise<OgtAddonGroup[]>;
    createCategory(input: { nameAr: string; icon: string }): Promise<number>;
    updateCategory(input: { id: number; nameAr: string; isHidden: OgtFlag }): Promise<{ ok: boolean }>;
    updateCategoryImage(input: { id: number; imageUrl: string }): Promise<{ ok: boolean }>;
    deleteCategory(input: { id: number }): Promise<{ ok: boolean }>;
    reorderCategories(ids: number[]): Promise<{ ok: boolean }>;
    createProduct(input: {
      categoryId: number;
      name: string;
      description: string;
      priceCents: number;
      imageUrl: string;
      isAvailable: OgtFlag;
    }): Promise<number>;
    updateProduct(input: {
      id: number;
      categoryId: number;
      name: string;
      description: string;
      priceCents: number;
      imageUrl?: string;
      isAvailable: OgtFlag;
    }): Promise<{ ok: boolean }>;
    deleteProduct(input: { id: number }): Promise<{ ok: boolean }>;
    setProductAvailability(input: { id: number; isAvailable: OgtFlag }): Promise<{ ok: boolean }>;
    setProductHidden(input: { id: number; isHidden: OgtFlag }): Promise<{ ok: boolean }>;
    reorderProducts(input: { categoryId: number; ids: number[] }): Promise<{ ok: boolean }>;
    saveIngredient(input: {
      id?: number;
      productId: number;
      name: string;
      priceCents: number;
      isExtra: OgtFlag;
      isRequired: OgtFlag;
    }): Promise<{ ok: boolean }>;
    deleteIngredient(input: { id: number }): Promise<{ ok: boolean }>;
    createAddonGroup(input: { name: string }): Promise<number>;
    updateAddonGroup(input: { id: number; name: string; isActive: OgtFlag }): Promise<{ ok: boolean }>;
    deleteAddonGroup(input: { id: number }): Promise<{ ok: boolean }>;
    saveAddonOption(input: {
      id?: number;
      groupId: number;
      name: string;
      priceCents: number;
    }): Promise<{ ok: boolean }>;
    deleteAddonOption(input: { id: number }): Promise<{ ok: boolean }>;
    setProductAddonGroups(input: { productId: number; groupIds: number[] }): Promise<{ ok: boolean }>;
    uploadImage(bytes: Uint8Array, originalName: string): Promise<OgtUploadResult>;
    deleteImage(input: { url: string }): Promise<{ ok: boolean }>;
  };
  cashbox: {
    summary(input: { from?: number; to?: number }): Promise<OgtCashboxSummary>;
    list(input: OgtCashboxListInput): Promise<{ rows: OgtCashboxTx[]; total: number }>;
    add(input: {
      type: OgtCashboxTxType;
      direction?: OgtCashboxDirection;
      amountCents: number;
      paymentMethod?: string;
      note?: string;
      orderId?: number;
    }): Promise<OgtCashboxTx>;
    openSession(input: { openingBalanceCents: number; note?: string }): Promise<OgtCashboxSession>;
    updateOpening(input: { sessionId: number; openingBalanceCents: number }): Promise<OgtCashboxSession>;
    closeSession(input: { sessionId: number; actualCents: number; reason?: string }): Promise<OgtCashboxSession>;
    sessions(): Promise<OgtCashboxSession[]>;
    sessionDetail(sessionId: number): Promise<OgtCashboxSessionDetail | undefined>;
    byOrder(orderId: number): Promise<{ tx: OgtCashboxTx[]; openSession: OgtCashboxSession | null }>;
    correct(input: { txId: number; reason: string }): Promise<OgtCashboxTx>;
  };
  stock: {
    list(input?: OgtStockListInput): Promise<OgtStockItemWithStatus[]>;
    get(id: number): Promise<OgtStockItem | undefined>;
    create(input: OgtStockItemInput): Promise<OgtStockItem>;
    update(input: OgtStockItemInput & { id: number }): Promise<OgtStockItem>;
    archive(input: { id: number }): Promise<OgtStockItem>;
    move(input: OgtStockMovementInput): Promise<OgtStockMovement>;
    movements(input: {
      from?: number;
      to?: number;
      itemId?: number;
      kind?: OgtStockMovementKind | "";
      user?: string;
      search?: string;
      limit?: number;
    }): Promise<{ rows: OgtStockMovement[]; total: number }>;
    summary(): Promise<OgtStockSummary>;
    ingredients(): Promise<OgtProductIngredientView[]>;
    setIngredients(input: { productId: number; items: { itemId: number; qty: number }[] }): Promise<{ ok: boolean }>;
  };
  app: {
    openExternal(url: string): Promise<{ ok: boolean }>;
    copyText(text: string): Promise<{ ok: boolean }>;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
  };
}
