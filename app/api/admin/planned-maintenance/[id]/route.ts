import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireTrustedOrigin } from "@/lib/requireTrustedOrigin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import {
  addJiraMaintenanceComment,
  deleteJiraIssue,
  updateJiraMaintenanceIssue,
} from "@/lib/jiraServer";

export const runtime = "nodejs";

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
  jiraIssueId?: string | null;
  jiraIssueKey?: string | null;
  jiraIssueUrl?: string | null;
}) {
  return {
    ...item,
    cost: item.cost ?? null,
    jiraIssueId: item.jiraIssueId ?? null,
    jiraIssueKey: item.jiraIssueKey ?? null,
    jiraIssueUrl: item.jiraIssueUrl ?? null,
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

async function hasJiraLinkColumns() {
  const rows = await prisma.$queryRaw<
    Array<{
      jiraIssueId: boolean;
      jiraIssueKey: boolean;
      jiraIssueUrl: boolean;
    }>
  >`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'jiraIssueId'
      ) AS "jiraIssueId",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'jiraIssueKey'
      ) AS "jiraIssueKey",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'jiraIssueUrl'
      ) AS "jiraIssueUrl"
  `;

  return rows[0] ?? {
    jiraIssueId: false,
    jiraIssueKey: false,
    jiraIssueUrl: false,
  };
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const originError = requireTrustedOrigin(req);
  if (originError) {
    return originError;
  }

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

  const [withCost, jiraLinkColumns] = await Promise.all([
    hasCostColumn(),
    hasJiraLinkColumns(),
  ]);
  if (
    body &&
    "cost" in (body as object) &&
    cost !== null &&
    (!Number.isFinite(cost) || cost < 0)
  ) {
    return NextResponse.json({ error: "cost must be >= 0" }, { status: 400 });
  }

  const withJiraLink =
    jiraLinkColumns.jiraIssueId &&
    jiraLinkColumns.jiraIssueKey &&
    jiraLinkColumns.jiraIssueUrl;
  const existing = await prisma.$queryRaw<
    Array<{
      id: string;
      machineKey: string;
      title: string;
      dueDate: Date;
      note: string | null;
      cost: number | null;
      isCompleted: boolean;
      jiraIssueKey: string | null;
      jiraIssueUrl: string | null;
    }>
  >(
    Prisma.sql`
      SELECT
        "id",
        "machineKey",
        "title",
        "dueDate",
        "note",
        ${
          withCost
            ? Prisma.sql`"cost"`
            : Prisma.sql`NULL::DOUBLE PRECISION AS "cost"`
        },
        "isCompleted",
        ${
          withJiraLink
            ? Prisma.sql`"jiraIssueKey", "jiraIssueUrl"`
            : Prisma.sql`NULL::TEXT AS "jiraIssueKey", NULL::TEXT AS "jiraIssueUrl"`
        }
      FROM "PlannedMaintenance"
      WHERE "id" = ${id}
      LIMIT 1
    `
  );

  const currentItem = existing[0];
  if (!currentItem) {
    return NextResponse.json({ error: "Maintenance item not found" }, { status: 404 });
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

  const nextMachineKey = machineKey || currentItem.machineKey;
  const nextTitle = title || currentItem.title;
  const nextDueDate = dueDate || formatDateOnly(currentItem.dueDate);
  const nextNote =
    body && "note" in (body as object) ? note || null : currentItem.note;
  const nextIsCompleted =
    typeof isCompleted === "boolean" ? isCompleted : currentItem.isCompleted;

  if (currentItem.jiraIssueKey) {
    try {
      await updateJiraMaintenanceIssue({
        issueKey: currentItem.jiraIssueKey,
        machineKey: nextMachineKey,
        title: nextTitle,
        dueDate: nextDueDate,
        note: nextNote,
        cost: body && "cost" in (body as object) ? cost : currentItem.cost,
        isCompleted: nextIsCompleted,
      });

      if (typeof isCompleted === "boolean" && isCompleted !== currentItem.isCompleted) {
        await addJiraMaintenanceComment({
          issueKey: currentItem.jiraIssueKey,
          text: isCompleted
            ? "Maintenance marked completed in the admin calendar."
            : "Maintenance reopened in the admin calendar.",
        });
      }
    } catch (error) {
      console.error("Failed to update linked Jira maintenance issue", error);
      return NextResponse.json(
        {
          error: "Failed to update linked Jira issue",
        },
        { status: 502 }
      );
    }
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
  let jiraIssueId: string | null = null;
  let jiraIssueKey: string | null = null;
  let jiraIssueUrl: string | null = null;
  if (body && "cost" in (body as object) && withCost) {
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
  if (withJiraLink) {
    const rows = await prisma.$queryRaw<
      Array<{
        jiraIssueId: string | null;
        jiraIssueKey: string | null;
        jiraIssueUrl: string | null;
      }>
    >`
      SELECT "jiraIssueId", "jiraIssueKey", "jiraIssueUrl"
      FROM "PlannedMaintenance"
      WHERE "id" = ${id}
    `;
    jiraIssueId = rows[0]?.jiraIssueId ?? null;
    jiraIssueKey = rows[0]?.jiraIssueKey ?? null;
    jiraIssueUrl = rows[0]?.jiraIssueUrl ?? null;
  }

  return NextResponse.json(
    serializePlannedMaintenance({
      ...updated,
      cost: resolvedCost,
      jiraIssueId,
      jiraIssueKey,
      jiraIssueUrl,
    })
  );
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const originError = requireTrustedOrigin(req);
  if (originError) {
    return originError;
  }

  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const jiraLinkColumns = await hasJiraLinkColumns();
  const withJiraLink =
    jiraLinkColumns.jiraIssueId &&
    jiraLinkColumns.jiraIssueKey &&
    jiraLinkColumns.jiraIssueUrl;
  const existing = await prisma.$queryRaw<Array<{ jiraIssueKey: string | null }>>(
    Prisma.sql`
      SELECT
        ${
          withJiraLink
            ? Prisma.sql`"jiraIssueKey"`
            : Prisma.sql`NULL::TEXT AS "jiraIssueKey"`
        }
      FROM "PlannedMaintenance"
      WHERE "id" = ${id}
      LIMIT 1
    `
  );

  if (!existing[0]) {
    return NextResponse.json({ error: "Maintenance item not found" }, { status: 404 });
  }

  if (existing[0].jiraIssueKey) {
    try {
      await deleteJiraIssue(existing[0].jiraIssueKey);
    } catch (error) {
      console.error("Failed to delete linked Jira maintenance issue", error);
      return NextResponse.json(
        {
          error: "Failed to delete linked Jira issue",
        },
        { status: 502 }
      );
    }
  }

  await prisma.plannedMaintenance.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
