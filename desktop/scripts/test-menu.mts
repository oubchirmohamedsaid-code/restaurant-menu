import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.OGT_DATA_DIR = join(tmpdir(), "ogt-tests", `menu-${Date.now()}`);

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const db = await import("../../lib/db");

  const catId = await db.createCategory({
    slug: "drinks",
    nameAr: "المشروبات",
    icon: "🥤",
    imageUrl: "",
    sortOrder: 0,
  });
  const catId2 = await db.createCategory({
    slug: "pizza",
    nameAr: "البيتزا",
    icon: "🍕",
    imageUrl: "",
    sortOrder: 1,
  });
  const cats = await db.listCategories();
  assert.equal(cats.length, 2, "categories created");

  const prodId = await db.createProduct({
    categoryId: catId,
    name: "عصير برتقال",
    description: "طازج",
    priceCents: 1500,
    imageUrl: "",
    isAvailable: 1,
  });
  const prodId2 = await db.createProduct({
    categoryId: catId,
    name: "ميلك شيك",
    description: "",
    priceCents: 2500,
    imageUrl: "",
    isAvailable: 1,
  });

  await db.reorderProducts(catId, [prodId2, prodId]);
  const sorted = await db.listProductsByCategory(catId);
  assert.equal(sorted[0].id, prodId2, "reorderProducts applies order");

  await db.setProductHidden(prodId, 1);
  assert.equal((await db.getProductById(prodId))!.isHidden, 1, "setProductHidden works");
  await db.setProductHidden(prodId, 0);

  const ingId = await db.createIngredient(prodId, "مكعبات ثلج", 0, 0, 0);
  const extraId = await db.createIngredient(prodId, "حليب", 500, 1, 0);
  assert.equal((await db.listIngredientsByProduct(prodId)).length, 2, "ingredients listed");

  const grp1 = await db.createAddonGroup("الحجم");
  const grp2 = await db.createAddonGroup("إضافات خاصة");
  const groups = await db.listAddonGroupsWithOptions();
  assert.equal(groups.length, 2, "addon groups created");
  assert.equal(groups[0].productCount, 0, "no products linked yet");

  const opt1 = await db.addAddonOption(grp1, "صغير", 0);
  const opt2 = await db.addAddonOption(grp1, "كبير", 1000);
  await db.addAddonOption(grp2, "شوكولاتة", 800);
  const withOpts = await db.listAddonGroupsWithOptions();
  assert.equal(withOpts.find((g) => g.id === grp1)!.options.length, 2, "group options listed");
  await db.updateAddonOption(opt2, "كبير جداً", 1200);
  assert.equal(
    (await db.listAddonGroupsWithOptions()).find((g) => g.id === grp1)!.options.find((o) => o.id === opt2)!.priceCents,
    1200,
    "updateAddonOption works",
  );

  await db.updateAddonGroup(grp2, "إضافات الحلويات", 0);
  assert.equal(
    (await db.listAddonGroupsWithOptions()).find((g) => g.id === grp2)!.isActive,
    0,
    "updateAddonGroup works",
  );

  await db.setProductAddonGroups(prodId, [grp1, grp2]);
  assert.deepEqual(await db.listProductAddonGroupIds(prodId), [grp1, grp2], "groups linked in order");
  const linked = await db.listAddonGroupsWithOptions();
  assert.equal(linked.find((g) => g.id === grp1)!.productCount, 1, "productCount counts links");

  await db.setProductAddonGroups(prodId, [grp2]);
  assert.deepEqual(await db.listProductAddonGroupIds(prodId), [grp2], "re-set replaces links");

  const snapshot = await db.getMenuSnapshot();
  assert.equal(snapshot.length, 2, "snapshot has categories");
  const catSnap = snapshot.find((c) => c.id === catId)!;
  assert.equal(catSnap.products.length, 2, "snapshot category products");
  const prodSnap = catSnap.products.find((p) => p.id === prodId)!;
  assert.equal(prodSnap.ingredients.length, 2, "snapshot product ingredients");
  assert.deepEqual(prodSnap.addonGroupIds, [grp2], "snapshot addon group ids");

  await db.deleteAddonOption(opt1);
  assert.equal(
    (await db.listAddonGroupsWithOptions()).find((g) => g.id === grp1)!.options.length,
    1,
    "deleteAddonOption works",
  );

  await db.deleteAddonGroup(grp1);
  const afterGroupDelete = await db.listAddonGroupsWithOptions();
  assert.equal(afterGroupDelete.length, 1, "deleteAddonGroup removes group");
  assert.deepEqual(await db.listProductAddonGroupIds(prodId), [grp2], "other links survive group delete");

  await db.deleteIngredient(extraId);
  assert.equal((await db.listIngredientsByProduct(prodId)).length, 1, "deleteIngredient works");

  await db.reorderCategories([catId2, catId]);
  const reordered = await db.listCategories();
  assert.equal(reordered[0].id, catId2, "reorderCategories applies order");

  await db.deleteCategory(catId);
  const afterDelete = await db.listCategories();
  assert.equal(afterDelete.length, 1, "deleteCategory removes category");
  assert.equal(await db.getProductById(prodId), undefined, "category delete cascades to products");

  await db.updateCategory(catId2, { nameAr: "بيتزا ومشروبات", isHidden: 1 });
  const updatedCat = await db.listCategories();
  assert.equal(updatedCat[0].nameAr, "بيتزا ومشروبات", "updateCategory works");
  assert.equal(updatedCat[0].isHidden, 1, "category hide flag applied");

  console.log("test-menu: PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
