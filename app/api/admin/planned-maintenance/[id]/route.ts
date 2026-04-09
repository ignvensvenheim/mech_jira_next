import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";

function serializePlannedMaintenance(item: {
  id: string;
  machineKey: string;
  title: string;
  dueDate: Date;
  note: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  cost?: number | null;
}) {
  return {
    ...item,
    cost: item.cost ?? null,
    dueDate: formatDateOnly(item.dueDate),
  };
}

async function hasCostColumn() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlannedMaintenance'
        AND column_name = 'cost'
    ) AS "exists"
  `;

  return rows[0]?.exists ?? false;
}

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
  const costRaw = body?.cost;
  const cost =
    costRaw === "" || costRaw === null || typeof costRaw === "undefined"
      ? null
      : Number(costRaw);
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
    const parsedDueDate = parseDateOnly(dueDate);
    if (!parsedDueDate) {
      return NextResponse.json({ error: "dueDate is invalid" }, { status: 400 });
    }
    data.dueDate = parsedDueDate;
  }
  if (body && "note" in (body as object)) data.note = note || null;
  if (typeof isCompleted === "boolean") {
    data.isCompleted = isCompleted;
    data.completedAt = isCompleted ? new Date() : null;
  }

  const updated = await prisma.plannedMaintenance.update({
    where: { id },
    data,
    select: {
      id: true,
      machineKey: true,
      title: true,
      dueDate: true,
      note: true,
      isCompleted: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  let resolvedCost: number | null = null;
  const withCost = await hasCostColumn();

  if (body && "cost" in (body as object) && withCost) {
    if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
      return NextResponse.json({ error: "cost must be >= 0" }, { status: 400 });
    }

    const rows = await prisma.$queryRaw<Array<{ cost: number | null }>>`
      UPDATE "PlannedMaintenance"
      SET "cost" = ${cost}
      WHERE "id" = ${id}
      RETURNING "cost"
    `;
    resolvedCost = rows[0]?.cost ?? null;
  } else if (withCost) {
    const rows = await prisma.$queryRaw<Array<{ cost: number | null }>>`
      SELECT "cost"
      FROM "PlannedMaintenance"
      WHERE "id" = ${id}
    `;
    resolvedCost = rows[0]?.cost ?? null;
  }

  return NextResponse.json(
    serializePlannedMaintenance({
      ...updated,
      cost: resolvedCost,
    })
  );
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
