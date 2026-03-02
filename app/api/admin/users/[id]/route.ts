import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json().catch(() => null);

  const email = String(body?.email || "").trim().toLowerCase();
  const name = String(body?.name || "").trim();
  const roleRaw = String(body?.role || "").trim().toUpperCase();
  const password = String(body?.password || "");

  if (!id || !email) {
    return NextResponse.json({ error: "id and email are required" }, { status: 400 });
  }

  const role = roleRaw === "ADMIN" ? UserRole.ADMIN : UserRole.USER;
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }

  const emailTaken = await prisma.user.findFirst({
    where: {
      email,
      id: { not: id },
    },
    select: { id: true },
  });
  if (emailTaken) {
    return NextResponse.json({ error: "email already in use" }, { status: 409 });
  }

  if (existing.id === session.user.id && role !== UserRole.ADMIN) {
    return NextResponse.json(
      { error: "you cannot remove your own admin role" },
      { status: 400 }
    );
  }

  const passwordHash =
    password.trim().length > 0 ? await bcrypt.hash(password, 10) : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      email,
      name: name || null,
      role,
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (id === session.user.id) {
    return NextResponse.json(
      { error: "you cannot delete your own account" },
      { status: 400 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
