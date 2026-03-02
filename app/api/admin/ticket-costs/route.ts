import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";

type TicketFixCostRow = {
  issueKey: string;
  machineKey: string;
  date: string;
  amount: number;
  comment: string;
  updatedAt: Date;
};

export async function POST(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const issueKeys = Array.isArray(body?.issueKeys)
      ? body.issueKeys
          .map((v: unknown) => String(v || "").trim())
          .filter((v: string) => Boolean(v))
      : [];

    if (issueKeys.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const items = await prisma.$queryRaw<TicketFixCostRow[]>(
      Prisma.sql`
        SELECT
          "issueKey",
          "machineKey",
          "date",
          "amount",
          "comment",
          "updatedAt"
        FROM "TicketFixCost"
        WHERE "issueKey" IN (${Prisma.join(issueKeys)})
      `
    );

    return NextResponse.json({ items });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const issueKey = String(body?.issueKey || "").trim();
    const machineKey = String(body?.machineKey || "").trim();
    const date = String(body?.date || "").trim();
    const amount = Number(body?.amount);
    const comment = String(body?.comment || "").trim();
    const id = randomUUID();

    if (!issueKey || !machineKey || !date) {
      return NextResponse.json(
        { error: "issueKey, machineKey and date are required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json(
        { error: "amount must be >= 0" },
        { status: 400 }
      );
    }

    const rows = await prisma.$queryRaw<TicketFixCostRow[]>(
      Prisma.sql`
        INSERT INTO "TicketFixCost"
          ("id", "issueKey", "machineKey", "date", "amount", "comment", "updatedById")
        VALUES
          (${id}, ${issueKey}, ${machineKey}, ${date}, ${amount}, ${comment}, ${
        session.user.id || null
      })
        ON CONFLICT ("issueKey")
        DO UPDATE SET
          "machineKey" = EXCLUDED."machineKey",
          "date" = EXCLUDED."date",
          "amount" = EXCLUDED."amount",
          "comment" = EXCLUDED."comment",
          "updatedById" = EXCLUDED."updatedById",
          "updatedAt" = NOW()
        RETURNING
          "issueKey",
          "machineKey",
          "date",
          "amount",
          "comment",
          "updatedAt"
      `
    );
    const item = rows[0];

    return NextResponse.json(item);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const issueKey = String(body?.issueKey || "").trim();
    if (!issueKey) {
      return NextResponse.json({ error: "issueKey is required" }, { status: 400 });
    }

    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM "TicketFixCost" WHERE "issueKey" = ${issueKey}`
    );

    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: String((error as Error).message || error) },
      { status: 500 }
    );
  }
}
