"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { formatPrice, RESTAURANT_NAME } from "@/lib/utils";
import { useCart } from "@/components/cart";
import type { IngredientRow, ProductRow } from "@/lib/db";

const FLOATERS = [
  { emoji: "🍕", className: "right-[6%] top-[12%]", delay: "0s" },
  { emoji: "🍔", className: "left-[8%] top-[22%]", delay: "0.8s" },
  { emoji: "🥤", className: "right-[12%] bottom-[18%]", delay: "1.6s" },
  { emoji: "🍰", className: "left-[14%] bottom-[12%]", delay: "2.4s" },
  { emoji: "🍟", className: "right-[42%] top-[8%]", delay: "3.2s" },
];

export function HeroSection({ dishCount }: { dishCount: number }) {
  return (
    <section className="hero-glow relative flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center overflow-hidden px-6 text-center">
      {FLOATERS.map((f) => (
        <span
          key={f.emoji}
          aria-hidden
          className={`animate-float absolute text-5xl opacity-40 blur-[1px] sm:text-7xl ${f.className}`}
          style={{ animationDelay: f.delay }}
        >
          {f.emoji}
        </span>
      ))}

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mb-4 rounded-full border border-line bg-surface/70 px-5 py-1.5 text-sm font-bold text-muted backdrop-blur"
      >
        مرحباً بكم في <span className="text-accent">{RESTAURANT_NAME}</span> 🎉
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="text-5xl font-black leading-tight sm:text-7xl"
      >
        <span className="text-gradient-accent">ألذّ المأكولات</span>
        <br />
        بين يديك الآن
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.25 }}
        className="mt-6 max-w-xl text-lg leading-relaxed text-muted"
      >
        تصفّح قائمتنا الإلكترونية واستكشف أطباقنا الشهية، من البيتزا الساخنة إلى
        البرجر المثالي والحلويات اللذيذة.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="mt-10"
      >
        <Link
          href="/menu"
          className="group relative inline-flex items-center gap-3 overflow-hidden rounded-full bg-accent px-10 py-4 text-lg font-black text-black shadow-lg shadow-accent/30 transition-transform hover:scale-105 active:scale-95"
        >
          <span className="relative z-10">تفقّد الآن</span>
          <span aria-hidden className="relative z-10 transition-transform group-hover:translate-x-1">
            ←
          </span>
          <span
            aria-hidden
            className="absolute inset-0 -translate-x-full bg-white/30 transition-transform duration-500 group-hover:translate-x-full"
          />
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="mt-12 flex items-center gap-3 text-sm font-bold text-muted"
      >
        <span>{dishCount} طبقاً شهياً</span>
        <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
        <span>جودة وسرعة</span>
        <span aria-hidden className="h-1 w-1 rounded-full bg-accent" />
        <span>بأسعار مناسبة</span>
      </motion.div>
    </section>
  );
}

export function CategoryCard({
  slug,
  nameAr,
  icon,
  imageUrl,
  productCount,
}: {
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
  productCount: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5 }}
      whileHover={{ y: -6 }}
    >
      <Link
        href={`/menu/${slug}`}
        className="group relative block aspect-square overflow-hidden rounded-3xl border border-line bg-card shadow-lg transition-colors hover:border-accent/60"
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt={nameAr}
              fill
              sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-card-2 text-6xl transition-transform duration-500 group-hover:scale-110">
            {icon}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-3.5 sm:p-4">
          <div className="flex items-center gap-2">
            {!imageUrl && <span aria-hidden className="text-base">{icon}</span>}
            <span className="text-lg font-black leading-tight text-white drop-shadow sm:text-xl">
              {nameAr}
            </span>
          </div>
          <span className="text-xs font-bold text-white/75 sm:text-sm">
            {productCount} طبق
          </span>
          <span className="mt-1 text-xs font-extrabold text-accent opacity-0 transition-opacity group-hover:opacity-100 sm:text-sm">
            استكشف ←
          </span>
        </div>
      </Link>
    </motion.div>
  );
}

