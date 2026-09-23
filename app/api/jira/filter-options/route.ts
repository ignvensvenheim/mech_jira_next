export const runtime = "nodejs";

type RequestType = { id: string; name: string };
type RequestField = {
  fieldId: string;
  validValues?: { label: string }[];
};

export async function GET() {
  const { JIRA_BASE, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
  if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json({ error: "Missing Jira env vars" }, { status: 500 });
  }

  async function get<T>(path: string): Promise<T> {
    const response = await fetch(`${JIRA_BASE!.replace(/\/+$/, "")}${path}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64")}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Jira metadata request failed (${response.status})`);
    return response.json();
  }

  async function getAll<T>(path: string): Promise<T[]> {
    const values: T[] = [];
    let start = 0;
    while (true) {
      const page = await get<{ values: T[]; isLastPage: boolean }>(
        `${path}?start=${start}&limit=100`
      );
      values.push(...page.values);
      if (page.isLastPage || page.values.length === 0) return values;
      start += page.values.length;
    }
  }

  try {
    const [desks, fields] = await Promise.all([
      getAll<{ id: string; projectKey: string }>("/rest/servicedeskapi/servicedesk"),
      get<{ id: string; name: string; schema?: { custom?: string } }[]>("/rest/api/3/field"),
    ]);
    const desk = desks.find((item) => item.projectKey === "MECH");
    if (!desk) throw new Error("MECH service desk is unavailable");
    const path = `/rest/servicedeskapi/servicedesk/${encodeURIComponent(desk.id)}/requesttype`;
    const requestTypes = await getAll<RequestType>(path);
    // Equipment fields share their category's request-type name in Jira.
    // Other select fields (priority, reporter names) must not become equipment.
    const entries = await Promise.all(requestTypes.map(async (requestType) => {
      const category = requestType.name === "Spec. baras" ? "SPEC" : requestType.name;
      if (category === "PB" || category === "SPEC") return [category, []] as const;
      const equipmentField = fields.find((field) =>
        field.name.toLowerCase() === requestType.name.toLowerCase() &&
        field.schema?.custom === "com.atlassian.jira.plugin.system.customfieldtypes:select"
      );
      if (!equipmentField) return null;
      const metadata = await get<{ requestTypeFields: RequestField[] }>(
        `${path}/${encodeURIComponent(requestType.id)}/field`
      );
      const field = metadata.requestTypeFields.find((item) => item.fieldId === equipmentField.id);
      if (!field) throw new Error(`Equipment list unavailable for ${category}`);
      return [category, [...new Set((field.validValues ?? []).map((option) => option.label))]] as const;
    }));
    return Response.json(
      { departmentLines: Object.fromEntries(entries.filter((entry) => entry !== null)) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Unable to load Jira filter options", error);
    return Response.json({ error: "Unable to load complete Jira category lists" }, { status: 502 });
  }
}
