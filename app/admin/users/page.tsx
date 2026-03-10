import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireAdmin } from "@/lib/requireAdmin";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/users");
  }

  const adminSession = await requireAdmin();
  if (!adminSession) {
    redirect("/admin");
  }

  redirect("/admin?view=users");
}
