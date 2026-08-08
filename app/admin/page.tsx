import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-ui";
import { isAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin/dashboard");

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4">
      <AdminLoginForm />
    </div>
  );
}
