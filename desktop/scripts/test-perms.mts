async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { permissionsFor, roleCanAccess, canManageOrders, canManageCashbox, canManageMenu, canManageStock, SECTIONS } = await import("../../lib/perms");

  const owner = permissionsFor("OWNER");
  assert.equal(owner.canManageUsers, true, "OWNER can manage users");
  for (const s of SECTIONS) assert.equal(roleCanAccess("OWNER", s), true, `OWNER: ${s}`);
  assert.equal(canManageOrders("OWNER"), true, "OWNER can manage orders");
  assert.equal(canManageCashbox("OWNER"), true, "OWNER can manage cashbox");
  assert.equal(canManageMenu("OWNER"), true, "OWNER can manage menu");
  assert.equal(canManageStock("OWNER"), true, "OWNER can manage stock");

  const admin = permissionsFor("ADMIN");
  assert.equal(admin.canManageUsers, false, "ADMIN cannot manage users");
  for (const s of SECTIONS) assert.equal(roleCanAccess("ADMIN", s), true, `ADMIN: ${s}`);
  assert.equal(canManageOrders("ADMIN"), true, "ADMIN can manage orders");
  assert.equal(canManageCashbox("ADMIN"), true, "ADMIN can manage cashbox");
  assert.equal(canManageMenu("ADMIN"), true, "ADMIN can manage menu");
  assert.equal(canManageStock("ADMIN"), true, "ADMIN can manage stock");

  const employee = permissionsFor("EMPLOYEE");
  assert.equal(employee.canManageUsers, false, "EMPLOYEE cannot manage users");
  for (const s of SECTIONS) {
    assert.equal(
      roleCanAccess("EMPLOYEE", s),
      s === "orders" || s === "cashbox" || s === "stock",
      `EMPLOYEE: ${s}`,
    );
  }
  assert.equal(canManageOrders("EMPLOYEE"), false, "EMPLOYEE cannot manage orders");
  assert.equal(canManageCashbox("EMPLOYEE"), false, "EMPLOYEE cannot manage cashbox");
  assert.equal(canManageMenu("EMPLOYEE"), false, "EMPLOYEE cannot manage menu");
  assert.equal(canManageStock("EMPLOYEE"), false, "EMPLOYEE cannot manage stock");

  console.log("test-perms: PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
