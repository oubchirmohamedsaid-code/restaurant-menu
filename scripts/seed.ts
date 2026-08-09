import "dotenv/config";
import {
  clearAll,
  createCategory,
  createIngredient,
  createProduct,
} from "../lib/db";
import { logger } from "../lib/logger";

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`;

interface SeedProduct {
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  ingredients?: { name: string; priceCents: number; isExtra: number; isRequired?: number }[];
}

interface SeedCategory {
  slug: string;
  nameAr: string;
  icon: string;
  imageUrl: string;
  products: SeedProduct[];
}

const seed: SeedCategory[] = [
  {
    slug: "drinks",
    nameAr: "المشروبات",
    icon: "🥤",
    imageUrl: img("photo-1544145945-f90425340c7e"),
    products: [
      { name: "عصير مانجو طازج", description: "مانجو طبيعي 100% بدون سكر مضاف", priceCents: 1200, imageUrl: img("photo-1544145945-f90425340c7e") },
      { name: "سموذي فراولة", description: "فراولة مجمّدة مع حليب وثلج", priceCents: 1400, imageUrl: img("photo-1551024709-8f23befc6f87") },
      { name: "قهوة عربية", description: "قهوة هيل فاخرة مع تمر", priceCents: 800, imageUrl: img("photo-1437418747212-8d9709afab22") },
      { name: "عصير برتقال طازج", description: "برتقال مضغوط على الطلب", priceCents: 1000, imageUrl: img("photo-1600271886742-f049cd451bba") },
      { name: "موهيتو نعناع", description: "نعناع وليمون وصودا منعشة", priceCents: 1100, imageUrl: img("photo-1551538827-9c037cb4f32a") },
    ],
  },
  {
    slug: "pizza",
    nameAr: "البيتزا",
    icon: "🍕",
    imageUrl: img("photo-1513104890138-7c749659a591"),
    products: [
      {
        name: "بيتزا مارغريتا",
        description: "صلصة طماطم وموزاريلا وريحان",
        priceCents: 2800,
        imageUrl: img("photo-1513104890138-7c749659a591"),
        ingredients: [
          { name: "صلصة طماطم", priceCents: 0, isExtra: 0, isRequired: 1 },
          { name: "موزاريلا", priceCents: 0, isExtra: 0 },
          { name: "ريحان", priceCents: 0, isExtra: 0 },
          { name: "جبنة إضافية", priceCents: 400, isExtra: 1 },
          { name: "مشروم", priceCents: 250, isExtra: 1 },
          { name: "زيتون", priceCents: 150, isExtra: 1 },
        ],
      },
      { name: "بيتزا بيبروني", description: "بيبروني حار وجبنة موزاريلا", priceCents: 3400, imageUrl: img("photo-1628840042765-356cda07504e") },
      { name: "بيتزا خضار", description: "فلفل ملون وزيتون ومشروم", priceCents: 3000, imageUrl: img("photo-1574071318508-1cdbab80d002") },
      { name: "بيتزا ريكوتا وجرجير", description: "ريكوتا كريمية وجرجير طازج", priceCents: 3600, imageUrl: img("photo-1565299624946-b28f40a0ae38") },
    ],
  },
  {
    slug: "burgers",
    nameAr: "البرجر",
    icon: "🍔",
    imageUrl: img("photo-1568901346375-23c9450c58cd"),
    products: [
      {
        name: "كلاسيك تشيز برجر",
        description: "لحم أنجوس وشيدر وخس وطماطم",
        priceCents: 2200,
        imageUrl: img("photo-1568901346375-23c9450c58cd"),
        ingredients: [
          { name: "لحم أنجوس", priceCents: 0, isExtra: 0, isRequired: 1 },
          { name: "خس", priceCents: 0, isExtra: 0 },
          { name: "طماطم", priceCents: 0, isExtra: 0 },
          { name: "بصل", priceCents: 0, isExtra: 0 },
          { name: "جبنة إضافية", priceCents: 300, isExtra: 1 },
          { name: "بيبروني", priceCents: 250, isExtra: 1 },
          { name: "صوص إضافي", priceCents: 100, isExtra: 1 },
        ],
      },
      { name: "دبل برجر", description: "شريحتان لحم وجبنة مزدوجة", priceCents: 2900, imageUrl: img("photo-1553979459-d2229ba7433b") },
      { name: "برجر دجاج مقرمش", description: "صدر دجاج مقرمش مع صوص الثوم", priceCents: 2100, imageUrl: img("photo-1606755962773-d324e0a13086") },
      { name: "برجر نباتي", description: "قرص فلافل وخضار مشوية", priceCents: 1900, imageUrl: img("photo-1520072959219-c595dc870360") },
      { name: "برجر مشروم", description: "مشروم سوتيه وجبنة سويسرية", priceCents: 2600, imageUrl: img("photo-1561758033-d89a9ad46330") },
    ],
  },
  {
    slug: "desserts",
    nameAr: "الحلويات",
    icon: "🍰",
    imageUrl: img("photo-1551024709-8f23befc6f87"),
    products: [
      { name: "تشيز كيك التوت", description: "تشيز كيك ناعم مع صوص التوت", priceCents: 1800, imageUrl: img("photo-1567327613485-b9b1bbd44c0b") },
      { name: "براونيز بالشوكولاتة", description: "براونيز غني مع آيس كريم فانيليا", priceCents: 1600, imageUrl: img("photo-1606313564200-e75d5e30476c") },
      { name: "آيس كريم بالمكسرات", description: "آيس كريم فاخر مع مكسرات محمصة", priceCents: 1300, imageUrl: img("photo-1563805042-7684c019e1cb") },
      { name: "كنافة بالقشطة", description: "كنافة ذهبية مع قشطة طازجة", priceCents: 1700, imageUrl: img("photo-1546069901-ba9599a7e63c") },
      { name: "بان كيك بالعسل", description: "بان كيك طرية مع عسل وزبدة", priceCents: 1500, imageUrl: img("photo-1562376552-0d160a2f238d") },
    ],
  },
];

async function main() {
  let total = 0;
  await clearAll();
  for (let ci = 0; ci < seed.length; ci++) {
    const cat = seed[ci];
    const categoryId = await createCategory({
      slug: cat.slug,
      nameAr: cat.nameAr,
      icon: cat.icon,
      imageUrl: cat.imageUrl,
      sortOrder: ci,
    });
    for (const p of cat.products) {
      const productId = await createProduct({ ...p, categoryId, isAvailable: 1 });
      total += 1;
      for (const ing of p.ingredients ?? []) {
        await createIngredient(productId, ing.name, ing.priceCents, ing.isExtra, ing.isRequired ?? 0);
      }
    }
  }

  logger.info("seed complete", { categories: seed.length, products: total });
  console.log(`Seeded ${seed.length} categories and ${total} products`);
}

main();
