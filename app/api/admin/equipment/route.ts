import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

type EquipmentDetailRow = {
  machineKey: string;
  model: string;
  serialNumber: string;
  manufacturer: string;
  updatedAt: Date;
};

function isMissingEquipmentTable(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== "P2010") return false;
  const meta = error.meta as { code?: string } | undefined;
  return meta?.code === "42P01";
}

export async function GET(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const machineKey = String(searchParams.get("machineKey") || "").trim();
  if (!machineKey) {
    return NextResponse.json({ error: "machineKey is required" }, { status: 400 });
  }

  try {
    const rows = await prisma.$queryRaw<EquipmentDetailRow[]>(
      Prisma.sql`
        SELECT
          "machineKey",
          "model",
          "serialNumber",
          "manufacturer",
          "updatedAt"
        FROM "EquipmentDetail"
        WHERE "machineKey" = ${machineKey}
        LIMIT 1
      `
    );
    const equipment = rows[0];

    return NextResponse.json({
      machineKey,
      model: equipment?.model ?? "",
      serialNumber: equipment?.serialNumber ?? "",
      manufacturer: equipment?.manufacturer ?? "",
      updatedAt: equipment?.updatedAt ?? null,
    });
  } catch (error: unknown) {
    if (isMissingEquipmentTable(error)) {
      return NextResponse.json({
        machineKey,
        model: "",
        serialNumber: "",
        manufacturer: "",
        updatedAt: null,
      });
    }
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const machineKeys = Array.isArray(body?.machineKeys)
    ? body.machineKeys
        .map((v: unknown) => String(v || "").trim())
        .filter((v: string) => Boolean(v))
    : [];

  if (machineKeys.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await prisma.$queryRaw<EquipmentDetailRow[]>(
      Prisma.sql`
        SELECT
          "machineKey",
          "model",
          "serialNumber",
          "manufacturer",
          "updatedAt"
        FROM "EquipmentDetail"
        WHERE "machineKey" IN (${Prisma.join(machineKeys)})
      `
    );

    return NextResponse.json({ items });
  } catch (error: unknown) {
    if (isMissingEquipmentTable(error)) {
      return NextResponse.json({ items: [] });
    }
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = randomUUID();

  const body = await req.json().catch(() => null);
  const machineKey = String(body?.machineKey || "").trim();
  const model = String(body?.model || "").trim();
  const serialNumber = String(body?.serialNumber || "").trim();
  const manufacturer = String(body?.manufacturer || "").trim();

  if (!machineKey || !model || !serialNumber || !manufacturer) {
    return NextResponse.json(
      {
        error:
          "machineKey, model, serialNumber and manufacturer are required",
      },
      { status: 400 }
    );
  }

  try {
    const rows = await prisma.$queryRaw<EquipmentDetailRow[]>(
      Prisma.sql`
        INSERT INTO "EquipmentDetail"
          ("id", "machineKey", "model", "serialNumber", "manufacturer", "updatedAt", "updatedById")
        VALUES
          (${id}, ${machineKey}, ${model}, ${serialNumber}, ${manufacturer}, NOW(), ${
        session.user.id || null
      })
        ON CONFLICT ("machineKey")
        DO UPDATE SET
          "model" = EXCLUDED."model",
          "serialNumber" = EXCLUDED."serialNumber",
          "manufacturer" = EXCLUDED."manufacturer",
          "updatedById" = EXCLUDED."updatedById",
          "updatedAt" = NOW()
        RETURNING
          "machineKey",
          "model",
          "serialNumber",
          "manufacturer",
          "updatedAt"
      `
    );
    const equipment = rows[0];

    return NextResponse.json(equipment);
  } catch (error: unknown) {
    if (isMissingEquipmentTable(error)) {
      return NextResponse.json(
        {
          error:
            "Equipment table is missing. Run database migrations before saving inventory.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}
