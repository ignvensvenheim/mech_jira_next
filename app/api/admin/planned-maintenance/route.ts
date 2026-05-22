import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireTrustedOrigin } from "@/lib/requireTrustedOrigin";
import { ensureAssetExists, isConcreteMachineKey } from "@/lib/assets";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import {
  createJiraMaintenanceIssue,
  getExistingJiraIssueKeys,
} from "@/lib/jiraServer";

export const runtime = "nodejs";

type PlannedMaintenanceRow = {
  id: string;
  machineKey: string;
  title: string;
  dueDate: Date;
  note: string | null;
  cost: number | null;
  jiraIssueId: string | null;
  jiraIssueKey: string | null;
  jiraIssueUrl: string | null;
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

function selectSql(withCost: boolean, withJiraLink: boolean) {
  return withCost
    ? Prisma.sql`
        SELECT
          "id",
          "machineKey",
          "title",
          "dueDate",
          "note",
          "cost",
          ${withJiraLink ? Prisma.sql`"jiraIssueId", "jiraIssueKey", "jiraIssueUrl",` : Prisma.sql`NULL::TEXT AS "jiraIssueId", NULL::TEXT AS "jiraIssueKey", NULL::TEXT AS "jiraIssueUrl",`}
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
          ${withJiraLink ? Prisma.sql`"jiraIssueId", "jiraIssueKey", "jiraIssueUrl",` : Prisma.sql`NULL::TEXT AS "jiraIssueId", NULL::TEXT AS "jiraIssueKey", NULL::TEXT AS "jiraIssueUrl",`}
          "isCompleted",
          "completedAt",
          "createdAt",
          "updatedAt"
        FROM "PlannedMaintenance"
      `;
}

async function repairDeletedLinkedMaintenanceItems(items: PlannedMaintenanceRow[]) {
  const linkedItems = items.filter((item) => item.jiraIssueKey);
  if (linkedItems.length === 0) {
    return new Set<string>();
  }

  const existingKeys = await getExistingJiraIssueKeys(
    linkedItems.map((item) => item.jiraIssueKey as string)
  );
  const missingIds = linkedItems
    .filter((item) => item.jiraIssueKey && !existingKeys.has(item.jiraIssueKey))
    .map((item) => item.id);

  if (missingIds.length > 0) {
    await prisma.plannedMaintenance.deleteMany({
      where: {
        id: {
          in: missingIds,
        },
      },
    });
  }

  return new Set(missingIds);
}

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [withCost, jiraLinkColumns] = await Promise.all([
    hasCostColumn(),
    hasJiraLinkColumns(),
  ]);
  const withJiraLink =
    jiraLinkColumns.jiraIssueId &&
    jiraLinkColumns.jiraIssueKey &&
    jiraLinkColumns.jiraIssueUrl;
  const items = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
    Prisma.sql`${selectSql(withCost, withJiraLink)} ORDER BY "isCompleted" ASC, "dueDate" ASC`
  );
  let deletedIds = new Set<string>();

  if (withJiraLink) {
    try {
      deletedIds = await repairDeletedLinkedMaintenanceItems(items);
    } catch (error) {
      console.error("Failed to repair deleted Jira-linked maintenance items", error);
    }
  }

  return NextResponse.json({
    items: items
      .filter((item) => !deletedIds.has(item.id))
      .map(serializePlannedMaintenance),
  });
}

export async function POST(req: Request) {
  const originError = requireTrustedOrigin(req);
  if (originError) {
    return originError;
  }

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

  try {
    await ensureAssetExists(prisma, machineKey, session.user.id);
    const jiraIssue = await createJiraMaintenanceIssue({
      machineKey,
      title,
      dueDate,
      note: note || null,
      cost,
    });
    const jiraLinkColumns = await hasJiraLinkColumns();
    const withJiraLink =
      jiraLinkColumns.jiraIssueId &&
      jiraLinkColumns.jiraIssueKey &&
      jiraLinkColumns.jiraIssueUrl;
    const withCost = await hasCostColumn();

    const rows = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
      withCost && withJiraLink
        ? Prisma.sql`
            INSERT INTO "PlannedMaintenance" (
              "id",
              "machineKey",
              "title",
              "dueDate",
              "note",
              "cost",
              "jiraIssueId",
              "jiraIssueKey",
              "jiraIssueUrl",
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
              ${jiraIssue.id || null},
              ${jiraIssue.key},
              ${jiraIssue.browseUrl},
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
              "jiraIssueId",
              "jiraIssueKey",
              "jiraIssueUrl",
              "isCompleted",
              "completedAt",
              "createdAt",
              "updatedAt"
          `
        : withCost
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
                NULL::TEXT AS "jiraIssueId",
                NULL::TEXT AS "jiraIssueKey",
                NULL::TEXT AS "jiraIssueUrl",
                "isCompleted",
                "completedAt",
                "createdAt",
                "updatedAt"
            `
          : withJiraLink
            ? Prisma.sql`
                INSERT INTO "PlannedMaintenance" (
                  "id",
                  "machineKey",
                  "title",
                  "dueDate",
                  "note",
                  "jiraIssueId",
                  "jiraIssueKey",
                  "jiraIssueUrl",
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
                  ${jiraIssue.id || null},
                  ${jiraIssue.key},
                  ${jiraIssue.browseUrl},
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
                  "jiraIssueId",
                  "jiraIssueKey",
                  "jiraIssueUrl",
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
                  NULL::TEXT AS "jiraIssueId",
                  NULL::TEXT AS "jiraIssueKey",
                  NULL::TEXT AS "jiraIssueUrl",
                  "isCompleted",
                  "completedAt",
                  "createdAt",
                  "updatedAt"
              `
    );

    return NextResponse.json(serializePlannedMaintenance(rows[0]));
  } catch (error) {
    console.error("Failed to create Jira maintenance issue", error);
    return NextResponse.json(
      {
        error: "Failed to create maintenance issue",
      },
      { status: 502 }
    );
  }
}
