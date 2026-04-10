import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await prisma.plannedMaintenance.findMany({
    orderBy: [{ isCompleted: "asc" }, { dueDate: "asc" }],
    select: {
      id: true,
      machineKey: true,
      title: true,
      dueDate: true,
      note: true,
      cost: true,
      isCompleted: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const machineKey = String(body?.machineKey || "").trim();
  const title = String(body?.title || "").trim();
  const dueDate = String(body?.dueDate || "").trim();
  const note = String(body?.note || "").trim();
  const cost =
    body && "cost" in (body as object) && body?.cost !== null && body?.cost !== ""
      ? Number(body.cost)
      : null;

  if (!machineKey || !title || !dueDate) {
    return NextResponse.json(
      { error: "machineKey, title and dueDate are required" },
      { status: 400 }
    );
  }
  if (!isConcreteMachineKey(machineKey)) {
    return NextResponse.json(
      { error: "machineKey must reference a concrete asset" },
      { status: 400 }
    );
  }

  const parsedDueDate = new Date(dueDate);
  if (Number.isNaN(parsedDueDate.getTime())) {
    return NextResponse.json({ error: "dueDate is invalid" }, { status: 400 });
  }
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    return NextResponse.json({ error: "cost is invalid" }, { status: 400 });
  }

  await ensureAssetExists(prisma, machineKey, session.user.id);

  const item = await prisma.plannedMaintenance.create({
    data: {
      machineKey,
      title,
      dueDate: parsedDueDate,
      cost,
      note: note || null,
    },
    select: {
      id: true,
      machineKey: true,
      title: true,
      dueDate: true,
      note: true,
      cost: true,
      isCompleted: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(item);
}
