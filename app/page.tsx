import { HeroSection } from "@/components/menu-ui";
import { countAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { products } = await countAll();
  return <HeroSection dishCount={products} />;
}
