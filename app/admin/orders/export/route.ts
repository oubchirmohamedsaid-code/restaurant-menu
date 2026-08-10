import { cookies } from "next/headers";
import { listOrders } from "@/lib/db";
import { verifySessionToken } from "@/lib/session";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/orders";
import type { OrderStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SESSION_COOKIE = "admin_session";
const HEADERS = [
  "رقم الطلب",
  "التاريخ",
  "الحالة",
  "الأولوية",
  "البنود",
  "الإجمالي",
  "التوصيل",
  "الخصم",
  "حالة الدفع",
  "اسم الزبون",
  "هاتف الزبون",
  "العنوان",
  "ملاحظات",
  "سبب الإلغاء",
];

function csvCell(value: string | number): string {
  const s = String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export async function GET(request: Request) {
  const store = await cookies();
  if (!verifySessionToken(store.get(SESSION_COOKIE)?.value)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const statusFilter = new URL(request.url).searchParams.get("status") as OrderStatus | null;
  const orders = await listOrders();
  const filtered = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;

  const rows = filtered.map((o) =>
    [
      o.id,
      formatTime(o.createdAt),
      STATUS_LABELS[o.status],
      PRIORITY_LABELS[o.priority],
      o.items,
      (o.totalCents / 100).toFixed(2),
      (o.deliveryFeeCents / 100).toFixed(2),
      (o.discountCents / 100).toFixed(2),
      o.paymentStatus === "paid" ? "مدفوع" : "غير مدفوع",
      o.customerName,
      o.customerPhone,
      o.customerAddress,
      o.notes,
      o.cancelReason,
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = `\uFEFF${HEADERS.join(",")}\n${rows.join("\n")}`;
  const filename = statusFilter ? `orders-${statusFilter}.csv` : "orders.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
