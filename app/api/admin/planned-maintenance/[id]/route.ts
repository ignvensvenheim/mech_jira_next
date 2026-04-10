import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";

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
  const machineKey = String(body?.machineKey || "").trim();
  const title = String(body?.title || "").trim();
  const dueDate = String(body?.dueDate || "").trim();
  const note = String(body?.note || "").trim();
  const cost =
    body && "cost" in (body as object) && body?.cost !== null && body?.cost !== ""
      ? Number(body.cost)
      : undefined;
  const isCompleted =
    typeof body?.isCompleted === "boolean" ? body.isCompleted : undefined;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const data: {
    machineKey?: string;
    title?: string;
    dueDate?: Date;
    note?: string | null;
    cost?: number | null;
    isCompleted?: boolean;
    completedAt?: Date | null;
  } = {};

  if (machineKey) {
    if (!isConcreteMachineKey(machineKey)) {
      return NextResponse.json(
        { error: "machineKey must reference a concrete asset" },
        { status: 400 }
      );
    }
    await ensureAssetExists(prisma, machineKey, session.user.id);
    data.machineKey = machineKey;
  }
  if (title) data.title = title;
  if (dueDate) {
    const parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: "dueDate is invalid" }, { status: 400 });
    }
    data.dueDate = parsedDueDate;
  }
  if (body && "note" in (body as object)) data.note = note || null;
  if (body && "cost" in (body as object)) {
    if (typeof cost === "number" && (!Number.isFinite(cost) || cost < 0)) {
      return NextResponse.json({ error: "cost is invalid" }, { status: 400 });
    }
    data.cost = typeof cost === "number" ? cost : null;
  }
  if (typeof isCompleted === "boolean") {
    data.isCompleted = isCompleted;
    data.completedAt = isCompleted ? new Date() : null;
  }

  const item = await prisma.plannedMaintenance.update({
    where: { id },
    data,
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

  await prisma.plannedMaintenance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
