import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

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

  const [rate, entries] = await Promise.all([
    prisma.machineRate.findUnique({
      where: { machineKey },
      select: { hourlyRate: true },
    }),
    prisma.manualEntry.findMany({
      where: { machineKey },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        amount: true,
        comment: true,
        createdAt: true,
      },
    }),
  ]);

  return NextResponse.json({
    hourlyRate: rate?.hourlyRate ?? 0,
    entries,
  });
}
