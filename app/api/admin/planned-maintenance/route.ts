import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireTrustedOrigin } from "@/lib/requireTrustedOrigin";
import { ensureAssetExists, isConcreteMachineKey, parseMachineKey } from "@/lib/assets";
import {
  formatMaintenanceDateTimeForLocale,
  parseMaintenanceDateTime,
} from "@/lib/dateOnly";
import {
  getExistingJiraIssueKeys,
} from "@/lib/jiraServer";
import { sendPlannedMaintenanceNotificationEmail } from "@/lib/plannedMaintenanceMailer";
import { normalizePlannedMaintenanceRecipients } from "@/lib/plannedMaintenanceRecipients";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";

type PlannedMaintenanceRow = {
  id: string;
  machineKey: string;
  title: string;
  dueDate: Date;
  availabilityStartTime: string | null;
  availabilityEndTime: string | null;
  note: string | null;
  cost: number | null;
  jiraIssueId: string | null;
  jiraIssueKey: string | null;
  jiraIssueUrl: string | null;
  notificationRecipientsJson: string | null;
  status: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdById: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
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
    createdBy: item.createdById
      ? {
          id: item.createdById,
          name: item.createdByName,
          email: item.createdByEmail,
        }
      : null,
    status,
    availabilityStartTime: normalizeMaintenanceTimeValue(item.availabilityStartTime),
    availabilityEndTime: normalizeMaintenanceTimeValue(item.availabilityEndTime),
    isCompleted: status === "completed",
    completedAt: status === "completed" ? item.completedAt : null,
    dueDate: item.dueDate.toISOString(),
  };
}

function normalizeMaintenanceTimeValue(value: unknown) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value.trim())
    ? value.trim()
    : null;
}

