"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, Reorder, motion, useDragControls } from "motion/react";
import { formatPrice } from "@/lib/utils";
import {
  createCategoryAction,
  createProductAction,
  deleteCategoryAction,
  deleteIngredientAction,
  deleteProductAction,
  hideUnavailableProductsAction,
  loginAction,
  logoutAction,
  reorderCategoriesAction,
  saveIngredientAction,
  showHiddenProductsAction,
  updateCategoryAction,
  updateCategoryImageAction,
  updateProductAction,
} from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";
import type { CategoryWithCount, IngredientRow, ProductRow } from "@/lib/db";

type ProductWithIngredients = ProductRow & { ingredients: IngredientRow[] };

const inputCls =
  "w-full rounded-xl border border-line bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent";
const labelCls = "mb-1 block text-xs font-bold text-muted";
const btnPrimary =
  "rounded-full bg-accent px-5 py-2 text-sm font-extrabold text-black transition-transform hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60";
const btnGhost =
  "rounded-full border border-line px-4 py-2 text-sm font-bold text-muted transition-colors hover:border-red-500 hover:text-red-400";

function Feedback({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm font-bold text-red-400">
      {error}
    </p>
  );
}

function AccordionSection({
  icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-extrabold text-foreground transition-colors hover:bg-card"
      >
        <span>
          <span aria-hidden className="ml-1.5">{icon}</span>
          {title}
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted"
        >
          ▾
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-line p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(loginAction, {});
  return (
    <form
      action={action}
      className="w-full max-w-sm space-y-4 rounded-3xl border border-line bg-card p-6 shadow-xl"
    >
      <div className="text-center">
        <span className="text-5xl" aria-hidden>🔐</span>
        <h2 className="mt-2 text-xl font-black">لوحة تحكم الادمن</h2>
        <p className="mt-1 text-sm text-muted">أدخل كلمة المرور للمتابعة</p>
      </div>
      <div>
        <label htmlFor="password" className={labelCls}>
          كلمة المرور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className={inputCls}
          placeholder="••••••••"
        />
      </div>
      <Feedback error={state.error} />
      <button type="submit" disabled={pending} className={`${btnPrimary} w-full py-3`}>
        {pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
      </button>
    </form>
  );
}

function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className={btnGhost}>
        تسجيل الخروج
      </button>
    </form>
  );
}

function AddProductForm({ categoryId }: { categoryId: number }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    createProductAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      formRef.current?.reset();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-accent/50 px-4 py-2 text-sm font-extrabold text-accent transition-colors hover:bg-accent/10"
      >
        + إضافة طبق
      </button>
    );
  }

  return (
    <form ref={formRef} action={action} className="rounded-2xl border border-line bg-card-2 p-4">
      <input type="hidden" name="categoryId" value={categoryId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>الاسم *</label>
          <input name="name" required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>السعر (دج) *</label>
          <input name="price" type="number" step="0.01" min="0" required className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>الوصف</label>
          <input name="description" className={inputCls} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>صورة الطبق (من الجهاز) *</label>
          <input
            name="image"
            type="file"
            accept="image/*"
            required
            className={inputCls}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm font-bold text-muted">
          <input name="isAvailable" type="checkbox" defaultChecked className="h-4 w-4 accent-amber-400" />
          متوفر
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
            إلغاء
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <Feedback error={state.error} />
      </div>
    </form>
  );
}

