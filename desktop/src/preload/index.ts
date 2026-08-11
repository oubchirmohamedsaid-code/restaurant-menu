import { contextBridge, ipcRenderer } from "electron";
import type {
  OgtAddonGroup,
  OgtApi,
  OgtAuthStatus,
  OgtCashboxSession,
  OgtCashboxSessionDetail,
  OgtCashboxSummary,
  OgtCashboxTx,
  OgtLateThresholds,
  OgtMenuCategory,
  OgtOrderDetail,
  OgtOrderPriority,
  OgtOrderStatus,
  OgtOrderSummary,
  OgtOverview,
  OgtPaymentStatus,
  OgtProduct,
  OgtProductIngredientView,
  OgtStockItem,
  OgtStockItemWithStatus,
  OgtStockMovement,
  OgtStockSummary,
  OgtUploadResult,
  OgtUser,
} from "../shared/types";

type RpcResult = { ok: true; data: unknown } | { ok: false; code: string; error: string };

async function call<T>(channel: string, payload?: unknown): Promise<T> {
  const res = (await ipcRenderer.invoke(channel, payload)) as RpcResult;
  if (!res || res.ok !== true) {
    const err = new Error(res && "error" in res ? res.error : "فشل الاتصال بالبرنامج");
    (err as { code?: string }).code = res && "code" in res ? res.code : "ERROR";
    throw err;
  }
  return res.data as T;
}

const api: OgtApi = {
  auth: {
    status: () => call<OgtAuthStatus>("auth:status"),
    setup: (input) => call<OgtUser>("auth:setup", input),
    login: (input) => call<OgtUser>("auth:login", input),
    logout: () => call<{ ok: boolean }>("auth:logout"),
  },
  users: {
    list: () => call<OgtUser[]>("users:list"),
    create: (input) => call<OgtUser>("users:create", input),
    updateRole: (input) => call<OgtUser>("users:updateRole", input),
    remove: (input) => call<{ ok: boolean }>("users:delete", input),
  },
  dashboard: {
    overview: () => call<OgtOverview>("dashboard:overview"),
  },
  orders: {
    list: () => call<OgtOrderSummary[]>("orders:list"),
    detail: (id) => call<OgtOrderDetail | undefined>("orders:detail", { id }),
    updateStatus: (id, status, opts) =>
      call<{ ok: boolean }>("orders:updateStatus", {
        id,
        status,
        reason: opts?.reason,
      }),
    setPriority: (id, priority) => call<{ ok: boolean }>("orders:setPriority", { id, priority }),
    setPayment: (id, payment, method) =>
      call<{ ok: boolean }>("orders:setPayment", { id, payment, method }),
    thresholds: () => call<OgtLateThresholds>("orders:thresholds"),
  },
  products: {
    list: () => call<OgtProduct[]>("products:list"),
  },
  menu: {
    snapshot: () => call<OgtMenuCategory[]>("menu:snapshot"),
    addonGroups: () => call<OgtAddonGroup[]>("menu:addonGroups"),
    createCategory: (input) => call<number>("menu:createCategory", input),
    updateCategory: (input) => call<{ ok: boolean }>("menu:updateCategory", input),
    updateCategoryImage: (input) => call<{ ok: boolean }>("menu:updateCategoryImage", input),
    deleteCategory: (input) => call<{ ok: boolean }>("menu:deleteCategory", input),
    reorderCategories: (ids) => call<{ ok: boolean }>("menu:reorderCategories", { ids }),
    createProduct: (input) => call<number>("menu:createProduct", input),
    updateProduct: (input) => call<{ ok: boolean }>("menu:updateProduct", input),
    deleteProduct: (input) => call<{ ok: boolean }>("menu:deleteProduct", input),
    setProductAvailability: (input) => call<{ ok: boolean }>("menu:setProductAvailability", input),
    setProductHidden: (input) => call<{ ok: boolean }>("menu:setProductHidden", input),
    reorderProducts: (input) => call<{ ok: boolean }>("menu:reorderProducts", input),
    saveIngredient: (input) => call<{ ok: boolean }>("menu:saveIngredient", input),
    deleteIngredient: (input) => call<{ ok: boolean }>("menu:deleteIngredient", input),
    createAddonGroup: (input) => call<number>("menu:createAddonGroup", input),
    updateAddonGroup: (input) => call<{ ok: boolean }>("menu:updateAddonGroup", input),
    deleteAddonGroup: (input) => call<{ ok: boolean }>("menu:deleteAddonGroup", input),
    saveAddonOption: (input) => call<{ ok: boolean }>("menu:saveAddonOption", input),
    deleteAddonOption: (input) => call<{ ok: boolean }>("menu:deleteAddonOption", input),
    setProductAddonGroups: (input) => call<{ ok: boolean }>("menu:setProductAddonGroups", input),
    uploadImage: (bytes, originalName) => call<OgtUploadResult>("menu:uploadImage", { bytes, originalName }),
    deleteImage: (input) => call<{ ok: boolean }>("menu:deleteImage", input),
  },
  cashbox: {
    summary: (input) => call<OgtCashboxSummary>("cashbox:summary", input ?? {}),
    list: (input) => call<{ rows: OgtCashboxTx[]; total: number }>("cashbox:list", input ?? {}),
    add: (input) => call<OgtCashboxTx>("cashbox:add", input),
    openSession: (input) => call<OgtCashboxSession>("cashbox:openSession", input),
    updateOpening: (input) => call<OgtCashboxSession>("cashbox:updateOpening", input),
    closeSession: (input) => call<OgtCashboxSession>("cashbox:closeSession", input),
    sessions: () => call<OgtCashboxSession[]>("cashbox:sessions"),
    sessionDetail: (sessionId) =>
      call<OgtCashboxSessionDetail | undefined>("cashbox:sessionDetail", { sessionId }),
    byOrder: (orderId) =>
      call<{ tx: OgtCashboxTx[]; openSession: OgtCashboxSession | null }>("cashbox:byOrder", {
        orderId,
      }),
    correct: (input) => call<OgtCashboxTx>("cashbox:correct", input),
  },
  stock: {
    list: (input) => call<OgtStockItemWithStatus[]>("stock:list", input ?? {}),
    get: (id) => call<OgtStockItem | undefined>("stock:get", { id }),
    create: (input) => call<OgtStockItem>("stock:create", input),
    update: (input) => call<OgtStockItem>("stock:update", input),
    archive: (input) => call<OgtStockItem>("stock:archive", input),
    move: (input) => call<OgtStockMovement>("stock:move", input),
    movements: (input) =>
      call<{ rows: OgtStockMovement[]; total: number }>("stock:movements", input ?? {}),
    summary: () => call<OgtStockSummary>("stock:summary"),
    ingredients: () => call<OgtProductIngredientView[]>("stock:ingredients"),
    setIngredients: (input) => call<{ ok: boolean }>("stock:setIngredients", input),
  },
  app: {
    openExternal: (url) => call<{ ok: boolean }>("app:openExternal", { url }),
    copyText: (text) => call<{ ok: boolean }>("app:copyText", { text }),
  },
  window: {
    minimize: () => ipcRenderer.send("window:minimize"),
    toggleMaximize: () => ipcRenderer.send("window:toggle-maximize"),
    close: () => ipcRenderer.send("window:close"),
  },
};

contextBridge.exposeInMainWorld("ogt", api);
