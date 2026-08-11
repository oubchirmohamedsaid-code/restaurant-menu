import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CircleCheck,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { OgtAddonGroup, OgtMenuCategory, OgtMenuProduct, OgtUser } from "@shared/types";
import { canManageMenu } from "@lib/perms";
import { formatMoney } from "../format";
import { Spinner } from "../components/ui";
import { MenuImage } from "./menu/MenuImage";
import { CategoryEditorModal, type CategorySaveInput } from "./menu/CategoryEditorModal";
import { ProductEditorModal, type ProductSavePayload } from "./menu/ProductEditorModal";
import { AddonGroupsModal } from "./menu/AddonGroupsModal";
import { MenuPreviewModal } from "./menu/MenuPreviewModal";
import { uploadFile } from "./menu/menu-utils";

interface LocalToast {
  id: number;
  title: string;
  body?: string;
  tone: "ok" | "error";
}

let toastSeq = 0;

function msg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function SortableCategoryItem({
  cat,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: {
  cat: OgtMenuCategory;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: String(cat.id) });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative flex cursor-pointer items-center gap-2 rounded-xl border px-2 py-2 transition-colors ${
        selected
          ? "border-accent bg-accent/10 text-foreground"
          : "border-transparent text-muted hover:bg-card-2 hover:text-foreground"
      } ${isDragging ? "z-10 opacity-80 ring-2 ring-accent" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="app-region-no-drag cursor-grab touch-none text-muted/60 hover:text-muted"
        title="اسحب للترتيب"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 shrink-0 text-center text-base">{cat.icon || "🍽"}</span>
      <span className="min-w-0 flex-1 truncate text-xs font-bold">{cat.nameAr}</span>
      {cat.isHidden === 1 && <EyeOff className="size-3 shrink-0 text-muted" />}
      <span className="rounded-full bg-card-2 px-1.5 py-0.5 text-[10px] font-black tabular-nums text-muted">
        {cat.products.length}
      </span>
      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="rounded p-1 text-muted hover:bg-surface hover:text-foreground"
          title="تعديل الصنف"
        >
          <Pencil className="size-3.5" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-muted hover:bg-red-50 hover:text-red-600"
          title="حذف الصنف"
        >
          <Trash2 className="size-3.5" />
        </button>
      </span>
    </li>
  );
}

