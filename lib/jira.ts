export type UserLite = {
  id: string;
  name: string;
  avatar?: string | null;
} | null;

export type NormalizedIssue = {
  id: string;
  key: string;
  summary: string;
  status: string;
  statusCategory?: string;
  priority?: string | null;
  assignee: UserLite;
  reporter: UserLite;
  created: string;
  updated: string; // added
  resolved?: string | null;
  timeSpentSeconds: number;
  remainingEstimateSeconds: number;
  issueType: string;
  project: string;
  requestType?: string | null; // JSM request type (customfield_10010)
  requestUrl?: string | null; // Agent/browse URL if present
  descriptionText?: string | null;
  mechanics?: string[]; // added
  mechanicsRaw?: unknown; // added
  worklogs: {
    id: string;
    author: UserLite;
    started: string;
    timeSpentSeconds: number;
  }[];
};

function userLite(u: any): UserLite {
  if (!u) return null;
  return {
    id: u.accountId,
    name: u.displayName,
    avatar: u.avatarUrls?.["24x24"] ?? null,
  };
}

// Simple ADF -> plain text (good enough for short descriptions)
export function adfToPlainText(doc: any): string | null {
  if (!doc) return null;
  let out = "";
  const walk = (n: any) => {
    if (!n) return;
    switch (n.type) {
      case "text":
        out += n.text ?? "";
        break;
      case "paragraph":
      case "heading":
        (n.content || []).forEach(walk);
        out += "\n";
        break;
      case "hardBreak":
        out += "\n";
        break;
      case "listItem":
        out += "• ";
        (n.content || []).forEach(walk);
        out += "\n";
        break;
      default:
        (n.content || []).forEach(walk);
    }
  };
  (doc.content || []).forEach(walk);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function mechanicsToNames(val: unknown): string[] {
  if (!val) return [];
  const label = (u: any) =>
    u?.displayName || u?.name || u?.value || u?.label || u?.key || "";

  if (Array.isArray(val)) return val.map(label).filter(Boolean);
  if (typeof val === "object") return [label(val)].filter(Boolean);
  return [String(val)];
}

export function normalizeIssue(issue: any): NormalizedIssue {
  const f = issue.fields ?? {};
  const mechanicsRaw = f.customfield_10267; // define before using

  return {
    id: issue.id,
    key: issue.key,
    summary: f.summary ?? "",
    status: f.status?.name ?? "",
    statusCategory: f.status?.statusCategory?.key,
    priority: f.priority?.name ?? null,
    assignee: userLite(f.assignee),
    reporter: userLite(f.reporter),
    created: f.created,
    updated: f.updated, // added
    resolved: f.resolutiondate ?? null,
    timeSpentSeconds: f.timetracking?.timeSpentSeconds ?? f.timespent ?? 0,
    remainingEstimateSeconds: f.timetracking?.remainingEstimateSeconds ?? 0,
    issueType: f.issuetype?.name ?? "",
    project: f.project?.name ?? "",
    requestType: f.customfield_10010?.requestType?.name ?? null,
    requestUrl: f.customfield_10010?._links?.agent ?? null,
    descriptionText: adfToPlainText(f.description),
    mechanics: mechanicsToNames(mechanicsRaw),
    mechanicsRaw,
    worklogs: (f.worklog?.worklogs ?? []).map((w: any) => ({
      id: w.id,
      author: userLite(w.author),
      started: w.started,
      timeSpentSeconds: w.timeSpentSeconds,
    })),
  };
}
