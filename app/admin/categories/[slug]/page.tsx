import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { CategoryView } from "@/components/admin-ui";
import {
  listCategoriesWithCounts,
  listIngredientsByProduct,
  listProductsByCategory,
} from "@/lib/db";
import { logger } from "@/lib/logger";
import { isAdmin } from "../../actions";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin");

  const { slug } = await params;
  const categories = await listCategoriesWithCounts();
  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const products = await Promise.all(
    (await listProductsByCategory(category.id)).map(async (p) => ({
      ...p,
      ingredients: await listIngredientsByProduct(p.id),
    })),
  );
  logger.info("category rendered", { slug, products: products.length });

  return <CategoryView category={category} products={products} />;
}