function EditProductForm({ product }: { product: ProductRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateProductAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="grid gap-3 rounded-2xl border border-line bg-card-2 p-4 lg:grid-cols-2">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="categoryId" value={product.categoryId} />
      <div>
        <label className={labelCls}>الاسم</label>
        <input name="name" required defaultValue={product.name} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>السعر (دج)</label>
        <input
          name="price"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={(product.priceCents / 100).toFixed(2)}
          className={inputCls}
        />
      </div>
      <div>
        <label className={labelCls}>الوصف</label>
        <input name="description" defaultValue={product.description} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>استبدال الصورة (اختياري — اتركه فارغاً للاحتفاظ)</label>
        <input name="image" type="file" accept="image/*" className={inputCls} />
      </div>
      <div className="flex items-center justify-between lg:col-span-2">
        <label className="flex items-center gap-2 text-sm font-bold text-muted">
          <input
            name="isAvailable"
            type="checkbox"
            defaultChecked={product.isAvailable === 1}
            className="h-4 w-4 accent-amber-400"
          />
          متوفر
        </label>
        <div className="flex items-center gap-2">
          {!pending && state.ok && <span className="text-sm font-bold text-green-400">تم الحفظ ✓</span>}
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "جارٍ الحفظ…" : "حفظ التعديلات"}
          </button>
        </div>
      </div>
      <div className="lg:col-span-2">
        <Feedback error={state.error} />
      </div>
    </form>
  );
}

function DeleteProductButton({ product }: { product: ProductRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    deleteProductAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={product.id} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!window.confirm(`حذف «${product.name}»؟`)) e.preventDefault();
        }}
        className={btnGhost}
      >
        {pending ? "جارٍ الحذف…" : "حذف"}
      </button>
    </form>
  );
}

function CategoryImageForm({ category }: { category: CategoryWithCount }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateCategoryImageAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card-2 p-3">
      <input type="hidden" name="id" value={category.id} />
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          alt={category.nameAr}
          width={56}
          height={56}
          className="h-14 w-14 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-card text-2xl">
          {category.icon}
        </span>
      )}
      <label className="min-w-0 flex-1">
        <span className={labelCls}>صورة الصنف (من الجهاز)</span>
        <input name="image" type="file" accept="image/*" required className={inputCls} />
      </label>
      <button type="submit" disabled={pending} className={btnPrimary}>
        {pending ? "…" : "حفظ الصورة"}
      </button>
      <Feedback error={state.error} />
    </form>
  );
}

function IngredientEditRow({ ingredient }: { ingredient: IngredientRow }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    saveIngredientAction,
    {},
  );
  const [del, delAction, delPending] = useActionState<ActionResult, FormData>(
    deleteIngredientAction,
    {},
  );

  useEffect(() => {
    if (state.ok || del.ok) router.refresh();
  }, [state, del, router]);

  return (
    <li className="rounded-xl border border-line bg-card p-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="id" value={ingredient.id} />
        <input type="hidden" name="productId" value={ingredient.productId} />
        <div className="min-w-40 flex-1">
          <input name="name" required defaultValue={ingredient.name} className={inputCls} />
        </div>
        <div className="w-32">
          <input
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={(ingredient.priceCents / 100).toFixed(2)}
            className={inputCls}
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm font-bold text-muted">
          <input
            name="isExtra"
            type="checkbox"
            defaultChecked={ingredient.isExtra === 1}
            className="h-4 w-4 accent-amber-400"
          />
          إضافة
        </label>
        <label className="flex items-center gap-1.5 text-sm font-bold text-muted">
          <input
            name="isRequired"
            type="checkbox"
            defaultChecked={ingredient.isRequired === 1}
            className="h-4 w-4 accent-amber-400"
          />
          لا يُزال
        </label>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "…" : "حفظ"}
        </button>
      </form>
      <form action={delAction} className="mt-2">
        <input type="hidden" name="id" value={ingredient.id} />
        <button
          type="submit"
          disabled={delPending}
          onClick={(e) => {
            if (!window.confirm(`حذف مكون «${ingredient.name}»؟`)) e.preventDefault();
          }}
          className={btnGhost}
        >
          {delPending ? "…" : "حذف"}
        </button>
      </form>
    </li>
  );
}

