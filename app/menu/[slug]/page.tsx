import { notFound } from "next/navigation";
import { ProductCard } from "@/components/menu-ui";
import {
  getCategoryBySlug,
  listIngredientsByProduct,
  listProductsByCategory,
} from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) {
    logger.warn("category not found", { slug });
    notFound();
  }

  const products = (await listProductsByCategory(category.id)).filter(
    (p) => p.isHidden !== 1,
  );
  const ingredientsByProduct = new Map(
    await Promise.all(
      products.map(async (p) => [p.id, await listIngredientsByProduct(p.id)] as const),
    ),
  );
  logger.info("category page rendered", { slug, products: products.length });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 text-center">
        <span className="mb-3 inline-block text-6xl drop-shadow-lg" aria-hidden>
          {category.icon}
        </span>
        <h1 className="text-4xl font-black sm:text-5xl">{category.nameAr}</h1>
        <p className="mt-3 text-muted">{products.length} طبق</p>
      </header>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={p}
            ingredients={ingredientsByProduct.get(p.id) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