export function ProductCard({
  product,
  ingredients = [],
}: {
  product: ProductRow;
  ingredients?: IngredientRow[];
}) {
  const { add, flyToCart } = useCart();
  const [added, setAdded] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const imageBoxRef = useRef<HTMLDivElement>(null);
  const available = product.isAvailable === 1;
  const hasIngredients = ingredients.length > 0;

  const flashAdded = () => {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1200);
  };

  const handleAdd = () => {
    add({
      productId: product.id,
      key: String(product.id),
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.imageUrl,
      extras: [],
      removed: [],
    });
    flashAdded();
    const box = imageBoxRef.current;
    if (box) flyToCart(box.getBoundingClientRect(), product.imageUrl, product.name);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45 }}
      whileHover={{ y: -6 }}
      className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-card shadow-lg transition-colors hover:border-accent/50"
    >
      <div ref={imageBoxRef} className="relative aspect-[4/3] overflow-hidden">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 100vw, 400px"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {!available && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/70 text-lg font-black text-white">
            غير متوفر حالياً
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-snug">{product.name}</h3>
          <span className="shrink-0 rounded-full bg-accent/15 px-3 py-1 text-sm font-black text-accent-strong">
            {formatPrice(product.priceCents)}
          </span>
        </div>
        {product.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-stretch gap-2">
          <button
            type="button"
            disabled={!available}
            onClick={handleAdd}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold transition-all ${
              added
                ? "bg-green-600 text-white"
                : available
                  ? "bg-accent text-black hover:brightness-110 active:scale-95"
                  : "cursor-not-allowed bg-card-2 text-muted"
            }`}
          >
            {added ? "✓ أُضيف إلى السلة" : available ? "أضف إلى السلة 🛒" : "غير متوفر"}
          </button>
          {hasIngredients && (
            <button
              type="button"
              disabled={!available}
              onClick={() => setCustomizing(true)}
              className="rounded-full border border-line px-4 py-2.5 text-sm font-extrabold text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              المكونات والإضافات
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {hasIngredients && customizing && (
          <ProductCustomizer
            key="customizer"
            product={product}
            ingredients={ingredients}
            onClose={() => setCustomizing(false)}
            onAdded={flashAdded}
          />
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function ProductCustomizer({
  product,
  ingredients,
  onClose,
  onAdded,
}: {
  product: ProductRow;
  ingredients: IngredientRow[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { add, flyToCart } = useCart();
  const base = ingredients.filter((i) => i.isExtra === 0);
  const extras = ingredients.filter((i) => i.isExtra === 1);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const unitPrice =
    product.priceCents +
    extras.filter((e) => picked.has(e.id)).reduce((s, e) => s + e.priceCents, 0);

  const toggleRemoved = (id: number) =>
    setRemoved((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const togglePicked = (id: number) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const handleConfirm = () => {
    const extraList = extras.filter((e) => picked.has(e.id));
    const removedList = base.filter((i) => removed.has(i.id) && i.isRequired !== 1);
    const key =
      extraList.length === 0 && removedList.length === 0
        ? String(product.id)
        : [
            product.id,
            extraList.map((e) => e.id).sort().join(","),
            removedList.map((i) => i.id).sort().join(","),
          ].join("|");
    add({
      productId: product.id,
      key,
      name: product.name,
      priceCents: unitPrice,
      imageUrl: product.imageUrl,
      extras: extraList.map((e) => ({ id: e.id, name: e.name, priceCents: e.priceCents })),
      removed: removedList.map((i) => ({ id: i.id, name: i.name })),
    });
    const btn = confirmBtnRef.current;
    if (btn) flyToCart(btn.getBoundingClientRect(), product.imageUrl, product.name);
    onClose();
    onAdded();
  };

  return (
    <motion.div
      key="customizer-root"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`تخصيص ${product.name}`}
    >
      <motion.div
        key="customizer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        key="customizer-panel"
        initial={{ y: "100%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-3xl"
      >
        <span
          aria-hidden
          className="mx-auto mt-3 block h-1.5 w-12 shrink-0 rounded-full bg-line sm:hidden"
        />

        <div className="flex-1 overflow-y-auto px-5 pb-6 pt-4 sm:px-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-2xl font-extrabold sm:text-3xl">{product.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
                خصّص طبقك: أزل المكونات أو أضف الإضافات كما تريد
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-muted transition-colors hover:text-foreground"
            >
              ✕
            </button>
          </div>

          <div
            className={
              base.length > 0 && extras.length > 0
                ? "mt-6 grid gap-8 sm:grid-cols-2 sm:items-start"
                : "mt-6 space-y-8"
            }
          >
            {base.length > 0 && (
              <section>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg" aria-hidden>🥗</span>
                  <h4 className="text-lg font-extrabold">المكونات</h4>
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-black text-accent-strong">
                    مشمولة في السعر
                  </span>
                </div>
                <p className="mb-3.5 text-xs leading-relaxed text-muted sm:text-sm">
                  هذه المكونات جزء من الطبق. اضغط على أي مكوّن لإزالته من طبقك.
                </p>
                <ul className="space-y-2.5">
                  {base.map((i) => {
                    const isRequired = i.isRequired === 1;
                    const selected = isRequired || !removed.has(i.id);
                    return (
                      <li key={i.id}>
                        <button
                          type="button"
                          onClick={() => toggleRemoved(i.id)}
                          disabled={isRequired}
                          aria-pressed={!selected}
                          className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-right transition-colors ${
                            selected
                              ? "border-line bg-card hover:border-accent/40"
                              : "border-red-500/40 bg-red-500/10"
                          } ${isRequired ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              aria-hidden
                              className={`h-2 w-2 shrink-0 rounded-full ${
                                selected ? "bg-green-500" : "bg-red-500"
                              }`}
                            />
                            <span className="font-bold">{i.name}</span>
                            {isRequired && (
                              <span className="text-xs font-black text-accent">🔒 إلزامي</span>
                            )}
                          </span>
                          <span
                            className={`text-xs font-extrabold ${
                              selected ? "text-green-400" : "text-red-400"
                            }`}
                          >
                            {isRequired ? "مشمول" : selected ? "مشمول ✓" : "محذوف ✗"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {extras.length > 0 && (
              <section>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-lg" aria-hidden>➕</span>
                  <h4 className="text-lg font-extrabold">الإضافات</h4>
                  <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-black text-accent-strong">
                    اختياري
                  </span>
                </div>
                <p className="mb-3.5 text-xs leading-relaxed text-muted sm:text-sm">
                  اختر أي عدد من الإضافات ويُضاف سعرها إلى الإجمالي.
                </p>
                <ul className="space-y-2.5">
                  {extras.map((e) => {
                    const isPicked = picked.has(e.id);
                    return (
                      <li key={e.id}>
                        <label
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                            isPicked
                              ? "border-accent bg-accent/15"
                              : "border-line bg-card hover:border-accent/40"
                          }`}
                        >
                          <span className="flex items-center gap-3">
                            <span
                              aria-hidden
                              className={`flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                                isPicked
                                  ? "border-accent bg-accent text-black"
                                  : "border-line bg-card-2"
                              }`}
                            >
                              {isPicked && <span className="text-xs font-black">✓</span>}
                            </span>
                            <input
                              type="checkbox"
                              checked={isPicked}
                              onChange={() => togglePicked(e.id)}
                              className="sr-only"
                            />
                            <span className="text-base font-bold">{e.name}</span>
                          </span>
                          <span className="text-sm font-black text-accent">
                            + {formatPrice(e.priceCents)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line px-5 py-4 sm:px-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-base font-bold text-muted">الإجمالي</span>
            <motion.span
              key={unitPrice}
              initial={{ scale: 1.12 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="text-3xl font-black text-accent"
            >
              {formatPrice(unitPrice)}
            </motion.span>
          </div>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-full bg-accent py-4 text-lg font-extrabold text-black transition-transform hover:brightness-110 active:scale-95"
          >
            أضف إلى السلة 🛒
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