function IngredientSection({
  product,
  kind,
}: {
  product: ProductWithIngredients;
  kind: "base" | "extras";
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    saveIngredientAction,
    {},
  );
  const list = product.ingredients.filter((i) =>
    kind === "base" ? i.isExtra === 0 : i.isExtra === 1,
  );
  const title = kind === "base" ? "🧅 المكونات" : "➕ الإضافات";

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div>
      <p className="mb-3 text-sm font-extrabold text-muted">
        {title} ({list.length})
      </p>

      {list.length > 0 ? (
        <ul className="space-y-2">
          {list.map((ing) => (
            <IngredientEditRow key={ing.id} ingredient={ing} />
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted">لا توجد {kind === "base" ? "مكونات رئيسية" : "إضافات"}</p>
      )}

      <form action={action} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="productId" value={product.id} />
        <div className="min-w-40 flex-1">
          <label className={labelCls}>اسم {kind === "base" ? "المكون" : "الإضافة"}</label>
          <input name="name" required className={inputCls} placeholder={kind === "base" ? "مثال: جبنة موزاريلا" : "مثال: جبنة إضافية"} />
        </div>
        <div className="w-32">
          <label className={labelCls}>السعر (دج)</label>
          <input name="price" type="number" step="0.01" min="0" required className={inputCls} placeholder="0.00" />
        </div>
        <div className="flex items-center gap-3">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted">
            <input name="isExtra" type="checkbox" defaultChecked={kind === "extras"} className="h-4 w-4 accent-amber-400" />
            إضافة
          </label>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted">
            <input name="isRequired" type="checkbox" className="h-4 w-4 accent-amber-400" />
            لا يُزال
          </label>
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "…" : "+ إضافة"}
        </button>
      </form>
      <div className="mt-2">
        <Feedback error={state.error} />
      </div>
    </div>
  );
}

function VisibilityPanel({
  category,
  products,
}: {
  category: CategoryWithCount;
  products: ProductWithIngredients[];
}) {
  const router = useRouter();
  const unavailable = products.filter((p) => p.isAvailable === 0 && p.isHidden !== 1);
  const hidden = products.filter((p) => p.isHidden === 1);
  const [showList, setShowList] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [hideState, hideAction, hidePending] = useActionState<ActionResult, FormData>(
    hideUnavailableProductsAction,
    {},
  );
  const [showState, showAction, showPending] = useActionState<ActionResult, FormData>(
    showHiddenProductsAction,
    {},
  );

  useEffect(() => {
    if (hideState.ok) router.refresh();
  }, [hideState, router]);

  useEffect(() => {
    if (showState.ok) router.refresh();
  }, [showState, router]);

  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="mt-8 rounded-3xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-extrabold">الرؤية في منيو الزبون</h2>
          <p className="mt-1 text-sm text-muted">
            {hidden.length} منتج مخفي · {unavailable.length} غير متوفر ظاهر حالياً
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <form action={hideAction}>
            <input type="hidden" name="categoryId" value={category.id} />
            <button
              type="submit"
              disabled={hidePending || unavailable.length === 0}
              onClick={(e) => {
                if (unavailable.length === 0) return;
                if (!window.confirm(`إخفاء ${unavailable.length} منتج غير متوفر من منيو الزبون؟`))
                  e.preventDefault();
              }}
              className={`${btnPrimary} disabled:opacity-50`}
            >
              {hidePending
                ? "جارٍ الإخفاء…"
                : unavailable.length === 0
                  ? "لا توجد منتجات غير متوفرة"
                  : "إخفاء المنتجات غير المتوفرة"}
            </button>
          </form>
          <button type="button" onClick={() => setShowList((v) => !v)} className={btnGhost}>
            {showList ? "إغلاق القائمة" : `إظهار المنتجات المخفية (${hidden.length})`}
          </button>
        </div>
      </div>

      {hideState.ok && (
        <p className="mt-4 rounded-xl bg-green-500/10 px-3 py-2 text-sm font-bold text-green-400">
          {hideState.count && hideState.count > 0
            ? `تم إخفاء ${hideState.count} منتج من منيو الزبون ✓`
            : "لا توجد منتجات غير متوفرة لإخفائها"}
        </p>
      )}
      {hideState.error && (
        <div className="mt-4">
          <Feedback error={hideState.error} />
        </div>
      )}

      {showList &&
        (hidden.length === 0 ? (
          <p className="mt-4 rounded-xl bg-line/60 px-3 py-2 text-sm font-bold text-muted">
            لا توجد منتجات مخفية حالياً
          </p>
        ) : (
          <form action={showAction} className="mt-4">
            <input type="hidden" name="categoryId" value={category.id} />
            <ul className="space-y-2">
              {hidden.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-background p-2"
                >
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      name="ids"
                      value={p.id}
                      checked={selected.has(p.id)}
                      onChange={() => toggleSelected(p.id)}
                      className="h-4 w-4 shrink-0 accent-amber-400"
                    />
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      width={40}
                      height={40}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                    <span className="truncate font-bold">{p.name}</span>
                  </label>
                  <span className="shrink-0 text-sm font-black text-accent">
                    {formatPrice(p.priceCents)}
                  </span>
                </li>
              ))}
            </ul>
            {showState.ok && showState.count && showState.count > 0 && (
              <p className="mt-3 rounded-xl bg-green-500/10 px-3 py-2 text-sm font-bold text-green-400">
                تم إظهار {showState.count} منتج في منيو الزبون ✓
              </p>
            )}
            {showState.error && (
              <div className="mt-3">
                <Feedback error={showState.error} />
              </div>
            )}
            <button
              type="submit"
              disabled={showPending || selected.size === 0}
              onClick={(e) => {
                if (selected.size === 0) return;
                if (!window.confirm(`إظهار ${selected.size} منتج في منيو الزبون؟`))
                  e.preventDefault();
              }}
              className={`${btnPrimary} mt-4 disabled:opacity-50`}
            >
              {showPending ? "جارٍ الإظهار…" : `إظهار المحدد (${selected.size})`}
            </button>
          </form>
        ))}
    </section>
  );
}

function CategoryAddForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    createCategoryAction,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      formRef.current?.reset();
    }
  }, [state, router]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-dashed border-accent/50 px-4 py-2 text-sm font-extrabold text-accent transition-colors hover:bg-accent/10"
      >
        + إضافة صنف
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-2xl border border-line bg-card-2 p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelCls}>اسم الصنف *</label>
          <input name="nameAr" required className={inputCls} placeholder="مثال: المقبلات" />
        </div>
        <div>
          <label className={labelCls}>الأيقونة</label>
          <input name="icon" className={inputCls} placeholder="🍕" />
        </div>
        <div>
          <label className={labelCls}>الصورة (اختياري)</label>
          <input name="image" type="file" accept="image/*" className={inputCls} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
          إلغاء
        </button>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "جارٍ الإضافة…" : "إضافة"}
        </button>
      </div>
      <div className="mt-3">
        <Feedback error={state.error} />
      </div>
    </form>
  );
}

function CategoryRow({ category }: { category: CategoryWithCount }) {
  const router = useRouter();
  const controls = useDragControls();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateCategoryAction,
    {},
  );
  const [delState, delAction, delPending] = useActionState<ActionResult, FormData>(
    deleteCategoryAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  useEffect(() => {
    if (delState.ok) router.refresh();
  }, [delState, router]);

  return (
    <Reorder.Item
      value={category}
      dragListener={false}
      dragControls={controls}
      className="!list-none"
    >
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-3">
        <button
          type="button"
          aria-label="اسحب للترتيب"
          onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none rounded-lg p-2 text-lg text-muted transition-colors hover:bg-card-2"
        >
          ⠿
        </button>
        <Link
          href={`/admin/categories/${category.slug}`}
          aria-label={`إدارة ${category.nameAr}`}
          className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-xl"
        >
          {category.imageUrl ? (
            <Image
              src={category.imageUrl}
              alt=""
              fill
              sizes="56px"
              className="object-cover transition-transform duration-300 hover:scale-110"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-card-2 text-2xl">
              {category.icon}
            </span>
          )}
        </Link>
        <form action={action} className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={category.id} />
          <input
            name="nameAr"
            required
            defaultValue={category.nameAr}
            className={`${inputCls} min-w-36 flex-1`}
          />
          <label className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-muted">
            <input
              name="isHidden"
              type="checkbox"
              defaultChecked={category.isHidden === 1}
              className="h-4 w-4 accent-amber-400"
            />
            مخفي
          </label>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "…" : "حفظ"}
          </button>
        </form>
        <span className="shrink-0 text-xs font-bold text-muted">{category.productCount} طبق</span>
        {category.isHidden === 1 && (
          <span className="shrink-0 rounded-full bg-line px-2.5 py-0.5 text-xs font-bold text-muted">
            مخفي
          </span>
        )}
        <form action={delAction} className="shrink-0">
          <input type="hidden" name="id" value={category.id} />
          <button
            type="submit"
            disabled={delPending}
            onClick={(e) => {
              if (!window.confirm(`حذف صنف «${category.nameAr}» وكل أطباقه؟`)) e.preventDefault();
            }}
            className={btnGhost}
          >
            {delPending ? "…" : "حذف"}
          </button>
        </form>
        {state.error && <Feedback error={state.error} />}
      </div>
    </Reorder.Item>
  );
}

