import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/requireAdmin";
import { requireTrustedOrigin } from "@/lib/requireTrustedOrigin";
import { ensureAssetExists, isConcreteMachineKey, parseMachineKey } from "@/lib/assets";
import { formatDateOnly, parseDateOnly } from "@/lib/dateOnly";
import {
  addJiraMaintenanceComment,
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
  note: string | null;
  notificationRecipientsJson?: string | null;
  status: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
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
    status,
    cost: item.cost ?? null,
    jiraIssueId: item.jiraIssueId ?? null,
    jiraIssueKey: item.jiraIssueKey ?? null,
    jiraIssueUrl: item.jiraIssueUrl ?? null,
    isCompleted: status === "completed",
    completedAt: status === "completed" ? item.completedAt : null,
    dueDate: formatDateOnly(item.dueDate),
  };
}

function formatMachineLabel(machineKey: string) {
  const parsed = parseMachineKey(machineKey);
  if (parsed.category && parsed.subcategory) {
    return `${parsed.category} / ${parsed.subcategory}`;
  }

  return machineKey;
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

function getNotificationSuccessMessage(recipientCount: number, action: "updated" | "reminder") {
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

function getMaintenanceStatusComment(status: string) {
  switch (status) {
    case "planned":
      return "Maintenance moved back to planned in the admin calendar.";
    case "inProgress":
      return "Maintenance marked in progress in the admin calendar.";
    case "waitingForParts":
      return "Maintenance marked waiting for parts in the admin calendar.";
    case "completed":
      return "Maintenance marked completed in the admin calendar.";
    case "cancelled":
      return "Maintenance cancelled in the admin calendar.";
    default:
      return "Maintenance status updated in the admin calendar.";
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
  const machineKey = String(body?.machineKey || "").trim();
  const title = String(body?.title || "").trim();
  const dueDate = String(body?.dueDate || "").trim();
  const note = String(body?.note || "").trim();
  const notificationRecipients = normalizePlannedMaintenanceRecipients(
    body?.notificationRecipients
  );
  const locale = getRequestLocale(body?.locale);
  const action = String(body?.action || "").trim();
  const statusRaw = body?.status;
  const costRaw = body?.cost;
  const cost =
    costRaw === "" || costRaw === null || typeof costRaw === "undefined"
      ? null
      : Number(costRaw);

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const [withCost, jiraLinkColumns, withStatus, withNotificationRecipients] = await Promise.all([
    hasCostColumn(),
    hasJiraLinkColumns(),
    hasStatusColumn(),
    hasNotificationRecipientsColumn(),
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
      notificationRecipientsJson: string | null;
      status: string | null;
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
        ${
          withStatus
            ? Prisma.sql`"status"`
            : Prisma.sql`NULL::TEXT AS "status"`
        },
        ${
          withNotificationRecipients
            ? Prisma.sql`"notificationRecipientsJson"`
            : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson"`
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
    });
    const { sent, warning } = await sendPlannedMaintenanceNotificationEmail({
      recipients: currentRecipients,
      machineLabel: formatMachineLabel(currentItem.machineKey),
      title: currentItem.title,
      dueDate: formatDateOnly(currentItem.dueDate),
      note: currentItem.note,
      status: currentStatus,
      action: "reminder",
      locale,
    });

    return NextResponse.json({
      ...serialized,
      ...(sent
        ? {
            notificationSuccess: getNotificationSuccessMessage(
              currentRecipients.length,
              "reminder"
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
  const requestedStatus =
    typeof statusRaw === "string" || statusRaw == null
      ? normalizeMaintenanceStatus(statusRaw, currentItem.isCompleted)
      : currentStatus;
  const statusWasProvided = body && "status" in (body as object);
  const recipientsWereProvided = body && "notificationRecipients" in (body as object);
  const data: {
    machineKey?: string;
    title?: string;
    dueDate?: Date;
    note?: string | null;
    status?: "planned" | "inProgress" | "waitingForParts" | "completed" | "cancelled";
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
  if (statusWasProvided) {
    if (withStatus) {
      data.status = requestedStatus;
    }
    data.isCompleted = requestedStatus === "completed";
    data.completedAt = requestedStatus === "completed" ? new Date() : null;
  }

  const nextMachineKey = machineKey || currentItem.machineKey;
  const nextTitle = title || currentItem.title;
  const nextDueDate = dueDate || formatDateOnly(currentItem.dueDate);
  const nextNote =
    body && "note" in (body as object) ? note || null : currentItem.note;
  const nextRecipients = recipientsWereProvided
    ? notificationRecipients
    : normalizePlannedMaintenanceRecipients(
        JSON.parse(currentItem.notificationRecipientsJson || "[]")
      );
  const nextStatus = statusWasProvided ? requestedStatus : currentStatus;

  if (currentItem.jiraIssueKey) {
    try {
      await updateJiraMaintenanceIssue({
        issueKey: currentItem.jiraIssueKey,
        machineKey: nextMachineKey,
        title: nextTitle,
        dueDate: nextDueDate,
        note: nextNote,
        cost: body && "cost" in (body as object) ? cost : currentItem.cost,
        status: nextStatus,
      });

      if (statusWasProvided && nextStatus !== currentStatus) {
        await addJiraMaintenanceComment({
          issueKey: currentItem.jiraIssueKey,
          text: getMaintenanceStatusComment(nextStatus),
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
      status: withStatus,
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
    jiraIssueId,
    jiraIssueKey,
    jiraIssueUrl,
  });
  const { sent, warning } = await sendPlannedMaintenanceNotificationEmail({
    recipients: nextRecipients as PlannedMaintenanceRecipient[],
    machineLabel: formatMachineLabel(nextMachineKey),
    title: nextTitle,
    dueDate: nextDueDate,
    note: nextNote,
    status: nextStatus,
    action: "updated",
    locale,
  });

  return NextResponse.json({
    ...serialized,
    ...(sent
      ? {
          notificationSuccess: getNotificationSuccessMessage(
            nextRecipients.length,
            "updated"
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
