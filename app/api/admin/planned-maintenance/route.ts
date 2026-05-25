import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireTrustedOrigin } from "@/lib/requireTrustedOrigin";
import { ensureAssetExists, isConcreteMachineKey, parseMachineKey } from "@/lib/assets";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import {
  createJiraMaintenanceIssue,
  getExistingJiraIssueKeys,
} from "@/lib/jiraServer";
import { sendPlannedMaintenanceNotificationEmail } from "@/lib/plannedMaintenanceMailer";
import { normalizePlannedMaintenanceRecipients } from "@/lib/plannedMaintenanceRecipients";

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
  notificationRecipientsJson: string | null;
  status: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeMaintenanceStatus(status: string | null, isCompleted: boolean) {
  switch (status) {
    case "planned":
    case "inProgress":
    case "waitingForParts":
    case "completed":
    case "cancelled":
      return status;
    default:
      return isCompleted ? "completed" : "planned";
  }
}

function serializePlannedMaintenance(item: PlannedMaintenanceRow) {
  const status = normalizeMaintenanceStatus(item.status, item.isCompleted);
  return {
    ...item,
    notificationRecipients: normalizePlannedMaintenanceRecipients(
      JSON.parse(item.notificationRecipientsJson || "[]")
    ),
    status,
    isCompleted: status === "completed",
    completedAt: status === "completed" ? item.completedAt : null,
    dueDate: formatDateOnly(item.dueDate),
  };
}

function getMaintenanceStatusLabel(status: string) {
  switch (status) {
    case "inProgress":
      return "In progress";
    case "waitingForParts":
      return "Waiting for parts";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Planned";
  }
}

function formatMachineLabel(machineKey: string) {
  const parsed = parseMachineKey(machineKey);
  if (parsed.category && parsed.subcategory) {
    return `${parsed.category} / ${parsed.subcategory}`;
  }

  return machineKey;
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

async function hasStatusColumn() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlannedMaintenance'
        AND column_name = 'status'
    ) AS "exists"
  `;

  return rows[0]?.exists ?? false;
}

async function hasNotificationRecipientsColumn() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlannedMaintenance'
        AND column_name = 'notificationRecipientsJson'
    ) AS "exists"
  `;

  return rows[0]?.exists ?? false;
}