export function CategoryListView({ categories }: { categories: CategoryWithCount[] }) {
  const router = useRouter();
  const [items, setItems] = useState<CategoryWithCount[]>(categories);
  const [prevCategories, setPrevCategories] = useState<CategoryWithCount[]>(categories);
  const [orderState, orderAction, orderPending] = useActionState<ActionResult, FormData>(
    reorderCategoriesAction,
    {},
  );

  if (prevCategories !== categories) {
    setPrevCategories(categories);
    setItems(categories);
  }

  useEffect(() => {
    if (orderState.ok) router.refresh();
  }, [orderState, router]);

  const originalIds = categories.map((c) => c.id).join(",");
  const currentIds = items.map((c) => c.id).join(",");
  const dirty = originalIds !== currentIds;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted">
            أعد ترتيب الأصناف بالسحب، أو أضف صنفاً جديداً
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className={btnGhost}>
            الطلبات
          </Link>
          <LogoutButton />
        </div>
      </header>

      <CategoryAddForm />

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">الأصناف ({items.length})</h2>
        <form action={orderAction}>
          {items.map((c) => (
            <input key={c.id} type="hidden" name="ids" value={c.id} />
          ))}
          <button
            type="submit"
            disabled={orderPending || !dirty}
            className={`${btnPrimary} disabled:opacity-50`}
          >
            {orderPending
              ? "جارٍ الحفظ…"
              : dirty
                ? "حفظ الترتيب"
                : "✓ الترتيب محفوظ"}
          </button>
        </form>
      </div>
      {orderState.error && (
        <div className="mt-3">
          <Feedback error={orderState.error} />
        </div>
      )}

      <Reorder.Group
        axis="y"
        values={items}
        onReorder={setItems}
        as="ol"
        className="mt-4 space-y-3"
      >
        {items.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </Reorder.Group>
    </div>
  );
}

