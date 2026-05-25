import { Resend } from "resend";
import { PlannedMaintenanceEmailTemplate } from "@/components/email-template";
import type { Locale } from "@/lib/i18n";
import type { PlannedMaintenanceRecipient } from "./plannedMaintenanceRecipients";

type MailResult = {
  sent: boolean;
  warning: string | null;
};

type PlannedMaintenanceMailArgs = {
  recipients: PlannedMaintenanceRecipient[];
  machineLabel: string;
  title: string;
  dueDate: string;
  note: string | null;
  status: "planned" | "inProgress" | "waitingForParts" | "completed" | "cancelled";
  action: "created" | "updated" | "reminder";
  locale?: Locale;
};

function getResendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim() || "";

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

function resolveLocale(locale: string | undefined): Locale {
  return locale === "lt" ? "lt" : "en";
}

function getMailCopy(
  locale: Locale,
  action: "created" | "updated" | "reminder",
  status: PlannedMaintenanceMailArgs["status"]
) {
  const statusLabels =
    locale === "lt"
      ? {
          planned: "Suplanuota",
          inProgress: "Vykdoma",
          waitingForParts: "Laukiama dalių",
          completed: "Atlikta",
          cancelled: "Atšaukta",
        }
      : {
          planned: "Planned",
          inProgress: "In progress",
          waitingForParts: "Waiting for parts",
          completed: "Completed",
          cancelled: "Cancelled",
        };

  if (locale === "lt") {
    const subjectPrefix =
      action === "created"
        ? "Nauja planinė priežiūra"
        : action === "updated"
          ? "Atnaujinta planinė priežiūra"
          : "Planinės priežiūros priminimas";
    return {
      subjectPrefix,
      greeting: "Sveiki,",
      introLine:
        action === "reminder"
          ? "Primename apie artėjančią planinės priežiūros užduotį."
          : "Jūs buvote pasirinkti gauti šios planinės priežiūros pranešimus.",
      summaryLabel: "Planinė priežiūra",
      detailsLabel: "Priežiūros informacija",
      footerLine:
        "Šis laiškas buvo išsiųstas automatiškai iš priežiūros administravimo skydelio.",
      fieldLabels: {
        asset: "Įrenginys",
        title: "Priežiūros pavadinimas",
        dueDate: "Atlikti iki",
        status: "Būsena",
        note: "Aprašymas",
      },
      statusLabel: statusLabels[status],
      textClosing:
        "Šis laiškas buvo išsiųstas automatiškai iš priežiūros administravimo skydelio.",
    };
  }

  const subjectPrefix =
    action === "created"
      ? "New planned maintenance"
      : action === "updated"
        ? "Updated planned maintenance"
        : "Planned maintenance reminder";
  return {
    subjectPrefix,
    greeting: "Hello,",
    introLine:
      action === "reminder"
        ? "This is a reminder about an upcoming planned maintenance item."
        : "You were selected to receive notifications for this planned maintenance item.",
    summaryLabel: "Planned Maintenance",
    detailsLabel: "Maintenance details",
    footerLine:
      "This message was sent automatically from the maintenance admin panel.",
    fieldLabels: {
      asset: "Asset",
      title: "Maintenance title",
      dueDate: "Due date",
      status: "Status",
      note: "Description",
    },
    statusLabel: statusLabels[status],
    textClosing: "This message was sent automatically from the maintenance admin panel.",
  };
}

export async function sendPlannedMaintenanceNotificationEmail(
  args: PlannedMaintenanceMailArgs
): Promise<MailResult> {
  if (args.recipients.length === 0) {
    return { sent: false, warning: null };
  }

  const config = getResendConfig();
  if (!config) {
    return {
      sent: false,
      warning:
        "Email notifications were not sent because Resend is not configured.",
    };
  }

  const resend = new Resend(config.apiKey);
  const locale = resolveLocale(args.locale);
  const copy = getMailCopy(locale, args.action, args.status);
  const subject = `${copy.subjectPrefix}: ${args.machineLabel} | ${args.title}`;
  const text = [
    copy.greeting,
    ``,
    copy.introLine,
    ``,
    `${copy.fieldLabels.asset}: ${args.machineLabel}`,
    `${copy.fieldLabels.title}: ${args.title}`,
    `${copy.fieldLabels.dueDate}: ${args.dueDate}`,
    `${copy.fieldLabels.status}: ${copy.statusLabel}`,
    `${copy.fieldLabels.note}: ${args.note?.trim() || "-"}`,
    ``,
    copy.textClosing,
  ].join("\n");

  try {
    const { error } = await resend.emails.send({
      from: config.from,
      to: args.recipients.map((recipient) => recipient.email),
      subject,
      react: PlannedMaintenanceEmailTemplate({
        locale,
        subjectLine: subject,
        greeting: copy.greeting,
        introLine: copy.introLine,
        summaryLabel: copy.summaryLabel,
        detailsLabel: copy.detailsLabel,
        footerLine: copy.footerLine,
        fieldLabels: copy.fieldLabels,
        machineLabel: args.machineLabel,
        title: args.title,
        dueDate: args.dueDate,
        statusLabel: copy.statusLabel,
        note: args.note,
      }),
      text,
    });

    if (error) {
      throw error;
    }

    return { sent: true, warning: null };
  } catch (error) {
    console.error("Failed to send planned maintenance notification email", error);
    return {
      sent: false,
      warning: "Notification emails could not be sent.",
    };
  }
}
