"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { formatPrice } from "@/lib/utils";
import {
  createProductAction,
  deleteIngredientAction,
  deleteOrderAction,
  deleteProductAction,
  loginAction,
  logoutAction,
  saveIngredientAction,
  updateCategoryImageAction,
  updateProductAction,
} from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";
import type { CategoryWithCount, IngredientRow, OrderRow, ProductRow } from "@/lib/db";

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

function IngredientManager({ product }: { product: ProductWithIngredients }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    saveIngredientAction,
    {},
  );
  const base = product.ingredients.filter((i) => i.isExtra === 0);
  const extras = product.ingredients.filter((i) => i.isExtra === 1);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="mt-4 rounded-2xl border border-dashed border-line bg-background p-4">
      <p className="mb-3 text-sm font-extrabold text-muted">🧅 مكونات الطبق</p>

      <div className="mb-4">
        <p className="mb-2 text-xs font-extrabold text-muted">
          المكونات الرئيسية ({base.length})
        </p>
        {base.length > 0 ? (
          <ul className="space-y-2">
            {base.map((ing) => (
              <IngredientEditRow key={ing.id} ingredient={ing} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">لا توجد مكونات رئيسية</p>
        )}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs font-extrabold text-muted">الإضافات ({extras.length})</p>
        {extras.length > 0 ? (
          <ul className="space-y-2">
            {extras.map((ing) => (
              <IngredientEditRow key={ing.id} ingredient={ing} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">لا توجد إضافات</p>
        )}
      </div>

      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="productId" value={product.id} />
        <div className="min-w-40 flex-1">
          <label className={labelCls}>اسم المكون</label>
          <input name="name" required className={inputCls} placeholder="مثال: جبنة إضافية" />
        </div>
        <div className="w-32">
          <label className={labelCls}>السعر (دج)</label>
          <input name="price" type="number" step="0.01" min="0" required className={inputCls} placeholder="0.00" />
        </div>
        <div className="flex items-center gap-3">
          <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted">
            <input name="isExtra" type="checkbox" className="h-4 w-4 accent-amber-400" />
            إضافة
          </label>
          <label className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted">
            <input name="isRequired" type="checkbox" className="h-4 w-4 accent-amber-400" />
            لا يُزال
          </label>
        </div>
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "…" : "+ إضافة مكون"}
        </button>
      </form>
      <div className="mt-2">
        <Feedback error={state.error} />
      </div>
    </div>
  );
}

function DeleteOrderButton({ orderId }: { orderId: number }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    deleteOrderAction,
    {},
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action}>
      <input type="hidden" name="id" value={orderId} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!window.confirm("حذف هذا الطلب؟")) e.preventDefault();
        }}
        className={btnGhost}
      >
        {pending ? "…" : "حذف"}
      </button>
    </form>
  );
}

export function OrdersView({ orders }: { orders: OrderRow[] }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">الطلبات</h1>
          <p className="mt-1 text-sm text-muted">{orders.length} طلب</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/dashboard" className={btnGhost}>
            لوحة التحكم
          </Link>
          <LogoutButton />
        </div>
      </header>

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line bg-card p-10 text-center text-muted">
          <p className="text-2xl" aria-hidden>📭</p>
          <p className="mt-2 font-bold">لا توجد طلبات بعد</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((o) => {
            let items: string[] = [];
            try {
              const parsed = JSON.parse(o.items);
              if (Array.isArray(parsed)) items = parsed;
            } catch {
              items = [];
            }
            return (
              <li key={o.id} className="rounded-3xl border border-line bg-card p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent-strong">
                      #{o.id}
                    </span>
                    <div>
                      <p className="text-sm font-extrabold">
                        {new Date(o.createdAt).toLocaleString("ar", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <p className="text-xs text-muted">{items.length} صنف</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-accent">
                      {formatPrice(o.totalCents)}
                    </span>
                    <DeleteOrderButton orderId={o.id} />
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {items.map((it, i) => (
                    <li key={i} className="text-sm text-foreground">
                      {it}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function CategoryListView({ categories }: { categories: CategoryWithCount[] }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black">لوحة التحكم</h1>
          <p className="mt-1 text-sm text-muted">اختر صنفاً لإدارة أطباقه ومكوناته وصوره</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/orders" className={btnGhost}>
            الطلبات
          </Link>
          <LogoutButton />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/admin/categories/${c.slug}`}
            className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-lg transition-all hover:border-accent/60 hover:shadow-accent/10"
          >
            <div className="relative h-36 w-full overflow-hidden">
              {c.imageUrl ? (
                <Image
                  src={c.imageUrl}
                  alt={c.nameAr}
                  fill
                  sizes="(max-width: 640px) 100vw, 320px"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-card-2 text-6xl">
                  {c.icon}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 p-4">
              <div>
                <p className="text-lg font-extrabold">{c.nameAr}</p>
                <p className="text-sm text-muted">{c.productCount} طبق</p>
              </div>
              <span className="text-sm font-bold text-accent transition-transform group-hover:-translate-x-1">
                تعديل ←
              </span>
            </div>
          </Link>
        ))}
      </div>
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
    <div className="mx-auto max-w-6xl px-4 py-8">
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

      <CategoryImageForm category={category} />

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">الأطباق</h2>
        <AddProductForm categoryId={category.id} />
      </div>

      <ul className="mt-4 space-y-4">
        {products.map((p) => (
          <li key={p.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image
                  src={p.imageUrl}
                  alt={p.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-xl object-cover"
                />
                <div>
                  <p className="font-extrabold">{p.name}</p>
                  <p className="text-sm text-accent">{formatPrice(p.priceCents)}</p>
                </div>
              </div>
              <DeleteProductButton product={p} />
            </div>
            <EditProductForm product={p} />
            <IngredientManager product={p} />
          </li>
        ))}
      </ul>
    </div>
  );
}
