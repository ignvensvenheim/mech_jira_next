export type PlannedMaintenanceRecipient = {
  email: string;
  name: string;
};

export const PLANNED_MAINTENANCE_RECIPIENTS: PlannedMaintenanceRecipient[] = [
  { name: "Darius Kulda", email: "darkul@svenheim.lt" },
  { name: "Linas Savulionis", email: "linsav@svenheim.lt" },
  { name: "Arūnas Malažinskas", email: "arumal@svenheim.lt" },
  { name: "Rolandas Vasiliauskas", email: "rolvas@svenheim.lt" },
  { name: "Kęstutis Levarauskas", email: "keslev@svenheim.lt" },
  { name: "Alius Giniūnas", email: "meistras2a@svenheim.lt" },
  { name: "Aurimas Čyžius", email: "baldeka09@svenheim.lt" },
  { name: "Aurimas Mizeras", email: "aurmiz@svenheim.lt" },
  { name: "Ramūnas Čibirka", email: "meistras5@svenheim.lt" },
  { name: "Ramūnas Kučinskas", email: "ramunas.k@svenheim.lt" },
  { name: "Rimantas Aleknavičius", email: "rimale@svenheim.lt" },
  { name: "Stanislovas Paulauskas", email: "machinery@svenheim.lt" },
  { name: "Virginijus Čiras", email: "meistras3@svenheim.lt" },
  { name: "Mindaugas Graževičius", email: "mingra@svenheim.lt" },
  { name: "Ignas Venckūnas", email: "ignas.venckunas@svenheim.lt" },
];

const RECIPIENTS_BY_EMAIL = new Map(
  PLANNED_MAINTENANCE_RECIPIENTS.map((recipient) => [
    recipient.email.toLowerCase(),
    recipient,
  ]),
);

export function normalizePlannedMaintenanceRecipients(
  value: unknown,
): PlannedMaintenanceRecipient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const deduped = new Map<string, PlannedMaintenanceRecipient>();

  for (const item of value) {
    const email = String((item as { email?: unknown })?.email || "")
      .trim()
      .toLowerCase();
    if (!email) continue;

    const knownRecipient = RECIPIENTS_BY_EMAIL.get(email);
    if (knownRecipient) {
      deduped.set(email, knownRecipient);
      continue;
    }

    const name = String((item as { name?: unknown })?.name || "").trim();
    deduped.set(email, { email, name: name || email });
  }

  return Array.from(deduped.values());
}
