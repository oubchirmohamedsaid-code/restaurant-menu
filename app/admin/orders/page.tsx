import { redirect } from "next/navigation";
import { OrdersView } from "@/components/admin-ui";
import { listOrders } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  if (!(await isAdmin())) redirect("/admin");

  const orders = await listOrders();
  logger.info("orders page rendered", { orders: orders.length });

  return <OrdersView orders={orders} />;
}