function isValidMaintenanceTimeValue(value: string | null) {
  return value === null || /^\d{2}:\d{2}$/.test(value);
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

function getRequestLocale(value: unknown): Locale {
  return value === "lt" ? "lt" : "en";
}

function getNotificationSuccessMessage(recipientCount: number, locale: Locale) {
  if (locale === "lt") {
    return recipientCount === 1
      ? "Pranešimo el. laiškas išsiųstas 1 žmogui."
      : `Pranešimo el. laiškas išsiųstas ${recipientCount} žmonėms.`;
  }

  return recipientCount === 1
    ? "Notification email was sent to 1 person."
    : `Notification email was sent to ${recipientCount} people.`;
}

function formatMachineLabel(machineKey: string) {
  const parsed = parseMachineKey(machineKey);
  if (parsed.category && parsed.subcategory) {
    return `${parsed.category} / ${parsed.subcategory}`;
  }

  return machineKey;
}

function formatAvailabilityLabel(
  startTime: string | null,
  endTime: string | null
) {
  if (startTime && endTime) {
    return `${startTime}-${endTime}`;
  }

  return startTime || null;
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

async function hasAvailabilityColumns() {
  const rows = await prisma.$queryRaw<
    Array<{
      availabilityStartTime: boolean;
      availabilityEndTime: boolean;
    }>
  >`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'availabilityStartTime'
      ) AS "availabilityStartTime",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'availabilityEndTime'
      ) AS "availabilityEndTime"
  `;

  return rows[0] ?? {
    availabilityStartTime: false,
    availabilityEndTime: false,
  };
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

async function hasCreatedByColumn() {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'PlannedMaintenance'
        AND column_name = 'createdById'
    ) AS "exists"
  `;

  return rows[0]?.exists ?? false;
}

function selectSql(
  withCost: boolean,
  withAvailability: boolean,
  withJiraLink: boolean,
  withStatus: boolean,
  withNotificationRecipients: boolean,
  withCreatedBy: boolean
) {
  return withCost
    ? Prisma.sql`
        SELECT
          pm."id",
          pm."machineKey",
          pm."title",
          pm."dueDate",
          ${withAvailability ? Prisma.sql`pm."availabilityStartTime", pm."availabilityEndTime",` : Prisma.sql`NULL::TEXT AS "availabilityStartTime", NULL::TEXT AS "availabilityEndTime",`}
          pm."note",
          pm."cost",
          ${withJiraLink ? Prisma.sql`pm."jiraIssueId", pm."jiraIssueKey", pm."jiraIssueUrl",` : Prisma.sql`NULL::TEXT AS "jiraIssueId", NULL::TEXT AS "jiraIssueKey", NULL::TEXT AS "jiraIssueUrl",`}
          ${
            withNotificationRecipients
              ? Prisma.sql`pm."notificationRecipientsJson",`
              : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson",`
          }
          ${withStatus ? Prisma.sql`pm."status",` : Prisma.sql`NULL::TEXT AS "status",`}
          ${withCreatedBy ? Prisma.sql`pm."createdById", u."name" AS "createdByName", u."email" AS "createdByEmail",` : Prisma.sql`NULL::TEXT AS "createdById", NULL::TEXT AS "createdByName", NULL::TEXT AS "createdByEmail",`}
          pm."isCompleted",
          pm."completedAt",
          pm."createdAt",
          pm."updatedAt"
        FROM "PlannedMaintenance" pm
        ${withCreatedBy ? Prisma.sql`LEFT JOIN "User" u ON u."id" = pm."createdById"` : Prisma.empty}
      `
    : Prisma.sql`
        SELECT
          pm."id",
          pm."machineKey",
          pm."title",
          pm."dueDate",
          ${withAvailability ? Prisma.sql`pm."availabilityStartTime", pm."availabilityEndTime",` : Prisma.sql`NULL::TEXT AS "availabilityStartTime", NULL::TEXT AS "availabilityEndTime",`}
          pm."note",
          NULL::DOUBLE PRECISION AS "cost",
          ${withJiraLink ? Prisma.sql`pm."jiraIssueId", pm."jiraIssueKey", pm."jiraIssueUrl",` : Prisma.sql`NULL::TEXT AS "jiraIssueId", NULL::TEXT AS "jiraIssueKey", NULL::TEXT AS "jiraIssueUrl",`}
          ${
            withNotificationRecipients
              ? Prisma.sql`pm."notificationRecipientsJson",`
              : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson",`
          }
          ${withStatus ? Prisma.sql`pm."status",` : Prisma.sql`NULL::TEXT AS "status",`}
          ${withCreatedBy ? Prisma.sql`pm."createdById", u."name" AS "createdByName", u."email" AS "createdByEmail",` : Prisma.sql`NULL::TEXT AS "createdById", NULL::TEXT AS "createdByName", NULL::TEXT AS "createdByEmail",`}
          pm."isCompleted",
          pm."completedAt",
          pm."createdAt",
          pm."updatedAt"
        FROM "PlannedMaintenance" pm
        ${withCreatedBy ? Prisma.sql`LEFT JOIN "User" u ON u."id" = pm."createdById"` : Prisma.empty}
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

  const [withCost, availabilityColumns, jiraLinkColumns, withStatus, withNotificationRecipients, withCreatedBy] = await Promise.all([
    hasCostColumn(),
    hasAvailabilityColumns(),
    hasJiraLinkColumns(),
    hasStatusColumn(),
    hasNotificationRecipientsColumn(),
    hasCreatedByColumn(),
  ]);
  const withAvailability =
    availabilityColumns.availabilityStartTime &&
    availabilityColumns.availabilityEndTime;
  const withJiraLink =
    jiraLinkColumns.jiraIssueId &&
    jiraLinkColumns.jiraIssueKey &&
    jiraLinkColumns.jiraIssueUrl;
  const items = await prisma.$queryRaw<PlannedMaintenanceRow[]>(
    Prisma.sql`${selectSql(
      withCost,
      withAvailability,
      withJiraLink,
      withStatus,
      withNotificationRecipients,
      withCreatedBy
    )} ORDER BY ${
      withStatus ? Prisma.sql`pm."status"` : Prisma.sql`pm."isCompleted"`
    } ASC, pm."dueDate" ASC`
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
  const availabilityStartTime = normalizeMaintenanceTimeValue(
    body?.availabilityStartTime
  );
  const availabilityEndTime = normalizeMaintenanceTimeValue(body?.availabilityEndTime);
  const note = String(body?.note || "").trim();
  const notificationRecipients = normalizePlannedMaintenanceRecipients(
    body?.notificationRecipients
  );
  const locale = getRequestLocale(body?.locale);
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

  const parsedDueDate = parseMaintenanceDateTime(dueDate);
  if (!parsedDueDate) {
    return NextResponse.json({ error: "dueDate is invalid" }, { status: 400 });
  }
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) {
    return NextResponse.json({ error: "cost must be >= 0" }, { status: 400 });
  }
  if (
    !isValidMaintenanceTimeValue(availabilityStartTime) ||
    !isValidMaintenanceTimeValue(availabilityEndTime)
  ) {
    return NextResponse.json(
      { error: "availability times are invalid" },
      { status: 400 }
    );
  }
  if (availabilityEndTime && !availabilityStartTime) {
    return NextResponse.json(
      { error: "availability end time requires a start time" },
      { status: 400 }
    );
  }
  if (
    availabilityStartTime &&
    availabilityEndTime &&
    availabilityEndTime < availabilityStartTime
  ) {
    return NextResponse.json(
      { error: "availability end time must be after start time" },
      { status: 400 }
    );
  }

  try {
    await ensureAssetExists(prisma, machineKey, session.user.id);
    const created = await prisma.plannedMaintenance.create({
      data: {
        id: crypto.randomUUID(),
        machineKey,
        title,
        dueDate: parsedDueDate,
        availabilityStartTime,
        availabilityEndTime,
        note: note || null,
        cost,
        jiraIssueId: null,
        jiraIssueKey: null,
        jiraIssueUrl: null,
        notificationRecipientsJson,
        status,
        isCompleted,
        completedAt,
        createdById: session.user.id,
      },
      select: {
        id: true,
        machineKey: true,
        title: true,
        dueDate: true,
        availabilityStartTime: true,
        availabilityEndTime: true,
        note: true,
        cost: true,
        jiraIssueId: true,
        jiraIssueKey: true,
        jiraIssueUrl: true,
        notificationRecipientsJson: true,
        status: true,
        isCompleted: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const serialized = serializePlannedMaintenance({
      ...created,
      createdById: session.user.id,
      createdByName: session.user.name ?? null,
      createdByEmail: session.user.email ?? null,
    });
    const { sent, warning } = await sendPlannedMaintenanceNotificationEmail({
      recipients: serialized.notificationRecipients,
      machineLabel: formatMachineLabel(machineKey),
      title,
      dueDate: formatMaintenanceDateTimeForLocale(
        serialized.dueDate,
        locale === "lt" ? "lt-LT" : "en-US"
      ),
      availability: formatAvailabilityLabel(
        serialized.availabilityStartTime,
        serialized.availabilityEndTime
      ),
      note: note || null,
      createdByLabel: serialized.createdBy?.name || serialized.createdBy?.email || null,
      status,
      action: "created",
      locale,
    });

    return NextResponse.json({
      ...serialized,
      ...(sent
        ? {
            notificationSuccess: getNotificationSuccessMessage(
              serialized.notificationRecipients.length,
              locale
            ),
          }
        : {}),
      ...(warning ? { notificationWarning: warning } : {}),
    });
  } catch (error) {
    console.error("Failed to create maintenance item", error);
    return NextResponse.json(
      {
        error: "Failed to create maintenance item",
      },
      { status: 500 }
    );
  }
}
