import { BrowserWindow, ipcMain } from "electron";
import { logger } from "../../../lib/logger";
import { handlers, RpcError } from "./handlers";

type RpcResult = { ok: true; data: unknown } | { ok: false; code: string; error: string };

async function wrap(fn: () => Promise<unknown>): Promise<RpcResult> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err) {
    const code = err instanceof RpcError ? err.code : "ERROR";
    const error = err instanceof Error ? err.message : "خطأ غير متوقع";
    logger.error("ipc handler failed", { code, error });
    return { ok: false, code, error };
  }
}

function handle(channel: string, fn: (payload: unknown) => Promise<unknown>): void {
  ipcMain.handle(channel, async (_event, payload: unknown) => wrap(() => fn(payload)));
}

export function registerIpc(): void {
  handle("auth:status", () => handlers.authStatus());
  handle("auth:setup", (p) => handlers.authSetup(p as never));
  handle("auth:login", (p) => handlers.authLogin(p as never));
  handle("auth:logout", () => handlers.authLogout());

  handle("users:list", () => handlers.usersList());
  handle("users:create", (p) => handlers.usersCreate(p as never));
  handle("users:updateRole", (p) => handlers.usersUpdateRole(p as never));
  handle("users:delete", (p) => handlers.usersDelete(p as never));

  handle("dashboard:overview", () => handlers.dashboardOverview());

  handle("orders:list", () => handlers.ordersList());
  handle("orders:detail", (p) => handlers.ordersDetail((p as { id: number }).id));
  handle("orders:updateStatus", (p) =>
    handlers.ordersUpdateStatus(
      (p as { id: number }).id,
      (p as { status: "new" | "preparing" | "delivered" | "completed" | "cancelled" }).status,
      { reason: (p as { reason?: string }).reason },
    ),
  );
  handle("orders:setPriority", (p) =>
    handlers.ordersSetPriority(
      (p as { id: number }).id,
      (p as { priority: "normal" | "important" | "urgent" }).priority,
    ),
  );
  handle("orders:setPayment", (p) =>
    handlers.ordersSetPayment(
      (p as { id: number }).id,
      (p as { payment: "unpaid" | "paid" }).payment,
      (p as { method?: string }).method,
    ),
  );
  handle("orders:thresholds", () => handlers.ordersThresholds());

  handle("products:list", () => handlers.productsList());

  handle("menu:snapshot", () => handlers.menuSnapshot());
  handle("menu:addonGroups", () => handlers.menuAddonGroups());
  handle("menu:createCategory", (p) => handlers.menuCreateCategory(p as never));
  handle("menu:updateCategory", (p) => handlers.menuUpdateCategory(p as never));
  handle("menu:updateCategoryImage", (p) => handlers.menuUpdateCategoryImage(p as never));
  handle("menu:deleteCategory", (p) => handlers.menuDeleteCategory(p as never));
  handle("menu:reorderCategories", (p) => handlers.menuReorderCategories((p as { ids: number[] }).ids));
  handle("menu:createProduct", (p) => handlers.menuCreateProduct(p as never));
  handle("menu:updateProduct", (p) => handlers.menuUpdateProduct(p as never));
  handle("menu:deleteProduct", (p) => handlers.menuDeleteProduct(p as never));
  handle("menu:setProductAvailability", (p) => handlers.menuSetProductAvailability(p as never));
  handle("menu:setProductHidden", (p) => handlers.menuSetProductHidden(p as never));
  handle("menu:reorderProducts", (p) => handlers.menuReorderProducts(p as never));
  handle("menu:saveIngredient", (p) => handlers.menuSaveIngredient(p as never));
  handle("menu:deleteIngredient", (p) => handlers.menuDeleteIngredient(p as never));
  handle("menu:createAddonGroup", (p) => handlers.menuCreateAddonGroup(p as never));
  handle("menu:updateAddonGroup", (p) => handlers.menuUpdateAddonGroup(p as never));
  handle("menu:deleteAddonGroup", (p) => handlers.menuDeleteAddonGroup(p as never));
  handle("menu:saveAddonOption", (p) => handlers.menuSaveAddonOption(p as never));
  handle("menu:deleteAddonOption", (p) => handlers.menuDeleteAddonOption(p as never));
  handle("menu:setProductAddonGroups", (p) => handlers.menuSetProductAddonGroups(p as never));
  handle("menu:uploadImage", (p) =>
    handlers.menuUploadImage((p as { bytes: Uint8Array; originalName: string })),
  );
  handle("menu:deleteImage", (p) => handlers.menuDeleteImage(p as never));

  handle("cashbox:summary", (p) =>
    handlers.cashboxSummary(((p as { from?: number; to?: number } | undefined) ?? {}) as { from?: number; to?: number }),
  );
  handle("cashbox:list", (p) => handlers.cashboxList((p as never) ?? {}));
  handle("cashbox:add", (p) => handlers.cashboxAdd((p as never)));
  handle("cashbox:openSession", (p) =>
    handlers.cashboxOpenSession((p as { openingBalanceCents: number; note?: string })),
  );
  handle("cashbox:updateOpening", (p) =>
    handlers.cashboxUpdateOpening((p as { sessionId: number; openingBalanceCents: number })),
  );
  handle("cashbox:closeSession", (p) =>
    handlers.cashboxCloseSession((p as { sessionId: number; actualCents: number; reason?: string })),
  );
  handle("cashbox:sessions", () => handlers.cashboxSessions());
  handle("cashbox:sessionDetail", (p) => handlers.cashboxSessionDetail((p as { sessionId: number }).sessionId));
  handle("cashbox:byOrder", (p) => handlers.cashboxByOrder((p as { orderId: number }).orderId));
  handle("cashbox:correct", (p) => handlers.cashboxCorrect((p as { txId: number; reason: string })));

  handle("stock:list", (p) => handlers.stockList((p as never) ?? {}));
  handle("stock:get", (p) => handlers.stockGet(p as { id: number }));
  handle("stock:create", (p) => handlers.stockCreate((p as never)));
  handle("stock:update", (p) => handlers.stockUpdate((p as never)));
  handle("stock:archive", (p) => handlers.stockArchive(p as { id: number }));
  handle("stock:move", (p) => handlers.stockMove((p as never)));
  handle("stock:movements", (p) => handlers.stockMovements((p as never) ?? {}));
  handle("stock:summary", () => handlers.stockSummary());
  handle("stock:ingredients", () => handlers.stockIngredients());
  handle("stock:setIngredients", (p) => handlers.stockSetIngredients((p as never)));

  handle("app:openExternal", (p) => handlers.appOpenExternal((p as { url?: string }).url ?? ""));
  handle("app:copyText", (p) => handlers.appCopyText((p as { text?: string }).text ?? ""));

  ipcMain.on("window:minimize", (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
  ipcMain.on("window:toggle-maximize", (e) => {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.on("window:close", (e) => BrowserWindow.fromWebContents(e.sender)?.close());
}