function selectSql(
  withCost: boolean,
  withJiraLink: boolean,
  withStatus: boolean,
  withNotificationRecipients: boolean
) {
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
          ${
            withNotificationRecipients
              ? Prisma.sql`"notificationRecipientsJson",`
              : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson",`
          }
          ${withStatus ? Prisma.sql`"status",` : Prisma.sql`NULL::TEXT AS "status",`}
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
          ${
            withNotificationRecipients
              ? Prisma.sql`"notificationRecipientsJson",`
              : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson",`
          }
          ${withStatus ? Prisma.sql`"status",` : Prisma.sql`NULL::TEXT AS "status",`}
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

  const [withCost, jiraLinkColumns, withStatus, withNotificationRecipients] = await Promise.all([
    hasCostColumn(),
    hasJiraLinkColumns(),
    hasStatusColumn(),
    hasNotificationRecipientsColumn(),
  ]);
  const withJiraLink =
    jiraLinkColumns.jiraIssueId &&
    jiraLinkColumns.jiraIssueKey &&
    jiraLinkColumns.jiraIssueUrl;
  const items = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
    Prisma.sql`${selectSql(
      withCost,
      withJiraLink,
      withStatus,
      withNotificationRecipients
    )} ORDER BY ${
      withStatus ? Prisma.sql`"status"` : Prisma.sql`"isCompleted"`
    } ASC, "dueDate" ASC`
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
  const notificationRecipients = normalizePlannedMaintenanceRecipients(
    body?.notificationRecipients
  );
  const statusRaw = String(body?.status || "").trim();
  const costRaw = body?.cost;
  const cost =
    costRaw === "" || costRaw === null || typeof costRaw === "undefined"
      ? null
      : Number(costRaw);
  const status = normalizeMaintenanceStatus(statusRaw || null, false);
  const isCompleted = status === "completed";
  const completedAt = isCompleted ? new Date() : null;
  const notificationRecipientsJson = JSON.stringify(notificationRecipients);

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
      status,
    });
    const [jiraLinkColumns, withStatus, withNotificationRecipients] = await Promise.all([
      hasJiraLinkColumns(),
      hasStatusColumn(),
      hasNotificationRecipientsColumn(),
    ]);
    const withJiraLink =
      jiraLinkColumns.jiraIssueId &&
      jiraLinkColumns.jiraIssueKey &&
      jiraLinkColumns.jiraIssueUrl;
    const withCost = await hasCostColumn();

    const rows = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
      withCost && withJiraLink && withStatus && withNotificationRecipients
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
              "notificationRecipientsJson",
              "status",
              "isCompleted",
              "completedAt",
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
              ${notificationRecipientsJson},
              ${status}::"MaintenanceWorkflowStatus",
              ${isCompleted},
              ${completedAt},
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
              "notificationRecipientsJson",
              "status",
              "isCompleted",
              "completedAt",
              "createdAt",
              "updatedAt"
          `
        : withCost && withJiraLink && withNotificationRecipients
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
                "notificationRecipientsJson",
                "isCompleted",
                "completedAt",
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
                ${notificationRecipientsJson},
                ${isCompleted},
                ${completedAt},
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
                "notificationRecipientsJson",
                NULL::TEXT AS "status",
                "isCompleted",
                "completedAt",
                "createdAt",
                "updatedAt"
            `
        : withCost && withStatus && withNotificationRecipients
          ? Prisma.sql`
              INSERT INTO "PlannedMaintenance" (
                "id",
                "machineKey",
                "title",
                "dueDate",
                "note",
                "cost",
                "notificationRecipientsJson",
                "status",
                "isCompleted",
                "completedAt",
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
                ${notificationRecipientsJson},
                ${status}::"MaintenanceWorkflowStatus",
                ${isCompleted},
                ${completedAt},
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
                "notificationRecipientsJson",
                "status",
                "isCompleted",
                "completedAt",
                "createdAt",
                "updatedAt"
            `
          : withCost && withNotificationRecipients
            ? Prisma.sql`
                INSERT INTO "PlannedMaintenance" (
                  "id",
                  "machineKey",
                  "title",
                  "dueDate",
                  "note",
                  "cost",
                  "notificationRecipientsJson",
                  "isCompleted",
                  "completedAt",
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
                  ${notificationRecipientsJson},
                  ${isCompleted},
                  ${completedAt},
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
                  "notificationRecipientsJson",
                  NULL::TEXT AS "status",
                  "isCompleted",
                  "completedAt",
                  "createdAt",
                  "updatedAt"
              `
          : withJiraLink && withStatus && withNotificationRecipients
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
                  "notificationRecipientsJson",
                  "status",
                  "isCompleted",
                  "completedAt",
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
                  ${notificationRecipientsJson},
                  ${status}::"MaintenanceWorkflowStatus",
                  ${isCompleted},
                  ${completedAt},
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
                  "notificationRecipientsJson",
                  "status",
                  "isCompleted",
                  "completedAt",
                  "createdAt",
                  "updatedAt"
              `
            : withJiraLink && withNotificationRecipients
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
                    "notificationRecipientsJson",
                    "isCompleted",
                    "completedAt",
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
                    ${notificationRecipientsJson},
                    ${isCompleted},
                    ${completedAt},
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
                    "notificationRecipientsJson",
                    NULL::TEXT AS "status",
                    "isCompleted",
                    "completedAt",
                    "createdAt",
                    "updatedAt"
                `
            : withStatus && withNotificationRecipients
              ? Prisma.sql`
                  INSERT INTO "PlannedMaintenance" (
                    "id",
                    "machineKey",
                    "title",
                    "dueDate",
                    "note",
                    "notificationRecipientsJson",
                    "status",
                    "isCompleted",
                    "completedAt",
                    "createdAt",
                    "updatedAt"
                  )
                  VALUES (
                    ${crypto.randomUUID()},
                    ${machineKey},
                    ${title},
                    ${parsedDueDate},
                    ${note || null},
                    ${notificationRecipientsJson},
                    ${status}::"MaintenanceWorkflowStatus",
                    ${isCompleted},
                    ${completedAt},
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
                    "notificationRecipientsJson",
                    "status",
                    "isCompleted",
                    "completedAt",
                    "createdAt",
                    "updatedAt"
                `
            : withNotificationRecipients
              ? Prisma.sql`
                  INSERT INTO "PlannedMaintenance" (
                    "id",
                    "machineKey",
                    "title",
                    "dueDate",
                    "note",
                    "notificationRecipientsJson",
                    "isCompleted",
                    "completedAt",
                    "createdAt",
                    "updatedAt"
                  )
                  VALUES (
                    ${crypto.randomUUID()},
                    ${machineKey},
                    ${title},
                    ${parsedDueDate},
                    ${note || null},
                    ${notificationRecipientsJson},
                    ${isCompleted},
                    ${completedAt},
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
                    "notificationRecipientsJson",
                    NULL::TEXT AS "status",
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
                    "completedAt",
                    "createdAt",
                    "updatedAt"
                  )
                  VALUES (
                    ${crypto.randomUUID()},
                    ${machineKey},
                    ${title},
                    ${parsedDueDate},
                    ${note || null},
                    ${isCompleted},
                    ${completedAt},
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
                    NULL::TEXT AS "status",
                    "isCompleted",
                    "completedAt",
                    "createdAt",
                    "updatedAt"
              `
    );

    const serialized = serializePlannedMaintenance(rows[0]);
    const { warning } = await sendPlannedMaintenanceNotificationEmail({
      recipients: serialized.notificationRecipients,
      machineLabel: formatMachineLabel(machineKey),
      title,
      dueDate,
      note: note || null,
      statusLabel: getMaintenanceStatusLabel(status),
      action: "created",
    });

    return NextResponse.json({
      ...serialized,
      ...(warning ? { notificationWarning: warning } : {}),
    });
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
