import * as React from "react";

type PlannedMaintenanceEmailTemplateProps = {
  locale: "en" | "lt";
  subjectLine: string;
  greeting: string;
  introLine: string;
  summaryLabel: string;
  detailsLabel: string;
  footerLine: string;
  fieldLabels: {
    asset: string;
    title: string;
    dueDate: string;
    status: string;
    note: string;
  };
  machineLabel: string;
  title: string;
  dueDate: string;
  statusLabel: string;
  note: string | null;
};

export function PlannedMaintenanceEmailTemplate({
  locale,
  subjectLine,
  greeting,
  introLine,
  summaryLabel,
  detailsLabel,
  footerLine,
  fieldLabels,
  machineLabel,
  title,
  dueDate,
  statusLabel,
  note,
}: PlannedMaintenanceEmailTemplateProps) {
  return (
    <div
      style={{
        fontFamily: locale === "lt" ? "Arial, sans-serif" : "Segoe UI, Arial, sans-serif",
        fontSize: "15px",
        color: "#1f2937",
        lineHeight: 1.65,
        backgroundColor: "#f4f7fb",
        padding: "24px 12px",
      }}
    >
      <div
        style={{
          maxWidth: "640px",
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #dbe4ea",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            padding: "24px 28px",
            background:
              "linear-gradient(135deg, #0f766e 0%, #155e75 55%, #1d4ed8 100%)",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.82,
              marginBottom: "10px",
            }}
          >
            {summaryLabel}
          </div>
          <h1 style={{ margin: 0, fontSize: "24px", lineHeight: 1.25 }}>{subjectLine}</h1>
        </div>

        <div style={{ padding: "28px" }}>
          <p style={{ margin: "0 0 14px", fontSize: "15px" }}>{greeting}</p>
          <p style={{ margin: "0 0 22px", color: "#475569" }}>{introLine}</p>

          <div
            style={{
              marginBottom: "22px",
              padding: "18px 20px",
              borderRadius: "14px",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "#64748b",
                marginBottom: "14px",
              }}
            >
              {detailsLabel}
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "14px",
              }}
            >
              <tbody>
                {[
                  [fieldLabels.asset, machineLabel],
                  [fieldLabels.title, title],
                  [fieldLabels.dueDate, dueDate],
                  [fieldLabels.status, statusLabel],
                  [fieldLabels.note, note?.trim() || "-"],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td
                      style={{
                        width: "38%",
                        padding: "8px 0",
                        verticalAlign: "top",
                        color: "#64748b",
                        fontWeight: 600,
                      }}
                    >
                      {label}
                    </td>
                    <td
                      style={{
                        padding: "8px 0",
                        verticalAlign: "top",
                        color: "#0f172a",
                      }}
                    >
                      {value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ color: "#64748b", fontSize: "13px" }}>{footerLine}</div>
        </div>
      </div>
    </div>
  );
}
