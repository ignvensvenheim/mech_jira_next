import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const machineKey = String(body?.machineKey || "").trim();
  const date = String(body?.date || "").trim();
  const amount = Number(body?.amount);
  const comment = String(body?.comment || "").trim();

  if (!machineKey || !date || !comment) {
    return NextResponse.json(
      { error: "machineKey, date and comment are required" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount must be > 0" }, { status: 400 });
  }

  const entry = await prisma.manualEntry.create({
    data: {
      machineKey,
      date,
      amount,
      comment,
      createdById: session.user.id,
    },
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
