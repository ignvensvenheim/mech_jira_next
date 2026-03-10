import { NextResponse } from "next/server";
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
  const date = String(body?.date || "").trim();
  const amount = Number(body?.amount);
  const comment = String(body?.comment || "").trim();

  if (!id || !date || !comment) {
    return NextResponse.json(
      { error: "id, date and comment are required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }

  const entry = await prisma.manualEntry.update({
    where: { id },
    data: { date, amount, comment },
    select: {
      id: true,
      date: true,
      amount: true,
      comment: true,
      createdAt: true,
    },
  });

  return NextResponse.json(entry);
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

  await prisma.manualEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
