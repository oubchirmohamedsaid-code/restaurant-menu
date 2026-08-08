import { redirect } from "next/navigation";
import { CategoryListView } from "@/components/admin-ui";
import { listCategoriesWithCounts } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isAdmin } from "../actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!(await isAdmin())) redirect("/admin");

  const categories = await listCategoriesWithCounts();
  logger.info("dashboard rendered", { categories: categories.length });

  return <CategoryListView categories={categories} />;
}
