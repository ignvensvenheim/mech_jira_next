import nodemailer from "nodemailer";
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
  statusLabel: string;
  action: "created" | "updated" | "reminder";
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const portRaw = process.env.SMTP_PORT?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const secureRaw = process.env.SMTP_SECURE?.trim().toLowerCase();

  if (!host || !portRaw || !user || !pass || !from) {
    return null;
  }

  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  return {
    host,
    port,
    secure: secureRaw === "true" || port === 465,
    user,
    pass,
    from,
  };
}

export async function sendPlannedMaintenanceNotificationEmail(
  args: PlannedMaintenanceMailArgs
): Promise<MailResult> {
  if (args.recipients.length === 0) {
    return { sent: false, warning: null };
  }

  const config = getSmtpConfig();
  if (!config) {
    return {
      sent: false,
      warning:
        "Email notifications were not sent because SMTP is not configured.",
    };
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const subjectPrefix =
    args.action === "created"
      ? "New planned maintenance"
      : args.action === "updated"
        ? "Updated planned maintenance"
        : "Planned maintenance reminder";
  const subject = `${subjectPrefix}: ${args.machineLabel} | ${args.title}`;
  const introLine =
    args.action === "reminder"
      ? "This is a reminder about an upcoming planned maintenance item."
      : "You were selected for a planned maintenance item.";
  const noteSection = args.note?.trim() ? `Note: ${args.note.trim()}` : "Note: -";
  const text = [
    `Hello,`,
    ``,
    introLine,
    ``,
    `Asset: ${args.machineLabel}`,
    `Title: ${args.title}`,
    `Due date: ${args.dueDate}`,
    `Status: ${args.statusLabel}`,
    noteSection,
    ``,
    `This message was sent automatically from the maintenance admin panel.`,
  ].join("\n");

  try {
    await transporter.sendMail({
      from: config.from,
      to: args.recipients.map((recipient) => recipient.email),
      subject,
      text,
    });

    return { sent: true, warning: null };
  } catch (error) {
    console.error("Failed to send planned maintenance notification email", error);
    return {
      sent: false,
      warning: "Notification emails could not be sent.",
    };
  }
}
