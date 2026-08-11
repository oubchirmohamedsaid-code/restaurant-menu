import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import type { OgtAddonGroup, OgtMenuCategory, OgtMenuProduct } from "@shared/types";
import { Modal } from "../../components/ui";
import { formatMoney } from "../../format";
import { MenuImage } from "./MenuImage";

function ProductCard({
  product,
  groups,
}: {
  product: OgtMenuProduct;
  groups: Map<number, OgtAddonGroup>;
}) {
  const [open, setOpen] = useState(false);
  const base = product.ingredients.filter((i) => i.isExtra === 0);
  const extras = product.ingredients.filter((i) => i.isExtra === 1);
  const linked = product.addonGroupIds
    .map((id) => groups.get(id))
    .filter((g): g is OgtAddonGroup => !!g && g.isActive === 1);

  return (
    <div className={`rounded-2xl border border-line bg-surface p-3 shadow-soft ${product.isAvailable === 1 ? "" : "opacity-70"}`}>
      <div className="flex items-start gap-3">
        <MenuImage url={product.imageUrl} alt={product.name} className="size-16 rounded-xl border border-line" iconClassName="size-6" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h5 className="truncate text-sm font-black text-foreground">
              {product.name}
              {product.isAvailable === 0 && (
                <span className="ms-1.5 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-red-600">
                  غير متاح
                </span>
              )}
            </h5>
            <span className="shrink-0 text-sm font-black tabular-nums text-accent-strong">{formatMoney(product.priceCents)} دج</span>
          </div>
          {product.description && <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold text-muted">{product.description}</p>}
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-accent-strong hover:underline"
          >
            <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
            {open ? "إخفاء التفاصيل" : "المكونات والإضافات"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-line/60 pt-2 text-[11px] font-semibold text-muted">
          {base.length > 0 && (
            <p>
              المكونات:{" "}
              {base.map((i) => (
                <span key={i.id} className="mx-0.5 inline-flex items-center gap-0.5 rounded-lg bg-card-2 px-1.5 py-0.5">
                  {i.name}
                  {i.isRequired === 1 ? <span className="font-black text-accent-strong">*</span> : null}
                </span>
              ))}
            </p>
          )}
          {extras.length > 0 && (
            <p className="flex flex-wrap items-center gap-1">
              إضافات:
              {extras.map((i) => (
                <span key={i.id} className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-1.5 py-0.5 text-green-700">
                  {i.name} <span className="tabular-nums">+{formatMoney(i.priceCents)}</span>
                </span>
              ))}
            </p>
          )}
          {linked.map((g) => (
            <div key={g.id}>
              <p className="font-black text-foreground">{g.name}</p>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {g.options.map((o) => (
                  <span key={o.id} className="inline-flex items-center gap-1 rounded-lg border border-line bg-card-2 px-1.5 py-0.5">
                    {o.name}
                    {o.priceCents > 0 && <span className="tabular-nums">+{formatMoney(o.priceCents)}</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MenuPreviewModal({
  snapshot,
  addonGroups,
  onClose,
}: {
  snapshot: OgtMenuCategory[];
  addonGroups: OgtAddonGroup[];
  onClose: () => void;
}) {
  const cats = snapshot.filter((c) => c.isHidden === 0);
  const groups = new Map(addonGroups.map((g) => [g.id, g]));

  return (
    <Modal title="معاينة المينيو (كما يراها الزبون)" onClose={onClose} wide>
      <div className="max-h-[70vh] space-y-5 overflow-auto">
        {cats.length === 0 && <p className="py-8 text-center text-sm font-bold text-muted">لا توجد أصناف ظاهرة في المينيو.</p>}
        {cats.map((cat) => {
          const products = cat.products.filter((p) => p.isHidden === 0);
          if (products.length === 0) return null;
          return (
            <section key={cat.id}>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-black text-foreground">
                <span className="text-lg">{cat.icon || "🍽"}</span>
                {cat.nameAr}
              </h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} groups={groups} />
                ))}
              </div>
            </section>
          );
        })}
        {cats.length > 0 && cats.every((c) => c.products.filter((p) => p.isHidden === 0).length === 0) && (
          <p className="flex items-center gap-2 py-6 text-center text-sm font-bold text-muted">
            <Layers className="size-4" />
            كل الأطباق مخفية حالياً — أظهرها من قسم المينيو.
          </p>
        )}
      </div>
    </Modal>
  );
}
