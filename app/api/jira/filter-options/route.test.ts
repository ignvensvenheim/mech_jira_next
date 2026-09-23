// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("Jira filter metadata", () => {
  let labels: string[];
  let failFields: boolean;

  beforeEach(() => {
    labels = ["Homag POWER LINE", "IMA line", "IMA line"];
    failFields = false;
    vi.stubEnv("JIRA_BASE", "https://jira.example");
    vi.stubEnv("JIRA_EMAIL", "test@example.com");
    vi.stubEnv("JIRA_API_TOKEN", "test-token");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn(async (input: string, init: RequestInit) => {
      expect(init.cache).toBe("no-store");
      const url = new URL(input);
      if (url.pathname === "/rest/api/3/field") {
        return Response.json([{
          id: "mb1", name: "MB1",
          schema: { custom: "com.atlassian.jira.plugin.system.customfieldtypes:select" },
        }]);
      }
      if (url.pathname === "/rest/servicedeskapi/servicedesk") {
        return Response.json(url.searchParams.get("start") === "0"
          ? { values: [{ id: "1", projectKey: "OTHER" }], isLastPage: false }
          : { values: [{ id: "40", projectKey: "MECH" }], isLastPage: true });
      }
      if (url.pathname.endsWith("/requesttype")) {
        return Response.json({ values: [
          { id: "163", name: "MB1" }, { id: "227", name: "PB" },
          { id: "228", name: "Spec. baras" }, { id: "123", name: "Emailed request" },
        ], isLastPage: true });
      }
      if (url.pathname.endsWith("/163/field")) {
        if (failFields) return new Response("Unavailable", { status: 503 });
        return Response.json({ requestTypeFields: [
          { fieldId: "mb1", validValues: labels.map((label) => ({ label })) },
          { fieldId: "priority", validValues: [{ label: "Urgent" }] },
        ] });
      }
      throw new Error(`Unexpected URL: ${url.pathname}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("loads complete lists across pages, excludes unrelated fields, and keeps PB empty", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ departmentLines: {
      MB1: ["Homag POWER LINE", "IMA line"], PB: [], SPEC: [],
    } });
  });

  it("removes deleted options on the next request, including the last option", async () => {
    await GET();
    labels = ["IMA line"];
    expect((await (await GET()).json()).departmentLines.MB1).toEqual(["IMA line"]);
    labels = [];
    expect((await (await GET()).json()).departmentLines.MB1).toEqual([]);
  });

  it("returns an error instead of incomplete lists when Jira fails", async () => {
    failFields = true;
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Unable to load complete Jira category lists" });
  });

  it("does not call Jira without credentials", async () => {
    vi.stubEnv("JIRA_API_TOKEN", "");
    expect((await GET()).status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });
});
