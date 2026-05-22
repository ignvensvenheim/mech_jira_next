import { NextResponse } from "next/server";

function getAllowedOrigins(requestUrl: string) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(requestUrl).origin);
  } catch {
    // Ignore malformed request URL here and let the caller handle auth failures normally.
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) {
    try {
      origins.add(new URL(nextAuthUrl).origin);
    } catch {
      // Ignore malformed NEXTAUTH_URL values.
    }
  }

  return origins;
}

export function requireTrustedOrigin(req: Request) {
  const allowedOrigins = getAllowedOrigins(req.url);
  const origin = req.headers.get("origin")?.trim();

  if (origin) {
    if (allowedOrigins.has(origin)) {
      return null;
    }

    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  const referer = req.headers.get("referer")?.trim();
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (allowedOrigins.has(refererOrigin)) {
        return null;
      }
    } catch {
      return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
    }

    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  return NextResponse.json({ error: "Origin header required" }, { status: 403 });
}
