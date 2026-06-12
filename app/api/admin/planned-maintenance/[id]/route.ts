import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireTrustedOrigin } from "@/lib/requireTrustedOrigin";
import {
  ensureAssetExists,
  isConcreteMachineKey,
  normalizeDeprecatedMachineKey,
  parseMachineKey,
} from "@/lib/assets";
import {
  formatMaintenanceDateOnlyForLocale,
  getDateOnlyFromMaintenanceDateTime,
  parseMaintenanceDateTime,
} from "@/lib/dateOnly";
import {
  deleteJiraIssue,
  updateJiraMaintenanceIssue,
} from "@/lib/jiraServer";
import { sendPlannedMaintenanceNotificationEmail } from "@/lib/plannedMaintenanceMailer";
import {
  normalizePlannedMaintenanceRecipients,
  type PlannedMaintenanceRecipient,
} from "@/lib/plannedMaintenanceRecipients";
import type { Locale } from "@/lib/i18n";

export const runtime = "nodejs";

function serializePlannedMaintenance(item: {
  id: string;
  machineKey: string;
  title: string;
  dueDate: Date;
  availabilityStartTime?: string | null;
  availabilityEndTime?: string | null;
  note: string | null;
  notificationRecipientsJson?: string | null;
  status: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdById?: string | null;
  createdByName?: string | null;
  createdByEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
  cost?: number | null;
  jiraIssueId?: string | null;
  jiraIssueKey?: string | null;
  jiraIssueUrl?: string | null;
}) {
  const status =
    item.status === "planned" ||
    item.status === "inProgress" ||
    item.status === "waitingForParts" ||
    item.status === "completed" ||
    item.status === "cancelled"
      ? item.status
      : item.isCompleted
        ? "completed"
        : "planned";
  return {
    ...item,
    notificationRecipients: normalizePlannedMaintenanceRecipients(
      JSON.parse(item.notificationRecipientsJson || "[]")
    ),
    createdBy: item.createdById
      ? {
          id: item.createdById,
          name: item.createdByName ?? null,
          email: item.createdByEmail ?? null,
        }
      : null,
    status,
    cost: item.cost ?? null,
    availabilityStartTime: item.availabilityStartTime ?? null,
    availabilityEndTime: item.availabilityEndTime ?? null,
    jiraIssueId: item.jiraIssueId ?? null,
    jiraIssueKey: item.jiraIssueKey ?? null,
    jiraIssueUrl: item.jiraIssueUrl ?? null,
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

function getRequestLocale(value: unknown): Locale {
  return value === "lt" ? "lt" : "en";
}

function getNotificationSuccessMessage(
  recipientCount: number,
  action: "updated" | "reminder",
  locale: Locale
) {
  if (locale === "lt") {
    if (action === "reminder") {
      return recipientCount === 1
        ? "Priminimo el. laiškas išsiųstas 1 žmogui."
        : `Priminimo el. laiškas išsiųstas ${recipientCount} žmonėms.`;
    }

    return recipientCount === 1
      ? "Pranešimo el. laiškas išsiųstas 1 žmogui."
      : `Pranešimo el. laiškas išsiųstas ${recipientCount} žmonėms.`;
  }

  if (action === "reminder") {
    return recipientCount === 1
      ? "Reminder email was sent to 1 person."
      : `Reminder email was sent to ${recipientCount} people.`;
  }

  return recipientCount === 1
    ? "Notification email was sent to 1 person."
    : `Notification email was sent to ${recipientCount} people.`;
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

function normalizeMaintenanceStatus(status: unknown, fallbackIsCompleted: boolean) {
  switch (status) {
    case "planned":
    case "inProgress":
    case "waitingForParts":
    case "completed":
    case "cancelled":
      return status;
    default:
      return fallbackIsCompleted ? "completed" : "planned";
  }
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
  const machineKey = normalizeDeprecatedMachineKey(
    String(body?.machineKey || "").trim()
  );
  const title = String(body?.title || "").trim();
  const dueDate = String(body?.dueDate || "").trim();
  const note = String(body?.note || "").trim();
  const notificationRecipients = normalizePlannedMaintenanceRecipients(
    body?.notificationRecipients
  );
  const locale = getRequestLocale(body?.locale);
  const action = String(body?.action || "").trim();
  const availabilityStartTime = normalizeMaintenanceTimeValue(
    body?.availabilityStartTime
  );
  const availabilityEndTime = normalizeMaintenanceTimeValue(body?.availabilityEndTime);
  const costRaw = body?.cost;
  const cost =
    costRaw === "" || costRaw === null || typeof costRaw === "undefined"
      ? null
      : Number(costRaw);

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const [withCost, availabilityColumns, jiraLinkColumns, withStatus, withNotificationRecipients, withCreatedBy] = await Promise.all([
    hasCostColumn(),
    hasAvailabilityColumns(),
    hasJiraLinkColumns(),
    hasStatusColumn(),
    hasNotificationRecipientsColumn(),
    hasCreatedByColumn(),
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
  const withAvailability =
    availabilityColumns.availabilityStartTime &&
    availabilityColumns.availabilityEndTime;
  const existing = await prisma.$queryRaw<
    Array<{
      id: string;
      machineKey: string;
      title: string;
      dueDate: Date;
      availabilityStartTime: string | null;
      availabilityEndTime: string | null;
      note: string | null;
      cost: number | null;
      notificationRecipientsJson: string | null;
      status: string | null;
      isCompleted: boolean;
      createdById: string | null;
      createdByName: string | null;
      createdByEmail: string | null;
      jiraIssueKey: string | null;
      jiraIssueUrl: string | null;
    }>
  >(
    Prisma.sql`
      SELECT
        pm."id",
        pm."machineKey",
        pm."title",
        pm."dueDate",
        ${
          withAvailability
            ? Prisma.sql`pm."availabilityStartTime", pm."availabilityEndTime",`
            : Prisma.sql`NULL::TEXT AS "availabilityStartTime", NULL::TEXT AS "availabilityEndTime",`
        }
        pm."note",
        ${
          withCost
            ? Prisma.sql`pm."cost"`
            : Prisma.sql`NULL::DOUBLE PRECISION AS "cost"`
        },
        ${
          withStatus
            ? Prisma.sql`pm."status"`
            : Prisma.sql`NULL::TEXT AS "status"`
        },
        ${
          withNotificationRecipients
            ? Prisma.sql`pm."notificationRecipientsJson"`
            : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson"`
        },
        ${
          withCreatedBy
            ? Prisma.sql`pm."createdById", u."name" AS "createdByName", u."email" AS "createdByEmail"`
            : Prisma.sql`NULL::TEXT AS "createdById", NULL::TEXT AS "createdByName", NULL::TEXT AS "createdByEmail"`
        },
        pm."isCompleted",
        ${
          withJiraLink
            ? Prisma.sql`pm."jiraIssueKey", pm."jiraIssueUrl"`
            : Prisma.sql`NULL::TEXT AS "jiraIssueKey", NULL::TEXT AS "jiraIssueUrl"`
        }
      FROM "PlannedMaintenance" pm
      ${withCreatedBy ? Prisma.sql`LEFT JOIN "User" u ON u."id" = pm."createdById"` : Prisma.empty}
      WHERE pm."id" = ${id}
      LIMIT 1
    `
  );

  const currentItem = existing[0];
  if (!currentItem) {
    return NextResponse.json({ error: "Maintenance item not found" }, { status: 404 });
  }
  const normalizedCurrentMachineKey = normalizeDeprecatedMachineKey(
    currentItem.machineKey
  );
  const shouldUpgradeCurrentMachineKey =
    normalizedCurrentMachineKey !== currentItem.machineKey;
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

  const shouldBackfillCreator = withCreatedBy && !currentItem.createdById;
  const resolvedCreatedById = shouldBackfillCreator
    ? session.user.id
    : currentItem.createdById ?? null;
  const resolvedCreatedByName = shouldBackfillCreator
    ? session.user.name ?? null
    : currentItem.createdByName ?? null;
  const resolvedCreatedByEmail = shouldBackfillCreator
    ? session.user.email ?? null
    : currentItem.createdByEmail ?? null;

  if (action === "sendReminder") {
    const currentStatus = normalizeMaintenanceStatus(
      currentItem.status,
      currentItem.isCompleted
    );
    const currentRecipients = normalizePlannedMaintenanceRecipients(
      JSON.parse(currentItem.notificationRecipientsJson || "[]")
    );
    const serialized = serializePlannedMaintenance({
      ...currentItem,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: currentItem.isCompleted ? new Date() : null,
      notificationRecipientsJson: currentItem.notificationRecipientsJson,
      createdById: resolvedCreatedById,
      createdByName: resolvedCreatedByName,
      createdByEmail: resolvedCreatedByEmail,
    });
    const { sent, warning } = await sendPlannedMaintenanceNotificationEmail({
      recipients: currentRecipients,
      machineLabel: formatMachineLabel(currentItem.machineKey),
      title: currentItem.title,
      dueDate: formatMaintenanceDateOnlyForLocale(
        currentItem.dueDate,
        locale === "lt" ? "lt-LT" : "en-US"
      ),
      availability: formatAvailabilityLabel(
        currentItem.availabilityStartTime ?? null,
        currentItem.availabilityEndTime ?? null
      ),
      note: currentItem.note,
      createdByLabel: serialized.createdBy?.name || serialized.createdBy?.email || null,
      action: "reminder",
      locale,
    });

    return NextResponse.json({
      ...serialized,
      ...(sent
        ? {
            notificationSuccess: getNotificationSuccessMessage(
              currentRecipients.length,
              "reminder",
              locale
            ),
          }
        : {}),
      ...(warning ? { notificationWarning: warning } : {}),
    });
  }

  const currentStatus = normalizeMaintenanceStatus(
    currentItem.status,
    currentItem.isCompleted
  );
  const recipientsWereProvided = body && "notificationRecipients" in (body as object);
  const availabilityWasProvided =
    body &&
    ("availabilityStartTime" in (body as object) ||
      "availabilityEndTime" in (body as object));
  const data: {
    machineKey?: string;
    title?: string;
    dueDate?: Date;
    note?: string | null;
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
  } else if (shouldUpgradeCurrentMachineKey) {
    await ensureAssetExists(prisma, normalizedCurrentMachineKey, session.user.id);
    data.machineKey = normalizedCurrentMachineKey;
  }
  if (title) data.title = title;
  if (dueDate) {
    const parsedDueDate = parseMaintenanceDateTime(dueDate);
    if (!parsedDueDate) {
      return NextResponse.json({ error: "dueDate is invalid" }, { status: 400 });
    }
    data.dueDate = parsedDueDate;
  }
  if (body && "note" in (body as object)) data.note = note || null;

  const nextMachineKey =
    machineKey || normalizeDeprecatedMachineKey(currentItem.machineKey);
  const nextTitle = title || currentItem.title;
  const nextDueDate = dueDate || currentItem.dueDate.toISOString();
  const nextNote =
    body && "note" in (body as object) ? note || null : currentItem.note;
  const nextRecipients = recipientsWereProvided
    ? notificationRecipients
    : normalizePlannedMaintenanceRecipients(
        JSON.parse(currentItem.notificationRecipientsJson || "[]")
      );
  const nextAvailabilityStartTime = availabilityWasProvided
    ? availabilityStartTime
    : currentItem.availabilityStartTime ?? null;
  const nextAvailabilityEndTime = availabilityWasProvided
    ? availabilityEndTime
    : currentItem.availabilityEndTime ?? null;
  if (currentItem.jiraIssueKey) {
    try {
      await updateJiraMaintenanceIssue({
        issueKey: currentItem.jiraIssueKey,
        machineKey: nextMachineKey,
        title: nextTitle,
        dueDate: getDateOnlyFromMaintenanceDateTime(nextDueDate),
        note: nextNote,
        cost: body && "cost" in (body as object) ? cost : currentItem.cost,
        status: currentStatus,
      });
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
    data: {
      ...data,
      ...(shouldBackfillCreator ? { createdById: session.user.id } : {}),
    },
    select: {
      id: true,
      machineKey: true,
      title: true,
      dueDate: true,
      note: true,
      status: withStatus,
      isCompleted: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  let resolvedCost: number | null = null;
  let resolvedAvailabilityStartTime: string | null =
    currentItem.availabilityStartTime ?? null;
  let resolvedAvailabilityEndTime: string | null =
    currentItem.availabilityEndTime ?? null;
  let jiraIssueId: string | null = null;
  let jiraIssueKey: string | null = null;
  let jiraIssueUrl: string | null = null;
  let resolvedNotificationRecipientsJson: string | null = "[]";
  let resolvedStatus: string | null = withStatus ? updated.status : null;
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
  if (recipientsWereProvided && withNotificationRecipients) {
    const rows = await prisma.$queryRaw<Array<{ notificationRecipientsJson: string | null }>>`
      UPDATE "PlannedMaintenance"
      SET "notificationRecipientsJson" = ${JSON.stringify(notificationRecipients)}
      WHERE "id" = ${id}
      RETURNING "notificationRecipientsJson"
    `;
    resolvedNotificationRecipientsJson = rows[0]?.notificationRecipientsJson ?? "[]";
  } else if (withNotificationRecipients) {
    const rows = await prisma.$queryRaw<Array<{ notificationRecipientsJson: string | null }>>`
      SELECT "notificationRecipientsJson"
      FROM "PlannedMaintenance"
      WHERE "id" = ${id}
    `;
    resolvedNotificationRecipientsJson = rows[0]?.notificationRecipientsJson ?? "[]";
  }
  if (availabilityWasProvided && withAvailability) {
    const rows = await prisma.$queryRaw<
      Array<{
        availabilityStartTime: string | null;
        availabilityEndTime: string | null;
      }>
    >`
      UPDATE "PlannedMaintenance"
      SET
        "availabilityStartTime" = ${availabilityStartTime},
        "availabilityEndTime" = ${availabilityEndTime}
      WHERE "id" = ${id}
      RETURNING "availabilityStartTime", "availabilityEndTime"
    `;
    resolvedAvailabilityStartTime = rows[0]?.availabilityStartTime ?? null;
    resolvedAvailabilityEndTime = rows[0]?.availabilityEndTime ?? null;
  } else if (withAvailability) {
    const rows = await prisma.$queryRaw<
      Array<{
        availabilityStartTime: string | null;
        availabilityEndTime: string | null;
      }>
    >`
      SELECT "availabilityStartTime", "availabilityEndTime"
      FROM "PlannedMaintenance"
      WHERE "id" = ${id}
    `;
    resolvedAvailabilityStartTime = rows[0]?.availabilityStartTime ?? null;
    resolvedAvailabilityEndTime = rows[0]?.availabilityEndTime ?? null;
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

  const serialized = serializePlannedMaintenance({
    ...updated,
    notificationRecipientsJson: resolvedNotificationRecipientsJson,
    status: resolvedStatus,
    cost: resolvedCost,
    availabilityStartTime: resolvedAvailabilityStartTime,
    availabilityEndTime: resolvedAvailabilityEndTime,
    jiraIssueId,
    jiraIssueKey,
    jiraIssueUrl,
    createdById: resolvedCreatedById,
    createdByName: resolvedCreatedByName,
    createdByEmail: resolvedCreatedByEmail,
  });
  const { sent, warning } = await sendPlannedMaintenanceNotificationEmail({
    recipients: nextRecipients as PlannedMaintenanceRecipient[],
    machineLabel: formatMachineLabel(nextMachineKey),
    title: nextTitle,
    dueDate: formatMaintenanceDateOnlyForLocale(
      nextDueDate,
      locale === "lt" ? "lt-LT" : "en-US"
    ),
    availability: formatAvailabilityLabel(
      serialized.availabilityStartTime,
      serialized.availabilityEndTime
    ),
    note: nextNote,
    createdByLabel: serialized.createdBy?.name || serialized.createdBy?.email || null,
    action: "updated",
    locale,
  });

  return NextResponse.json({
    ...serialized,
    ...(sent
      ? {
          notificationSuccess: getNotificationSuccessMessage(
            nextRecipients.length,
            "updated",
            locale
          ),
        }
      : {}),
    ...(warning ? { notificationWarning: warning } : {}),
  });
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
