import { PlannedMaintenanceEmailTemplate } from "@/components/email-template";
import { Resend } from "resend";

export const runtime = "nodejs";

function serializeError(error: unknown) {
  if (error && typeof error === "object") {
    return {
      name: "name" in error ? String(error.name) : "Error",
      message: "message" in error ? String(error.message) : "Unknown error",
      statusCode:
        "statusCode" in error && typeof error.statusCode === "number"
          ? error.statusCode
          : null,
    };
  }

  return {
    name: "Error",
    message: String(error),
    statusCode: null,
  };
}

export async function POST() {
  try {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM?.trim() || process.env.SMTP_FROM?.trim();
    const replyTo = process.env.RESEND_REPLY_TO?.trim();

    if (!apiKey) {
      return Response.json(
        { error: { message: "RESEND_API_KEY is not configured." } },
        { status: 500 }
      );
    }

    if (!from) {
      return Response.json(
        { error: { message: "RESEND_FROM or SMTP_FROM is not configured." } },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);

    const { data, error } = await resend.emails.send({
      from,
      replyTo: replyTo || undefined,
      to: ["ignas.venckunas@svenheim.lt"],
      subject: "Test planned maintenance notification",
      react: PlannedMaintenanceEmailTemplate({
        locale: "en",
        subjectLine: "Test planned maintenance notification",
        greeting: "Hello,",
        introLine: "This is a test email from the planned maintenance notification flow.",
        summaryLabel: "Planned Maintenance",
        detailsLabel: "Maintenance details",
        footerLine: "This message was sent automatically from the maintenance admin panel.",
        fieldLabels: {
          asset: "Asset",
          title: "Maintenance title",
          dueDate: "Due date",
          availability: "Time",
          createdBy: "Created by",
          note: "Note",
        },
        machineLabel: "TEST / LINE",
        title: "Test notification",
        dueDate: "May 25, 2026",
        availability: "08:00-12:00",
        createdByLabel: "Ignas Venckūnas",
        note: "This email verifies the Resend integration.",
      }),
      text: [
        "Hello,",
        "",
        "This is a test email from the planned maintenance notification flow.",
        "",
        "Asset: TEST / LINE",
        "Maintenance title: Test notification",
        "Due date: May 25, 2026",
        "Time: 08:00-12:00",
        "Created by: Ignas Venckūnas",
        "Note: This email verifies the Resend integration.",
      ].join("\n"),
    });

    if (error) {
      return Response.json({ error: serializeError(error) }, { status: 500 });
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: serializeError(error) }, { status: 500 });
  }
}
