import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UsersManager from "./users-manager";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/admin/users");
  }
  if (session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const currentUserLabel = session.user.name || session.user.email || "";
  return (
    <UsersManager
      currentUserId={session.user.id}
      currentUserLabel={currentUserLabel}
    />
  );
}
