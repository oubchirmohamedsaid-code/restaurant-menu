import { HeroSection } from "@/components/menu-ui";
import { countAll } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const { products } = countAll();
  return <HeroSection dishCount={products} />;
}