function CategoryManagerPanel({ category }: { category: CategoryWithCount }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateCategoryAction,
    {},
  );
  const [delState, delAction, delPending] = useActionState<ActionResult, FormData>(
    deleteCategoryAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  useEffect(() => {
    if (delState.ok) router.refresh();
  }, [delState, router]);

  return (
    <section className="mb-6 rounded-3xl border border-line bg-card p-5">
      <h2 className="mb-4 text-lg font-extrabold">⚙️ إدارة الصنف</h2>
      <form action={action} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="id" value={category.id} />
        <div>
          <label className={labelCls}>اسم الصنف</label>
          <input name="nameAr" required defaultValue={category.nameAr} className={inputCls} />
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 text-sm font-bold text-muted">
            <input
              name="isHidden"
              type="checkbox"
              defaultChecked={category.isHidden === 1}
              className="h-4 w-4 accent-amber-400"
            />
            إخفاء من منيو الزبون
          </label>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? "جارٍ الحفظ…" : "حفظ"}
          </button>
        </div>
      </form>
      {state.ok && <p className="mt-3 text-sm font-bold text-green-400">تم الحفظ ✓</p>}
      <div className="mt-3">
        <Feedback error={state.error} />
      </div>
      <div className="mt-4 flex justify-end border-t border-line pt-4">
        <form action={delAction}>
          <input type="hidden" name="id" value={category.id} />
          <button
            type="submit"
            disabled={delPending}
            onClick={(e) => {
              if (!window.confirm(`حذف صنف «${category.nameAr}» وكل أطباقه نهائياً؟`))
                e.preventDefault();
            }}
            className={btnGhost}
          >
            {delPending ? "جارٍ الحذف…" : "حذف الصنف نهائياً"}
          </button>
        </form>
      </div>
    </section>
  );
}

function ProductAccordion({ product }: { product: ProductWithIngredients }) {
  const [openInfo, setOpenInfo] = useState(true);
  const [openBase, setOpenBase] = useState(false);
  const [openExtras, setOpenExtras] = useState(false);
  const [openOther, setOpenOther] = useState(false);

  return (
    <div className="space-y-3">
      <AccordionSection
        icon="🍽️"
        title="معلومات الطبق"
        open={openInfo}
        onToggle={() => setOpenInfo((v) => !v)}
      >
        <EditProductForm product={product} />
      </AccordionSection>
      <AccordionSection
        icon="🧅"
        title="المكونات"
        open={openBase}
        onToggle={() => setOpenBase((v) => !v)}
      >
        <IngredientSection product={product} kind="base" />
      </AccordionSection>
      <AccordionSection
        icon="➕"
        title="الإضافات"
        open={openExtras}
        onToggle={() => setOpenExtras((v) => !v)}
      >
        <IngredientSection product={product} kind="extras" />
      </AccordionSection>
      <AccordionSection
        icon="⚙️"
        title="خيارات أخرى"
        open={openOther}
        onToggle={() => setOpenOther((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted">حذف الطبق نهائياً مع صورته.</p>
          <DeleteProductButton product={product} />
        </div>
      </AccordionSection>
    </div>
  );
}

export function CategoryView({
  category,
  products,
}: {
  category: CategoryWithCount;
  products: ProductWithIngredients[];
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/dashboard" className="mb-3 inline-block text-sm font-bold text-muted transition-colors hover:text-accent">
            → العودة للوحة التحكم
          </Link>
          <h1 className="text-3xl font-black">{category.nameAr}</h1>
          <p className="mt-1 text-sm text-muted">{products.length} طبق</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className={btnGhost}>
            الطلبات
          </Link>
          <LogoutButton />
        </div>
      </header>

      <CategoryManagerPanel category={category} />
      <CategoryImageForm category={category} />
      <VisibilityPanel category={category} products={products} />

      <div className="mt-10 flex items-center justify-between border-b border-line pb-4">
        <h2 className="text-xl font-extrabold">الأطباق</h2>
        <AddProductForm categoryId={category.id} />
      </div>

      <ul className="mt-5 space-y-4">
        {products.map((p) => (
          <li key={p.id} className="rounded-3xl border border-line bg-surface p-4">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold">{p.name}</p>
                    {p.isHidden === 1 && (
                      <span className="rounded-full bg-line px-2.5 py-0.5 text-xs font-bold text-muted">
                        مخفي
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-accent">{formatPrice(p.priceCents)}</p>
                </div>
              </div>
            </div>
            <ProductAccordion product={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}
