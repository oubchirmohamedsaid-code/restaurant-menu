import { CategoryCard } from "@/components/menu-ui";
import { listCategoriesWithCounts } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export const metadata = { title: "المنيو | مطعم الذواقة" };

export default async function MenuPage() {
  const categories = await listCategoriesWithCounts();
  const visible = categories.filter((c) => c.isHidden === 0);
  logger.info("menu page rendered", { categories: visible.length });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-10 text-center">
        <p className="mb-2 text-sm font-bold text-accent">قائمتنا</p>
        <h1 className="text-4xl font-black sm:text-5xl">اختر من الأصناف</h1>
        <p className="mt-3 text-muted">اضغط على أي صنف لتشاهد منتجاته</p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
        {visible.map((c) => (
          <CategoryCard
            key={c.id}
            slug={c.slug}
            nameAr={c.nameAr}
            icon={c.icon}
            imageUrl={c.imageUrl}
            productCount={c.productCount}
          />
        ))}
      </div>
    </div>
  );
}
