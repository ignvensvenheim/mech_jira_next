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
      subject: "Testinis planines prieziuros pranesimas",
      react: PlannedMaintenanceEmailTemplate({
        locale: "lt",
        subjectLine: "Testinis planines prieziuros pranesimas",
        greeting: "Sveiki,",
        introLine: "Tai testinis laiskas is planines prieziuros pranesimu srauto.",
        summaryLabel: "Planine prieziura",
        detailsLabel: "Prieziuros informacija",
        footerLine:
          "Sis laiskas buvo issiustas automatiskai is prieziuros administravimo puslapio.",
        fieldLabels: {
          asset: "Irenginys",
          title: "Darbo informacija",
          dueDate: "Atlikimo data",
          availability: "Laikas",
          createdBy: "Sukure",
          note: "Aprasymas",
        },
        machineLabel: "TEST / LINE",
        title: "Testinis pranesimas",
        dueDate: "2026/05/25",
        availability: "08:00-12:00",
        createdByLabel: "Ignas Venckunas",
        note: "Sis laiskas patikrina Resend integracija.",
      }),
      text: [
        "Sveiki,",
        "",
        "Tai testinis laiskas is planines prieziuros pranesimu srauto.",
        "",
        "Irenginys: TEST / LINE",
        "Darbo informacija: Testinis pranesimas",
        "Atlikimo data: 2026/05/25",
        "Laikas: 08:00-12:00",
        "Sukure: Ignas Venckunas",
        "Aprasymas: Sis laiskas patikrina Resend integracija.",
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
