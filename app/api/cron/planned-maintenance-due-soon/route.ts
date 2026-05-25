import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateOnlyToDayKey, formatDateOnly, getCurrentLocalDayKey } from "@/lib/dateOnly";
import { parseMachineKey } from "@/lib/assets";
import { sendPlannedMaintenanceNotificationEmail } from "@/lib/plannedMaintenanceMailer";
import { normalizePlannedMaintenanceRecipients } from "@/lib/plannedMaintenanceRecipients";
import {
  getDueSoonReminderWindowDays,
  isDueSoonDayKey,
  isOpenMaintenanceStatus,
} from "@/lib/plannedMaintenanceReminder";

export const runtime = "nodejs";

type DueSoonMaintenanceRow = {
  id: string;
  machineKey: string;
  title: string;
  dueDate: Date;
  note: string | null;
  notificationRecipientsJson: string | null;
  status: string | null;
  isCompleted: boolean;
  dueSoonReminderSentForDate: string | null;
};

function isAuthorizedCronRequest(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "CRON_SECRET is not configured" },
        { status: 500 }
      ),
    };
  }

  const authHeader = request.headers.get("authorization")?.trim();
  const xCronSecret = request.headers.get("x-cron-secret")?.trim();
  const bearer = `Bearer ${secret}`;

  if (authHeader === bearer || xCronSecret === secret) {
    return { ok: true as const };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
}

function formatMachineLabel(machineKey: string) {
  const parsed = parseMachineKey(machineKey);
  if (parsed.category && parsed.subcategory) {
    return `${parsed.category} / ${parsed.subcategory}`;
  }

  return machineKey;
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

async function hasDueSoonReminderColumns() {
  const rows = await prisma.$queryRaw<
    Array<{
      dueSoonReminderSentAt: boolean;
      dueSoonReminderSentForDate: boolean;
    }>
  >`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'dueSoonReminderSentAt'
      ) AS "dueSoonReminderSentAt",
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'PlannedMaintenance'
          AND column_name = 'dueSoonReminderSentForDate'
      ) AS "dueSoonReminderSentForDate"
  `;

  return rows[0] ?? {
    dueSoonReminderSentAt: false,
    dueSoonReminderSentForDate: false,
  };
}

function selectSql(
  withStatus: boolean,
  withNotificationRecipients: boolean,
  withDueSoonReminderColumns: boolean
) {
  return Prisma.sql`
    SELECT
      "id",
      "machineKey",
      "title",
      "dueDate",
      "note",
      ${
        withNotificationRecipients
          ? Prisma.sql`"notificationRecipientsJson"`
          : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson"`
      },
      ${withStatus ? Prisma.sql`"status"` : Prisma.sql`NULL::TEXT AS "status"`},
      "isCompleted",
      ${
        withDueSoonReminderColumns
          ? Prisma.sql`"dueSoonReminderSentForDate"`
          : Prisma.sql`NULL::TEXT AS "dueSoonReminderSentForDate"`
      }
    FROM "PlannedMaintenance"
  `;
}

export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const [withStatus, withNotificationRecipients, dueSoonReminderColumns] =
    await Promise.all([
      hasStatusColumn(),
      hasNotificationRecipientsColumn(),
      hasDueSoonReminderColumns(),
    ]);
  const withDueSoonReminderColumns =
    dueSoonReminderColumns.dueSoonReminderSentAt &&
    dueSoonReminderColumns.dueSoonReminderSentForDate;

  if (!withNotificationRecipients || !withDueSoonReminderColumns) {
    return NextResponse.json(
      {
        error:
          "Planned maintenance reminder columns are not available. Apply the latest database migrations first.",
      },
      { status: 409 }
    );
  }

  const rows = await prisma.$queryRaw<DueSoonMaintenanceRow[]>(
    Prisma.sql`${selectSql(
      withStatus,
      withNotificationRecipients,
      withDueSoonReminderColumns
    )} ORDER BY "dueDate" ASC`
  );

  const todayDayKey = getCurrentLocalDayKey();
  const windowDays = getDueSoonReminderWindowDays();

  const eligibleRows = rows.filter((row) => {
    const recipients = normalizePlannedMaintenanceRecipients(
      JSON.parse(row.notificationRecipientsJson || "[]")
    );
    if (recipients.length === 0) {
      return false;
    }

    if (!isOpenMaintenanceStatus(row.status, row.isCompleted)) {
      return false;
    }

    const dueDateOnly = formatDateOnly(row.dueDate);
    const dueDayKey = dateOnlyToDayKey(dueDateOnly);
    if (dueDayKey === null || !isDueSoonDayKey(dueDayKey, todayDayKey, windowDays)) {
      return false;
    }

    return row.dueSoonReminderSentForDate !== dueDateOnly;
  });

  const sentItems: string[] = [];
  const failedItems: Array<{ id: string; warning: string }> = [];

  for (const row of eligibleRows) {
    const dueDateOnly = formatDateOnly(row.dueDate);
    const recipients = normalizePlannedMaintenanceRecipients(
      JSON.parse(row.notificationRecipientsJson || "[]")
    );
    const result = await sendPlannedMaintenanceNotificationEmail({
      recipients,
      machineLabel: formatMachineLabel(row.machineKey),
      title: row.title,
      dueDate: dueDateOnly,
      note: row.note,
      status: "planned",
      action: "reminder",
      locale: "en",
    });

    if (!result.sent) {
      failedItems.push({
        id: row.id,
        warning: result.warning || "Reminder email was not sent.",
      });
      continue;
    }

    sentItems.push(row.id);

    if (withDueSoonReminderColumns) {
      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "PlannedMaintenance"
          SET
            "dueSoonReminderSentAt" = NOW(),
            "dueSoonReminderSentForDate" = ${dueDateOnly}
          WHERE "id" = ${row.id}
        `
      );
    }
  }

  return NextResponse.json({
    ok: true,
    windowDays,
    checked: rows.length,
    eligible: eligibleRows.length,
    sent: sentItems.length,
    failed: failedItems.length,
    sentItems,
    failedItems,
  });
}
