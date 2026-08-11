import { join } from "node:path";
import { tmpdir } from "node:os";

process.env.OGT_DATA_DIR = join(tmpdir(), "ogt-tests", `auth-${Date.now()}`);

async function main() {
  const assert = (await import("node:assert/strict")).default;
  const { hashPassword, verifyPassword } = await import("../src/main/auth");
  const {
    countUsers,
    createUser,
    getUserById,
    getUserByUsername,
    updateUserRole,
    deleteUser,
    toPublic,
  } = await import("../../lib/users");

  const h = hashPassword("SuperSecret123");
  assert.ok(h.startsWith("scrypt:16384:8:1:"), "hash uses scrypt format");
  assert.ok(!h.includes("SuperSecret123"), "no plaintext password stored");
  assert.equal(verifyPassword("SuperSecret123", h), true, "correct password verifies");
  assert.equal(verifyPassword("wrong-password", h), false, "wrong password rejected");
  assert.equal(
    verifyPassword("SuperSecret123", h.slice(0, -3) + "abc"),
    false,
    "tampered hash rejected",
  );
  const h2 = hashPassword("SuperSecret123");
  assert.notEqual(h, h2, "unique salt per hash");

  const before = await countUsers();
  const id = await createUser({
    fullName: "Owner Test",
    username: "owner_test",
    passwordHash: h,
    role: "OWNER",
  });
  assert.equal(await countUsers(), before + 1, "user created");

  const row = await getUserById(id);
  assert.ok(row, "get user by id");
  assert.equal(row!.username, "owner_test");
  assert.equal(row!.role, "OWNER");

  const byName = await getUserByUsername("owner_test");
  assert.ok(byName, "get user by username");

  const pub = toPublic(row!);
  assert.ok(!("passwordHash" in pub), "password hash never exposed");

  await updateUserRole(id, "ADMIN");
  assert.equal((await getUserById(id))!.role, "ADMIN", "role updated");

  await deleteUser(id);
  assert.equal(await countUsers(), before, "user deleted");

  console.log("test-auth: PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
