import { redirect } from "next/navigation";
import { OrdersPipelineView } from "@/components/orders-pipeline";
import { listOrders, getSetting } from "@/lib/db";
import { DEFAULT_LATE_MINUTES } from "@/lib/orders";
import { logger } from "@/lib/logger";
import { isAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!(await isAdmin())) redirect("/admin");
  const [orders, lateNew, latePreparing, lateDelivered] = await Promise.all([
    listOrders(),
    getSetting("late_new_minutes"),
    getSetting("late_preparing_minutes"),
    getSetting("late_delivered_minutes"),
  ]);
  const thresholds = {
    new: Number(lateNew ?? DEFAULT_LATE_MINUTES.new),
    preparing: Number(latePreparing ?? DEFAULT_LATE_MINUTES.preparing),
    delivered: Number(lateDelivered ?? DEFAULT_LATE_MINUTES.delivered),
  };
  logger.info("orders page rendered", { orders: orders.length });
  return <OrdersPipelineView orders={orders} thresholds={thresholds} />;
}
