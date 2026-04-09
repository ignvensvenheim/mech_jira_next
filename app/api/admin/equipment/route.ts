import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";

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
  const asset = await prisma.asset.findUnique({
    where: { machineKey },
    select: {
      machineKey: true,
      category: true,
      subcategory: true,
      model: true,
      serialNumber: true,
      manufacturer: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    machineKey,
    category: asset?.category ?? "",
    subcategory: asset?.subcategory ?? "",
    model: asset?.model ?? "",
    serialNumber: asset?.serialNumber ?? "",
    manufacturer: asset?.manufacturer ?? "",
    updatedAt: asset?.updatedAt ?? null,
  });
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
  const includeAll = body?.includeAll === true;

  if (!includeAll && machineKeys.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.asset.findMany({
    where: includeAll ? undefined : { machineKey: { in: machineKeys } },
    orderBy: [{ category: "asc" }, { subcategory: "asc" }, { machineKey: "asc" }],
    select: {
      machineKey: true,
      category: true,
      subcategory: true,
      model: true,
      serialNumber: true,
      manufacturer: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ items });
}

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  if (!isConcreteMachineKey(machineKey)) {
    return NextResponse.json(
      { error: "machineKey must reference a concrete asset" },
      { status: 400 }
    );
  }

  await ensureAssetExists(prisma, machineKey, session.user.id);

  const equipment = await prisma.asset.update({
    where: { machineKey },
    data: {
      model,
      serialNumber,
      manufacturer,
      updatedById: session.user.id,
    },
    select: {
      machineKey: true,
      category: true,
      subcategory: true,
      model: true,
      serialNumber: true,
      manufacturer: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(equipment);
}
