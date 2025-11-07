import { NextResponse } from "next/server";

/**
 * GET /api/jira/attachment/content/[id]
 * Proxies Jira attachment content through Next.js server
 * to avoid CORS and handle authentication securely.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params; // 👈 IMPORTANT FIX

  if (!id) {
    return NextResponse.json(
      { error: "Missing attachment ID" },
      { status: 400 }
    );
  }

  try {
    // Fetch Jira attachment directly
    const jiraRes = await fetch(
      `https://svenheim.atlassian.net/rest/api/3/attachment/content/${id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
          ).toString("base64")}`,
          Accept: "*/*",
        },
      }
    );

    if (!jiraRes.ok) {
      console.error("Failed Jira attachment fetch:", jiraRes.statusText);
      return NextResponse.json(
        { error: `Jira returned ${jiraRes.status}` },
        { status: jiraRes.status }
      );
    }

    const blob = await jiraRes.blob();

    return new NextResponse(blob, {
      headers: {
        "Content-Type":
          jiraRes.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("Attachment fetch error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
