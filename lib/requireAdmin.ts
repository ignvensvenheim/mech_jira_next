import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { isSuperAdminIdentity } from "@/lib/superAdmin";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!dbUser) return null;

  const isSuperAdmin = isSuperAdminIdentity(dbUser);
  if (!isSuperAdmin && dbUser.role !== UserRole.ADMIN) return null;

  if (isSuperAdmin && dbUser.role !== UserRole.ADMIN) {
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { role: UserRole.ADMIN },
    });
  }

  return session;
}
