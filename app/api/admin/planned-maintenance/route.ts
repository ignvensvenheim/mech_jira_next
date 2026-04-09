import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";

type PlannedMaintenanceRow = {
  id: string;
  machineKey: string;
  title: string;
  dueDate: Date;
  note: string | null;
  cost: number | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function serializePlannedMaintenance(item: PlannedMaintenanceRow) {
  return {
    ...item,
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

function selectSql(withCost: boolean) {
  return withCost
    ? Prisma.sql`
        SELECT
          "id",
          "machineKey",
          "title",
          "dueDate",
          "note",
          "cost",
          "isCompleted",
          "completedAt",
          "createdAt",
          "updatedAt"
        FROM "PlannedMaintenance"
      `
    : Prisma.sql`
        SELECT
          "id",
          "machineKey",
          "title",
          "dueDate",
          "note",
          NULL::DOUBLE PRECISION AS "cost",
          "isCompleted",
          "completedAt",
          "createdAt",
          "updatedAt"
        FROM "PlannedMaintenance"
      `;
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const withCost = await hasCostColumn();
  const items = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
    Prisma.sql`${selectSql(withCost)} ORDER BY "isCompleted" ASC, "dueDate" ASC`
  );

  return NextResponse.json({ items: items.map(serializePlannedMaintenance) });
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
  const costRaw = body?.cost;
  const cost =
    costRaw === "" || costRaw === null || typeof costRaw === "undefined"
      ? null
      : Number(costRaw);

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

  const parsedDueDate = parseDateOnly(dueDate);
  if (!parsedDueDate) {
    return NextResponse.json({ error: "dueDate is invalid" }, { status: 400 });
  }
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    return NextResponse.json({ error: "cost must be >= 0" }, { status: 400 });
  }

  await ensureAssetExists(prisma, machineKey, session.user.id);

  const withCost = await hasCostColumn();
  const rows = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
    withCost
      ? Prisma.sql`
          INSERT INTO "PlannedMaintenance" (
            "id",
            "machineKey",
            "title",
            "dueDate",
            "note",
            "cost",
            "isCompleted",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${machineKey},
            ${title},
            ${parsedDueDate},
            ${note || null},
            ${cost},
            false,
            NOW(),
            NOW()
          )
          RETURNING
            "id",
            "machineKey",
            "title",
            "dueDate",
            "note",
            "cost",
            "isCompleted",
            "completedAt",
            "createdAt",
            "updatedAt"
        `
      : Prisma.sql`
          INSERT INTO "PlannedMaintenance" (
            "id",
            "machineKey",
            "title",
            "dueDate",
            "note",
            "isCompleted",
            "createdAt",
            "updatedAt"
          )
          VALUES (
            ${crypto.randomUUID()},
            ${machineKey},
            ${title},
            ${parsedDueDate},
            ${note || null},
            false,
            NOW(),
            NOW()
          )
          RETURNING
            "id",
            "machineKey",
            "title",
            "dueDate",
            "note",
            NULL::DOUBLE PRECISION AS "cost",
            "isCompleted",
            "completedAt",
            "createdAt",
            "updatedAt"
        `
  );

  return NextResponse.json(serializePlannedMaintenance(rows[0]));
}
