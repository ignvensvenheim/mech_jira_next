// app/api/jira/search/route.ts
import { NextRequest } from "next/server";
import { normalizeIssue } from "@/lib/jira";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const JIRA_BASE = process.env.JIRA_BASE!;
  const JIRA_EMAIL = process.env.JIRA_EMAIL!;
  const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN!;
  if (!JIRA_BASE || !JIRA_EMAIL || !JIRA_API_TOKEN) {
    return Response.json(
      { issues: [], error: "Missing Jira env vars" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const jql = searchParams.get("jql") ?? "project = MECH ORDER BY created DESC";
  const maxResults = Number(searchParams.get("maxResults") ?? 20);
  const nextPageToken = searchParams.get("nextPageToken") ?? undefined;

  const params = new URLSearchParams();
  params.set("jql", jql);
  params.set("maxResults", String(maxResults));
  if (nextPageToken) params.set("nextPageToken", nextPageToken);
  params.set(
    "fields",
    [
      "summary",
      "status",
      "priority",
      "assignee",
      "reporter",
      "created",
      "resolved",
      "resolutiondate",
      "timetracking",
      "worklog",
      "issuetype",
      "project",
      "description",
      "customfield_10010", // request type
      "customfield_10267", // <-- mechanics
    ].join(",")
  );
  params.set("expand", "customfield_10010.requestType");

  const upstream = await fetch(
    `${JIRA_BASE}/rest/api/3/search/jql?${params.toString()}`,
    {
      headers: {
        Authorization:
          "Basic " +
          Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString("base64"),
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  const text = await upstream.text();
  if (!upstream.ok) {
    return new Response(
      JSON.stringify({
        issues: [],
        error: `Upstream Jira ${upstream.status}`,
        body: text,
      }),
      { status: upstream.status }
    );
  }

  const data = JSON.parse(text);
  return Response.json({
    paging: {
      maxResults: data.maxResults ?? maxResults,
      nextPageToken: data.nextPageToken ?? null,
      isLast: data.isLast ?? undefined,
    },
    issues: (data.issues ?? []).map(normalizeIssue),
  });
}
