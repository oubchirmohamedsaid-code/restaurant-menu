import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../../../lib/logger";
import { createOrder, deleteOrder } from "../../../lib/db";
import { deleteUser } from "../../../lib/users";
import { handlers, RpcError } from "./handlers";
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`SMOKE FAIL: ${msg}`);
}

async function expectDenied(fn: () => Promise<unknown>, msg: string): Promise<void> {
  try {
    await fn();
    throw new Error(`SMOKE FAIL: expected denied — ${msg}`);
  } catch (err) {
    if (!(err instanceof RpcError) || (err.code !== "FORBIDDEN" && err.code !== "UNAUTHORIZED")) {
      throw new Error(`SMOKE FAIL: wrong error for ${msg} — ${String(err)}`);
    }
  }
}

/**
 * Boot-time self-test for the main process: proves setup → login →
 * permissions → orders linkage work through the real handlers + DB.
 * Only runs when the app is launched with --smoke.
 */
export async function runSmoke(): Promise<boolean> {
  const suffix = String(Date.now()).slice(-5);
  try {
    const status = await handlers.authStatus();
    assert(status.phase === "setup" || status.phase === "login", "auth status reachable");

    await handlers.authLogout();

    const owner = await handlers.authSetup({
      fullName: "Smoke Owner",
      username: `smoke_owner_${suffix}`,
      password: "SmokePass123",
    });
    assert(owner.role === "OWNER", "setup creates OWNER");

    await handlers.authLogout();
    await expectDenied(
      () => handlers.usersCreate({
        ownerUsername: "nope",
        ownerPassword: "wrong",
        fullName: "X",
        username: "x",
        password: "password",
        role: "EMPLOYEE",
      }),
      "user create without owner",
    );

    const employee = await handlers.usersCreate({
      ownerUsername: owner.username,
      ownerPassword: "SmokePass123",
      fullName: "Smoke Employee",
      username: `smoke_emp_${suffix}`,
      password: "EmployeePass123",
      role: "EMPLOYEE",
    });
    assert(employee.role === "EMPLOYEE", "employee created");

    const login = await handlers.authLogin({ username: owner.username, password: "SmokePass123" });
    assert(login.id === owner.id, "owner login works");

    const users = await handlers.usersList();
    assert(users.some((u) => u.id === employee.id), "users list contains employee");

    await handlers.authLogout();
    await handlers.authLogin({ username: employee.username, password: "EmployeePass123" });
    await expectDenied(() => handlers.usersList(), "employee cannot list users");
    const employeeOverview = await handlers.dashboardOverview();
    assert(employeeOverview.revenueToday === null, "employee sees no revenue");
    const orders = await handlers.ordersList();
    assert(Array.isArray(orders), "employee can list orders");
    const thresholds = await handlers.ordersThresholds();
    assert(typeof thresholds.new === "number" && thresholds.new > 0, "thresholds reachable");
    await expectDenied(() => handlers.cashboxSummary({}), "employee cannot access cashbox");
    await expectDenied(() => handlers.cashboxList({}), "employee cannot list cashbox");
    await expectDenied(() => handlers.cashboxSessions(), "employee cannot list sessions");
    await expectDenied(() => handlers.menuSnapshot(), "employee cannot access menu");
    await expectDenied(() => handlers.menuAddonGroups(), "employee cannot list addon groups");

    const orderId = await createOrder(
      [
        { productId: 1, name: "بيتزا", qty: 2, unitCents: 2800, extras: ["جبنة"], removed: [] },
        { productId: 2, name: "عصير", qty: 1, unitCents: 2000, extras: [], removed: [] },
      ],
      7600,
    );
    await expectDenied(
      () => handlers.ordersUpdateStatus(orderId, "cancelled", { reason: "x" }),
      "employee cannot cancel",
    );
    await expectDenied(() => handlers.ordersSetPriority(orderId, "urgent"), "employee cannot set priority");
    await expectDenied(() => handlers.ordersSetPayment(orderId, "paid"), "employee cannot set payment");
    await handlers.ordersUpdateStatus(orderId, "preparing");
    await expectDenied(() => handlers.ordersUpdateStatus(orderId, "new"), "employee cannot move backward");
    await handlers.ordersUpdateStatus(orderId, "delivered");
    await expectDenied(() => handlers.ordersUpdateStatus(orderId, "preparing"), "employee cannot move backward from delivered");
    await handlers.ordersUpdateStatus(orderId, "completed");
    assert((await handlers.ordersDetail(orderId)).order.paymentStatus === "paid", "completion auto-pays");
    await expectDenied(
      () => handlers.ordersUpdateStatus(orderId, "cancelled"),
      "employee cannot cancel completed",
    );

    await handlers.authLogout();
    await handlers.authLogin({ username: owner.username, password: "SmokePass123" });
    const cbPaid = await handlers.cashboxSummary({ from: 0, to: Date.now() });
    assert(cbPaid.salesCents >= 7600, "cashbox records order income on completion");
    assert(cbPaid.paidOrders >= 1, "cashbox counts paid order");
    await handlers.ordersUpdateStatus(orderId, "cancelled", { reason: "اختبار تلقائي" });
    const cancelledDetail = await handlers.ordersDetail(orderId);
    assert(cancelledDetail.order.status === "cancelled", "owner can cancel");
    assert(cancelledDetail.order.cancelReason === "اختبار تلقائي", "cancel reason recorded");
    assert(cancelledDetail.order.paymentStatus === "unpaid", "cancel reverts payment");
    const cbCancelled = await handlers.cashboxSummary({ from: 0, to: Date.now() });
    assert(cbCancelled.salesCents === 0, "cancel removes order income from sales");
    const cbRows = await handlers.cashboxList({ orderId });
    const revTx = cbRows.rows.find((r) => r.type === "adjustment" && r.correctsTxId != null);
    assert(!!revTx, "reversal recorded in ledger");
    assert(revTx.direction === "out" && revTx.amountCents === 7600, "reversal mirrors income");
    await handlers.ordersSetPriority(orderId, "urgent");
    assert((await handlers.ordersDetail(orderId)).order.priority === "urgent", "owner can set priority");
    const products = await handlers.productsList();
    assert(Array.isArray(products), "products list reachable");
    await deleteOrder(orderId);
    let gone = false;
    try {
      await handlers.ordersDetail(orderId);
    } catch (err) {
      gone = err instanceof RpcError && err.code === "NOT_FOUND";
    }
    assert(gone, "order detail gone after delete");

    const menuBefore = await handlers.menuSnapshot();
    assert(Array.isArray(menuBefore), "menu snapshot reachable");
    const ag = await handlers.menuCreateAddonGroup({ name: "الحجم" });
    assert(typeof ag === "number" && ag > 0, "addon group created");
    await handlers.menuSaveAddonOption({ groupId: ag, name: "كبير", priceCents: 1000 });
    const catId = await handlers.menuCreateCategory({ nameAr: `سموك ${suffix}`, icon: "🧪" });
    assert(typeof catId === "number" && catId > 0, "menu category created");
    const pid = await handlers.menuCreateProduct({
      categoryId: catId,
      name: "عصير سمك",
      description: "",
      priceCents: 1500,
      imageUrl: "",
      isAvailable: 1,
    });
    assert(typeof pid === "number" && pid > 0, "menu product created");
    await handlers.menuSaveIngredient({ productId: pid, name: "ثلج", priceCents: 0, isExtra: 0, isRequired: 0 });
    await handlers.menuSetProductAddonGroups({ productId: pid, groupIds: [ag] });
    const snap = await handlers.menuSnapshot();
    const snapCat = snap.find((c) => c.id === catId);
    assert(!!snapCat && snapCat.products.length === 1, "snapshot contains created product");
    assert(snapCat.products[0].ingredients.length === 1, "snapshot product has ingredient");
    assert(snapCat.products[0].addonGroupIds.includes(ag), "snapshot product linked to addon group");
    const groups = await handlers.menuAddonGroups();
    assert(groups.find((g) => g.id === ag)?.productCount === 1, "addon group product count");
    await handlers.menuDeleteProduct({ id: pid });
    await handlers.menuDeleteCategory({ id: catId });
    await handlers.menuDeleteAddonGroup({ id: ag });
    const snapClean = await handlers.menuSnapshot();
    assert(!snapClean.some((c) => c.id === catId), "menu cleaned up");

    const overview = await handlers.dashboardOverview();
    assert(typeof overview.todayOrders === "number", "owner overview works");

    await handlers.usersDelete({ id: employee.id, password: "SmokePass123" });
    await handlers.authLogout();
    await deleteUser(owner.id);

    logger.info("SMOKE: PASS");
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof RpcError ? err.code : "";
    console.log(`[smoke] error: ${msg}`);
    logger.error("SMOKE: FAIL", { code, error: msg });
    writeFileSync(join(process.cwd(), "smoke-error.txt"), `code=${code}\nmsg=${msg}\nraw=${String(err)}\n`, "utf8");
    return false;
  }
}
