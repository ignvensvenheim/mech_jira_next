import { parseMachineKey } from "@/lib/assets";

type JiraCreateIssueResponse = {
  id: string;
  key: string;
  self: string;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Jira env var: ${name}`);
  }
  return value;
}

function getJiraConfig() {
  const base = getRequiredEnv("JIRA_BASE").replace(/\/+$/, "");
  const email = getRequiredEnv("JIRA_EMAIL");
  const apiToken = getRequiredEnv("JIRA_API_TOKEN");
  const maintenanceProjectKey =
    process.env.JIRA_MAINTENANCE_PROJECT_KEY?.trim() || "MECH";
  const maintenanceIssueType =
    process.env.JIRA_MAINTENANCE_ISSUE_TYPE?.trim() || "Submit a request or incident";
  const maintenanceTargetStatus =
    process.env.JIRA_MAINTENANCE_TARGET_STATUS?.trim() || "To Do List";

  return {
    base,
    email,
    apiToken,
    maintenanceProjectKey,
    maintenanceIssueType,
    maintenanceTargetStatus,
  };
}

function toBasicAuth(email: string, apiToken: string) {
  return (
    "Basic " + Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64")
  );
}

function buildMaintenanceSummary(machineKey: string, title: string) {
  const { category, subcategory } = parseMachineKey(machineKey);
  const assetPrefix =
    category && subcategory ? `${category} | ${subcategory}` : machineKey;

  return `${assetPrefix} | ${title}`.slice(0, 255);
}

function buildMaintenanceDescription(args: {
  machineKey: string;
  dueDate: string;
  note: string | null;
  cost: number | null;
}) {
  const { category, subcategory } = parseMachineKey(args.machineKey);
  const lines = [
    `Planned maintenance created from the admin calendar.`,
    `Machine key: ${args.machineKey}`,
    category ? `Category: ${category}` : "",
    subcategory ? `Subcategory: ${subcategory}` : "",
    `Due date: ${args.dueDate}`,
    args.cost != null ? `Planned cost: ${args.cost.toFixed(2)} EUR` : "",
    args.note ? `Note: ${args.note}` : "",
  ].filter(Boolean);

  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: lines.join("\n") }],
      },
    ],
  };
}

function buildAdfParagraph(text: string) {
  return {
    type: "paragraph",
    content: [{ type: "text", text }],
  };
}

async function jiraRequest(
  path: string,
  init: RequestInit,
  expectedStatus: number | number[]
) {
  const { base, email, apiToken } = getJiraConfig();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: toBasicAuth(email, apiToken),
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  const data = text
    ? ((() => {
        try {
          return JSON.parse(text) as {
            errorMessages?: string[];
            errors?: Record<string, string>;
          };
        } catch {
          return {};
        }
      })())
    : {};
  const accepted = Array.isArray(expectedStatus)
    ? expectedStatus.includes(response.status)
    : response.status === expectedStatus;

  if (!accepted) {
    const fieldErrors = data.errors
      ? Object.entries(data.errors)
          .map(([field, message]) => `${field}: ${message}`)
          .join(", ")
      : "";
    const errorMessage =
      data.errorMessages?.join(", ") ||
      fieldErrors ||
      text ||
      `Jira request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  return { response, text, data };
}

export async function createJiraMaintenanceIssue(args: {
  machineKey: string;
  title: string;
  dueDate: string;
  note: string | null;
  cost: number | null;
}) {
  const {
    base,
    maintenanceProjectKey,
    maintenanceIssueType,
    maintenanceTargetStatus,
  } = getJiraConfig();

  const { text } = await jiraRequest(
    "/rest/api/3/issue",
    {
    method: "POST",
    body: JSON.stringify({
      fields: {
        project: { key: maintenanceProjectKey },
        issuetype: { name: maintenanceIssueType },
        summary: buildMaintenanceSummary(args.machineKey, args.title),
        duedate: args.dueDate,
        description: buildMaintenanceDescription(args),
        labels: ["planned-maintenance", "admin-calendar"],
      },
    }),
    },
    201
  );
  const data = text ? (JSON.parse(text) as Partial<JiraCreateIssueResponse>) : {};

  if (!data.key) {
    throw new Error("Jira issue create did not return an issue key");
  }

  await ensureJiraIssueStatus(data.key, maintenanceTargetStatus);

  return {
    id: data.id ?? "",
    key: data.key,
    self: data.self ?? `${base}/browse/${data.key}`,
    browseUrl: `${base}/browse/${data.key}`,
  };
}

export async function updateJiraMaintenanceIssue(args: {
  issueKey: string;
  machineKey: string;
  title: string;
  dueDate: string;
  note: string | null;
  cost: number | null;
  isCompleted: boolean;
}) {
  const labels = ["planned-maintenance", "admin-calendar"];
  if (args.isCompleted) {
    labels.push("maintenance-completed");
  }

  await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(args.issueKey)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        fields: {
          summary: buildMaintenanceSummary(args.machineKey, args.title),
          duedate: args.dueDate,
          description: buildMaintenanceDescription(args),
          labels,
        },
      }),
    },
    204
  );
}

export async function addJiraMaintenanceComment(args: {
  issueKey: string;
  text: string;
}) {
  await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(args.issueKey)}/comment`,
    {
      method: "POST",
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [buildAdfParagraph(args.text)],
        },
      }),
    },
    201
  );
}

export async function deleteJiraIssue(issueKey: string) {
  await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
    {
      method: "DELETE",
    },
    [204, 404]
  );
}

export async function getExistingJiraIssueKeys(issueKeys: string[]) {
  const foundKeys = new Set<string>();
  const uniqueKeys = Array.from(
    new Set(issueKeys.map((key) => key.trim()).filter(Boolean))
  );

  for (let index = 0; index < uniqueKeys.length; index += 50) {
    const chunk = uniqueKeys.slice(index, index + 50);
    if (chunk.length === 0) continue;

    const jql = `key in (${chunk.map((key) => `"${key}"`).join(", ")})`;
    const params = new URLSearchParams();
    params.set("jql", jql);
    params.set("maxResults", String(chunk.length));
    params.set("fields", "key");

    const response = await jiraRequest(
      `/rest/api/3/search/jql?${params.toString()}`,
      { method: "GET" },
      200
    );
    const issues =
      ((response.data as { issues?: Array<{ key?: string }> }).issues ?? []).filter(Boolean);

    for (const issue of issues) {
      if (issue.key) {
        foundKeys.add(issue.key);
      }
    }
  }

  return foundKeys;
}

async function ensureJiraIssueStatus(issueKey: string, targetStatusName: string) {
  const issueRes = await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`,
    { method: "GET" },
    200
  );
  const currentStatus = (issueRes.data as { fields?: { status?: { name?: string } } })?.fields
    ?.status?.name;
  if (currentStatus === targetStatusName) {
    return;
  }

  const transitionsRes = await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    { method: "GET" },
    200
  );
  const transitions = ((transitionsRes.data as { transitions?: Array<{ id: string; name?: string; to?: { name?: string } }> })?.transitions ??
    []);
  const targetTransition = transitions.find(
    (transition) =>
      transition.to?.name === targetStatusName || transition.name === targetStatusName
  );

  if (!targetTransition) {
    throw new Error(
      `Created Jira issue ${issueKey}, but could not move it to status "${targetStatusName}"`
    );
  }

  await jiraRequest(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      method: "POST",
      body: JSON.stringify({
        transition: {
          id: targetTransition.id,
        },
      }),
    },
    204
  );
}
