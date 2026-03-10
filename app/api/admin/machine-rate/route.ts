import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

export async function PUT(req: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const machineKey = String(body?.machineKey || "").trim();
  const hourlyRate = Number(body?.hourlyRate);

  if (!machineKey) {
    return NextResponse.json({ error: "machineKey is required" }, { status: 400 });
  }
  if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
    return NextResponse.json({ error: "hourlyRate must be >= 0" }, { status: 400 });
  }

  const rate = await prisma.machineRate.upsert({
    where: { machineKey },
    update: {
      hourlyRate,
      updatedById: session.user.id,
    },
    create: {
      machineKey,
      hourlyRate,
      updatedById: session.user.id,
    },
    select: { machineKey: true, hourlyRate: true, updatedAt: true },
  });

  return NextResponse.json(rate);
}
