// app/api/jira/meta/options/route.ts
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

function requireEnv() {
  const JIRA_BASE = process.env.JIRA_BASE!;
  const JIRA_EMAIL = process.env.JIRA_EMAIL!;
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;
  if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    throw new Error("Missing Jira env vars");
  }
  return { JIRA_BASE, JIRA_EMAIL, JIRA_API_TOKEN };
}

async function jiraFetch(path: string, init?: RequestInit) {
  const { JIRA_BASE, JIRA_EMAIL, JIRA_API_TOKEN } = requireEnv();
  return fetch(`${JIRA_BASE}${path}`, {
    ...init,
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectKey = searchParams.get("projectKey") || "MECH";

  try {
    // 1) Project (get id)
    const projRes = await jiraFetch(
      `/rest/api/3/project/${encodeURIComponent(projectKey)}`
    );
    if (!projRes.ok) {
      const t = await projRes.text();
      return Response.json(
        { error: `Project lookup failed ${projRes.status}`, body: t },
        { status: 502 }
      );
    }
    const project = (await projRes.json()) as any;
    const projectId = String(project?.id ?? "");

    // 2) Statuses for the project
    const statusesRes = await jiraFetch(
      `/rest/api/3/project/${encodeURIComponent(projectKey)}/statuses`
    );
    let statuses: string[] = [];
    if (statusesRes.ok) {
      const statusesJson = (await statusesRes.json()) as any[];
      const statusSet = new Set<string>();
      for (const it of (statusesJson as any[]) || []) {
        const sts = ((it as any)?.statuses as any[]) || [];
        for (const st of sts) {
          if (st?.name) statusSet.add(String(st.name));
        }
      }
      statuses = Array.from<string>(statusSet).sort((a: string, b: string) =>
        a.localeCompare(b)
      );
    }

    // 3) Priorities (global)
    const prioritiesRes = await jiraFetch("/rest/api/3/priority");
    let priorities: string[] = [];
    if (prioritiesRes.ok) {
      const prioritiesJson = (await prioritiesRes.json()) as any[];
      priorities = Array.from<string>(
        new Set<string>(
          (prioritiesJson || [])
            .map((p: any) => String(p?.name || ""))
            .filter(Boolean) as string[]
        )
      ).sort((a: string, b: string) => a.localeCompare(b));
    }

    // 4) Assignable users (paginate with a soft cap)
    const assigneesCollected: {
      id: string;
      name: string;
      avatar?: string | null;
    }[] = [];
    {
      let startAt = 0;
      const pageSize = 50;
      const maxUsers = 500; // safety cap
      while (assigneesCollected.length < maxUsers) {
        const uRes = await jiraFetch(
          `/rest/api/3/user/assignable/search?project=${encodeURIComponent(
            projectKey
          )}&startAt=${startAt}&maxResults=${pageSize}`
        );
        if (!uRes.ok) break;
        const users = (await uRes.json()) as any[];
        if (!Array.isArray(users) || users.length === 0) break;
        for (const u of users) {
          assigneesCollected.push({
            id: String(u?.accountId || ""),
            name: String(u?.displayName || ""),
            avatar: u?.avatarUrls?.["24x24"] ?? null,
          });
        }
        startAt += users.length;
        if (users.length < pageSize) break;
      }
    }
    // Dedupe and sort by name
    const assigneeMap = new Map<
      string,
      { id: string; name: string; avatar?: string | null }
    >();
    for (const a of assigneesCollected) {
      if (a.id) assigneeMap.set(a.id, a);
    }
    const assignees = Array.from(assigneeMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // 5) Find Service Desk for this project
    let sdId: string | null = null;
    {
      let sdStart = 0;
      const sdLimit = 50;
      while (!sdId) {
        const sdRes = await jiraFetch(
          `/rest/servicedeskapi/servicedesk?start=${sdStart}&limit=${sdLimit}`
        );
        if (!sdRes.ok) break;
        const sdJson = (await sdRes.json()) as any;
        const values = (sdJson?.values as any[]) || [];
        for (const sd of values) {
          if (String(sd?.projectId) === projectId) {
            sdId = String(sd?.id);
            break;
          }
        }
        if (sdJson?.isLastPage || values.length === 0) break;
        sdStart += sdLimit;
      }
    }

    // 6) Request Types (for the service desk)
    let requestTypes: string[] = [];
    if (sdId) {
      const rtNames: string[] = [];
      let rtStart = 0;
      const rtLimit = 100;
      while (true) {
        const rtRes = await jiraFetch(
          `/rest/servicedeskapi/servicedesk/${sdId}/requesttype?start=${rtStart}&limit=${rtLimit}`
        );
        if (!rtRes.ok) break;
        const rtJson = (await rtRes.json()) as any;
        const values = (rtJson?.values as any[]) || [];
        for (const v of values) {
          if (v?.name) rtNames.push(String(v.name));
        }
        if (rtJson?.isLastPage || values.length === 0) break;
        rtStart += rtLimit;
      }
      requestTypes = Array.from<string>(new Set<string>(rtNames)).sort(
        (a: string, b: string) => a.localeCompare(b)
      );
    }

    // 7) Detect the display name of the Request Type JQL field
    let requestTypeFieldName = "Request Type"; // default on Cloud
    try {
      const fieldsRes = await jiraFetch("/rest/api/3/field");
      if (fieldsRes.ok) {
        const allFields = (await fieldsRes.json()) as any[];
        // Prefer exact matches first
        const exactRT =
          allFields.find((f) => String(f?.name) === "Request Type") ||
          allFields.find((f) => String(f?.name) === "Customer Request Type");

        if (exactRT?.name) {
          requestTypeFieldName = String(exactRT.name);
        } else {
          // Heuristic: any field whose name includes "Request Type" (avoid "participants")
          const fuzzy = allFields.find((f) => {
            const n = String(f?.name || "");
            return /request\s*type/i.test(n) && !/participants/i.test(n);
          });
          if (fuzzy?.name) {
            requestTypeFieldName = String(fuzzy.name);
          } else {
            // Last resort: schema.custom mentions 'servicedesk' and 'request'
            const bySchema = allFields.find((f) => {
              const c = String(f?.schema?.custom || "");
              return (
                c.toLowerCase().includes("servicedesk") &&
                c.toLowerCase().includes("request")
              );
            });
            if (bySchema?.name) requestTypeFieldName = String(bySchema.name);
          }
        }
      }
    } catch {
      // keep default
    }

    return new Response(
      JSON.stringify({
        projectKey,
        fieldNames: {
          requestType: requestTypeFieldName,
        },
        options: {
          statuses,
          priorities,
          assignees,
          requestTypes,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (e: any) {
    return Response.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
