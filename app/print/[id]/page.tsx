import Link from "next/link";
import { redirect } from "next/navigation";
import { getOrder } from "@/lib/db";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/orders";
import { formatPrice, RESTAURANT_NAME } from "@/lib/utils";
import { isAdmin } from "@/app/admin/actions";
import { AutoPrint } from "@/components/auto-print";

export const dynamic = "force-dynamic";

export default async function PrintOrderPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) redirect("/admin");
  const { id } = await params;
  const detail = await getOrder(Number(id));
  if (!detail) redirect("/admin/orders");
  const { order, lines } = detail;
  const subtotal = lines.reduce((s, l) => s + l.lineCents, 0);
  const totalAfterDiscount = subtotal - order.discountCents;
  const grandTotal = totalAfterDiscount + order.deliveryFeeCents;

  return (
    <div className="print-area mx-auto max-w-xl p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-black">{RESTAURANT_NAME}</h1>
        <span className="text-sm font-bold text-muted">فاتورة الطلب #{order.id}</span>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2 border-y border-line py-3 text-sm">
        <p>
          <span className="font-bold">التاريخ:</span>{" "}
          {new Date(order.createdAt).toLocaleString("ar", { dateStyle: "long", timeStyle: "short" })}
        </p>
        <p>
          <span className="font-bold">الحالة:</span> {STATUS_LABELS[order.status]}
        </p>
        <p>
          <span className="font-bold">الأولوية:</span> {PRIORITY_LABELS[order.priority]}
        </p>
        <p>
          <span className="font-bold">الدفع:</span>{" "}
          {order.paymentStatus === "paid" ? "مدفوع ✓" : "غير مدفوع"}
        </p>
      </div>

      <h2 className="mb-2 text-sm font-black">البنود</h2>
      <ul className="mb-4 space-y-2 border-b border-line pb-4">
        {lines.map((l) => (
          <li key={l.id} className="flex items-start justify-between gap-3 text-sm">
            <div>
              <p className="font-bold">
                {l.name} × {l.qty}
              </p>
              {safeNames(l.extras).length > 0 && (
                <p className="text-xs text-muted">+ {safeNames(l.extras).join("، ")}</p>
              )}
              {safeNames(l.removed).length > 0 && (
                <p className="text-xs text-muted">بدون: {safeNames(l.removed).join("، ")}</p>
              )}
            </div>
            <span className="font-bold">{formatPrice(l.lineCents)}</span>
          </li>
        ))}
      </ul>

      <div className="mb-4 space-y-1 text-sm">
        <p className="flex justify-between">
          <span>المجموع</span>
          <span>{formatPrice(subtotal)}</span>
        </p>
        {order.discountCents > 0 && (
          <p className="flex justify-between text-red-600">
            <span>الخصم</span>
            <span>- {formatPrice(order.discountCents)}</span>
          </p>
        )}
        {order.deliveryFeeCents > 0 && (
          <p className="flex justify-between">
            <span>التوصيل</span>
            <span>{formatPrice(order.deliveryFeeCents)}</span>
          </p>
        )}
        <p className="flex justify-between border-t border-line pt-2 text-base font-black">
          <span>الإجمالي</span>
          <span>{formatPrice(grandTotal)}</span>
        </p>
      </div>

      {(order.notes || order.customerName) && (
        <div className="mb-4 space-y-1 border-t border-line pt-3 text-sm">
          {order.customerName && (
            <p>
              <span className="font-bold">الزبون:</span> {order.customerName}{" "}
              {order.customerPhone && `(${order.customerPhone})`}
            </p>
          )}
          {order.customerAddress && (
            <p>
              <span className="font-bold">العنوان:</span> {order.customerAddress}
            </p>
          )}
          {order.notes && (
            <p>
              <span className="font-bold">ملاحظات:</span> {order.notes}
            </p>
          )}
        </div>
      )}

      {order.status === "cancelled" && (
        <p className="mb-4 rounded-xl border border-red-300 px-3 py-2 text-sm font-bold text-red-600">
          ملغى — {order.cancelReason || "بدون سبب"}
        </p>
      )}

      <div className="flex items-center gap-3 print-hidden">
        <AutoPrint />
        <Link
          href="/admin/orders"
          className="rounded-full border border-line px-4 py-2 text-sm font-bold text-muted"
        >
          → العودة للطلبات
        </Link>
      </div>
    </div>
  );
}

function safeNames(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
