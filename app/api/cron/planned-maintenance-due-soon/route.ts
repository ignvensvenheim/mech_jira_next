import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  dateOnlyToDayKey,
  formatDateOnly,
  formatMaintenanceDateTimeForLocale,
  getCurrentLocalDayKey,
} from "@/lib/dateOnly";
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
  availabilityStartTime: string | null;
  availabilityEndTime: string | null;
  note: string | null;
  notificationRecipientsJson: string | null;
  status: string | null;
  isCompleted: boolean;
  dueSoonReminderSentForDate: string | null;
  createdByName: string | null;
  createdByEmail: string | null;
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

function formatAvailabilityLabel(
  startTime: string | null,
  endTime: string | null
) {
  if (startTime && endTime) {
    return `${startTime}-${endTime}`;
  }

  return startTime || null;
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
  withAvailability: boolean,
  withStatus: boolean,
  withNotificationRecipients: boolean,
  withDueSoonReminderColumns: boolean,
  withCreatedBy: boolean
) {
  return Prisma.sql`
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
        withNotificationRecipients
          ? Prisma.sql`pm."notificationRecipientsJson"`
          : Prisma.sql`'[]'::TEXT AS "notificationRecipientsJson"`
      },
      ${withStatus ? Prisma.sql`pm."status"` : Prisma.sql`NULL::TEXT AS "status"`},
      pm."isCompleted",
      ${
        withDueSoonReminderColumns
          ? Prisma.sql`pm."dueSoonReminderSentForDate"`
          : Prisma.sql`NULL::TEXT AS "dueSoonReminderSentForDate"`
      },
      ${
        withCreatedBy
          ? Prisma.sql`u."name" AS "createdByName", u."email" AS "createdByEmail"`
          : Prisma.sql`NULL::TEXT AS "createdByName", NULL::TEXT AS "createdByEmail"`
      }
    FROM "PlannedMaintenance" pm
    ${withCreatedBy ? Prisma.sql`LEFT JOIN "User" u ON u."id" = pm."createdById"` : Prisma.empty}
  `;
}

export async function GET(request: Request) {
  const auth = isAuthorizedCronRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  const [availabilityColumns, withStatus, withNotificationRecipients, dueSoonReminderColumns, withCreatedBy] =
    await Promise.all([
      hasAvailabilityColumns(),
      hasStatusColumn(),
      hasNotificationRecipientsColumn(),
      hasDueSoonReminderColumns(),
      hasCreatedByColumn(),
    ]);
  const withAvailability =
    availabilityColumns.availabilityStartTime &&
    availabilityColumns.availabilityEndTime;
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
      withAvailability,
      withStatus,
      withNotificationRecipients,
      withDueSoonReminderColumns,
      withCreatedBy
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
      dueDate: formatMaintenanceDateTimeForLocale(row.dueDate, "en-US"),
      availability: formatAvailabilityLabel(
        row.availabilityStartTime,
        row.availabilityEndTime
      ),
      note: row.note,
      createdByLabel: row.createdByName || row.createdByEmail || null,
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