function SortableProductItem({
  product,
  busy,
  onEdit,
  onToggleAvailable,
  onToggleHidden,
  onDelete,
}: {
  product: OgtMenuProduct;
  busy: boolean;
  onEdit: () => void;
  onToggleAvailable: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: String(product.id) });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-card-2/40 ${
        isDragging ? "z-10 opacity-80 ring-2 ring-accent" : ""
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="app-region-no-drag cursor-grab touch-none text-muted/60 hover:text-muted"
        title="اسحب للترتيب"
      >
        <GripVertical className="size-4" />
      </button>
      <MenuImage url={product.imageUrl} alt={product.name} className="size-12 rounded-xl border border-line" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-black text-foreground">{product.name}</span>
          {product.isAvailable === 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-black text-red-600">
              غير متاح
            </span>
          )}
          {product.isHidden === 1 && (
            <span className="rounded-full border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[9px] font-black text-gray-500">
              مخفي
            </span>
          )}
        </div>
        <p className="truncate text-[11px] font-semibold text-muted">
          <span className="font-black tabular-nums text-foreground">{formatMoney(product.priceCents)} دج</span>
          {product.ingredients.length > 0 && ` · ${product.ingredients.length} مكوّن`}
          {product.addonGroupIds.length > 0 && ` · ${product.addonGroupIds.length} مجموعة إضافات`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onToggleAvailable}
          disabled={busy}
          title={product.isAvailable === 1 ? "إيقاف التوفّر" : "تفعيل التوفّر"}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
            product.isAvailable === 1 ? "text-green-600 hover:bg-green-50" : "text-muted hover:bg-card-2 hover:text-foreground"
          }`}
        >
          {product.isAvailable === 1 ? <CircleCheck className="size-4" /> : <EyeOff className="size-4" />}
        </button>
        <button
          onClick={onToggleHidden}
          disabled={busy}
          title={product.isHidden === 1 ? "إظهار للزبون" : "إخفاء من واجهة الزبون"}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
            product.isHidden === 1 ? "text-amber-600 hover:bg-amber-50" : "text-muted hover:bg-card-2 hover:text-foreground"
          }`}
        >
          {product.isHidden === 1 ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </button>
        <button
          onClick={onEdit}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-card-2 hover:text-foreground"
          title="تعديل"
        >
          <Pencil className="size-4" />
        </button>
        <button
          onClick={onDelete}
          disabled={busy}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          title="حذف"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel = "حذف",
  busy,
  onClose,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel?: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4">
          <h3 className="text-base font-black text-foreground">{title}</h3>
        </div>
        <div className="p-5">
          <p className="text-sm font-semibold text-muted">{body}</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-bold text-muted transition-colors hover:bg-card-2 hover:text-foreground disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={onConfirm}
              disabled={busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type DeleteTarget =
  | { kind: "category"; cat: OgtMenuCategory }
  | { kind: "product"; product: OgtMenuProduct; cat: OgtMenuCategory };

export function MenuSection({ user }: { user: OgtUser }) {
  const canManage = canManageMenu(user.role);

  const [snapshot, setSnapshot] = useState<OgtMenuCategory[]>([]);
  const [addonGroups, setAddonGroups] = useState<OgtAddonGroup[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<LocalToast[]>([]);

  const [showCategoryNew, setShowCategoryNew] = useState(false);
  const [editCat, setEditCat] = useState<OgtMenuCategory | null>(null);
  const [productEditor, setProductEditor] = useState<{ categoryId: number; product: OgtMenuProduct | null } | null>(null);
  const [showAddonGroups, setShowAddonGroups] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const notify = useCallback((title: string, body?: string, tone: "ok" | "error" = "ok") => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev.slice(-3), { id, title, body, tone }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
  }, []);

  const load = useCallback(async () => {
    try {
      const [snap, groups] = await Promise.all([window.ogt.menu.snapshot(), window.ogt.menu.addonGroups()]);
      setSnapshot(snap);
      setAddonGroups(groups);
      setSelectedCat((prev) => (prev != null && snap.some((c) => c.id === prev) ? prev : snap[0]?.id ?? null));
      setError(null);
      setLoading(false);
    } catch (err) {
      setError(msg(err));
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      const [snap, groups] = await Promise.all([window.ogt.menu.snapshot(), window.ogt.menu.addonGroups()]);
      setSnapshot(snap);
      setAddonGroups(groups);
      setSelectedCat((prev) => (prev != null && snap.some((c) => c.id === prev) ? prev : snap[0]?.id ?? null));
    } catch {
      /* background refresh: keep current view */
    }
  }, []);

  async function run(fn: () => Promise<unknown>, failTitle: string, okTitle?: string) {
    setBusy(true);
    try {
      await fn();
      if (okTitle) notify(okTitle);
      await load();
    } catch (err) {
      notify(failTitle, msg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function onCategoryDragEnd(e: DragEndEvent) {
    if (!canManage || !snapshot.length) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = snapshot.map((c) => c.id);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    setSnapshot((prev) => {
      const byId = new Map((prev ?? []).map((c) => [c.id, c]));
      return next.map((id) => byId.get(id)!).filter(Boolean);
    });
    void window.ogt.menu
      .reorderCategories(next)
      .then(() => undefined)
      .catch((err) => {
        notify("تعذر حفظ الترتيب", msg(err), "error");
        void load();
      });
  }

  function onProductDragEnd(e: DragEndEvent) {
    if (!canManage || !selectedCat) return;
    const cat = snapshot.find((c) => c.id === selectedCat);
    if (!cat) return;
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = cat.products.map((p) => p.id);
    const oldIndex = ids.indexOf(Number(active.id));
    const newIndex = ids.indexOf(Number(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(ids, oldIndex, newIndex);
    setSnapshot((prev) =>
      (prev ?? []).map((c) =>
        c.id === selectedCat ? { ...c, products: next.map((id) => c.products.find((p) => p.id === id)!).filter(Boolean) } : c,
      ),
    );
    void window.ogt.menu
      .reorderProducts({ categoryId: selectedCat, ids: next })
      .then(() => undefined)
      .catch((err) => {
        notify("تعذر حفظ الترتيب", msg(err), "error");
        void load();
      });
  }

  async function saveCategory(category: OgtMenuCategory | null, input: CategorySaveInput) {
    setBusy(true);
    try {
      if (category) {
        await window.ogt.menu.updateCategory({ id: category.id, nameAr: input.nameAr, isHidden: input.isHidden });
        if (input.imageUrl) await window.ogt.menu.updateCategoryImage({ id: category.id, imageUrl: input.imageUrl });
      } else {
        const id = await window.ogt.menu.createCategory({ nameAr: input.nameAr, icon: input.icon || "🍽️" });
        if (input.imageUrl) await window.ogt.menu.updateCategoryImage({ id, imageUrl: input.imageUrl });
      }
      notify(category ? "تم تحديث الصنف" : "تم إنشاء الصنف");
      setEditCat(null);
      setShowCategoryNew(false);
      await load();
    } catch (err) {
      notify("تعذر حفظ الصنف", msg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct(payload: ProductSavePayload) {
    setBusy(true);
    try {
      let imageUrl: string | undefined;
      if (payload.imageFile) {
        const res = await uploadFile(payload.imageFile);
        if ("error" in res) throw new Error(res.error);
        imageUrl = res.path;
      }
      let pid: number;
      if (payload.info.id != null) {
        await window.ogt.menu.updateProduct({
          id: payload.info.id,
          categoryId: payload.info.categoryId,
          name: payload.info.name,
          description: payload.info.description,
          priceCents: payload.info.priceCents,
          isAvailable: payload.info.isAvailable,
          imageUrl,
        });
        pid = payload.info.id;
      } else {
        pid = await window.ogt.menu.createProduct({
          categoryId: payload.info.categoryId,
          name: payload.info.name,
          description: payload.info.description,
          priceCents: payload.info.priceCents,
          imageUrl: imageUrl ?? "",
          isAvailable: payload.info.isAvailable,
        });
      }
      const existing = payload.info.id != null
        ? snapshot.find((c) => c.id === payload.info.categoryId)?.products.find((p) => p.id === pid)?.ingredients ?? []
        : [];
      const desiredIds = new Set(payload.ingredients.filter((i) => i.id != null).map((i) => i.id as number));
      for (const ing of existing) {
        if (!desiredIds.has(ing.id)) await window.ogt.menu.deleteIngredient({ id: ing.id });
      }
      for (const ing of payload.ingredients) {
        await window.ogt.menu.saveIngredient({
          id: ing.id,
          productId: pid,
          name: ing.name,
          priceCents: ing.priceCents,
          isExtra: ing.isExtra,
          isRequired: ing.isRequired,
        });
      }
      await window.ogt.menu.setProductAddonGroups({ productId: pid, groupIds: payload.groupIds });
      notify(payload.info.id != null ? "تم تحديث الطبق" : "تم إنشاء الطبق");
      setProductEditor(null);
      await load();
    } catch (err) {
      notify("تعذر حفظ الطبق", msg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  function onDeleteConfirmed() {
    if (!confirmDelete) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    if (target.kind === "category") {
      void run(
        () => window.ogt.menu.deleteCategory({ id: target.cat.id }),
        "تعذر حذف الصنف",
        "تم حذف الصنف وأطباقه",
      );
    } else {
      void run(
        () => window.ogt.menu.deleteProduct({ id: target.product.id }),
        "تعذر حذف الطبق",
        "تم حذف الطبق",
      );
    }
  }

  const current = snapshot.find((c) => c.id === selectedCat) ?? null;
  const productCount = snapshot.reduce((s, c) => s + c.products.length, 0);

  if (loading && snapshot.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="جاري تحميل المينيو..." />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col gap-3 overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
            <UtensilsCrossed className="size-6 text-accent" />
            المينيو
          </h1>
          <p className="text-xs font-bold text-muted">
            {loading ? "جاري التحديث..." : `${snapshot.length} أصناف · ${productCount} طبق`}
            {!canManage ? " · صلاحية عرض فقط" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddonGroups(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-foreground transition-colors hover:bg-card-2"
          >
            <Layers className="size-4 text-accent" />
            مجموعات الإضافات
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-bold text-foreground transition-colors hover:bg-card-2"
          >
            <Eye className="size-4 text-accent" />
            معاينة
          </button>
          <button
            onClick={() => void load()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-surface text-muted transition-colors hover:bg-card-2 hover:text-foreground"
            title="تحديث"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="flex w-72 shrink-0 flex-col rounded-2xl border border-line bg-surface shadow-soft">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <h3 className="text-xs font-black text-muted">الأصناف</h3>
            {canManage && (
              <button
                onClick={() => setShowCategoryNew(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-accent-strong"
              >
                <Plus className="size-3.5" />
                إضافة
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-2">
            {snapshot.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-muted">لا توجد أصناف بعد — أضف صنفاً أولاً.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCategoryDragEnd}>
                <SortableContext items={snapshot.map((c) => String(c.id))} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1">
                    {snapshot.map((cat) => (
                      <SortableCategoryItem
                        key={cat.id}
                        cat={cat}
                        selected={selectedCat === cat.id}
                        onSelect={() => setSelectedCat(cat.id)}
                        onEdit={() => setEditCat(cat)}
                        onDelete={() => setConfirmDelete({ kind: "category", cat })}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">{current?.icon || "🍽"}</span>
              <h3 className="text-sm font-black text-foreground">{current?.nameAr ?? "الأطباق"}</h3>
              {current && (
                <span className="rounded-full bg-card-2 px-2 py-0.5 text-[10px] font-black tabular-nums text-muted">
                  {current.products.length} طبق
                </span>
              )}
            </div>
            {canManage && current && (
              <button
                onClick={() => setProductEditor({ categoryId: current.id, product: null })}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-accent px-2.5 text-[11px] font-bold text-white transition-colors hover:bg-accent-strong"
              >
                <Plus className="size-3.5" />
                إضافة طبق
              </button>
            )}
          </div>

          {!current ? (
            <div className="flex h-40 items-center justify-center text-sm font-bold text-muted">اختر صنفاً من القائمة.</div>
          ) : current.products.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm font-bold text-muted">
              <UtensilsCrossed className="size-6 opacity-40" />
              لا توجد أطباق في هذا الصنف.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onProductDragEnd}>
              <SortableContext
                items={current.products.map((p) => String(p.id))}
                strategy={verticalListSortingStrategy}
              >
                <ul className="min-h-0 flex-1 divide-y divide-line/60 overflow-auto">
                  {current.products.map((p) => (
                    <SortableProductItem
                      key={p.id}
                      product={p}
                      busy={busy}
                      onEdit={() => setProductEditor({ categoryId: current.id, product: p })}
                      onToggleAvailable={() =>
                        void run(
                          () => window.ogt.menu.setProductAvailability({ id: p.id, isAvailable: p.isAvailable === 1 ? 0 : 1 }),
                          "تعذر تغيير التوفّر",
                        )
                      }
                      onToggleHidden={() =>
                        void run(
                          () => window.ogt.menu.setProductHidden({ id: p.id, isHidden: p.isHidden === 1 ? 0 : 1 }),
                          "تعذر تغيير الإظهار",
                        )
                      }
                      onDelete={() => setConfirmDelete({ kind: "product", product: p, cat: current })}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>
      </div>

      {showCategoryNew && (
        <CategoryEditorModal
          category={null}
          busy={busy}
          onClose={() => setShowCategoryNew(false)}
          onSave={(input) => saveCategory(null, input)}
        />
      )}
      {editCat && (
        <CategoryEditorModal
          category={editCat}
          busy={busy}
          onClose={() => setEditCat(null)}
          onSave={(input) => saveCategory(editCat, input)}
        />
      )}
      {productEditor && (
        <ProductEditorModal
          categoryId={productEditor.categoryId}
          categoryName={snapshot.find((c) => c.id === productEditor.categoryId)?.nameAr ?? ""}
          product={productEditor.product}
          addonGroups={addonGroups}
          busy={busy}
          onClose={() => setProductEditor(null)}
          onSave={saveProduct}
        />
      )}
      {showAddonGroups && (
        <AddonGroupsModal
          groups={addonGroups}
          busy={busy}
          onClose={() => setShowAddonGroups(false)}
          onChanged={refresh}
        />
      )}
      {showPreview && <MenuPreviewModal snapshot={snapshot} addonGroups={addonGroups} onClose={() => setShowPreview(false)} />}

      {confirmDelete && (
        <ConfirmDialog
          title={confirmDelete.kind === "category" ? "حذف الصنف" : "حذف الطبق"}
          body={
            confirmDelete.kind === "category"
              ? `سيتم حذف صنف «${confirmDelete.cat.nameAr}» وجميع أطباقه (${confirmDelete.cat.products.length} طبق) نهائياً.`
              : `سيتم حذف طبق «${confirmDelete.product.name}» نهائياً.`
          }
          busy={busy}
          onClose={() => setConfirmDelete(null)}
          onConfirm={onDeleteConfirmed}
        />
      )}

      {toasts.length > 0 && (
        <div className="pointer-events-none fixed start-1/2 top-16 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4">
          {toasts.map((t) => (
            <button
              key={t.id}
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-start shadow-card ${
                t.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-surface text-foreground"
              }`}
            >
              {t.tone === "error" ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-green-600" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-black">{t.title}</span>
                {t.body && <span className="block text-xs font-semibold text-muted">{t.body}</span>}
              </span>
              <X className="ms-auto mt-0.5 size-3.5 shrink-0 text-muted" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
