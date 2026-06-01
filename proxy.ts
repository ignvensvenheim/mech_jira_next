import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import authConfig from "@/auth.config";
import { sanitizeAdminCallbackUrl } from "@/lib/authRedirect";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();

  if (req.auth?.user?.id) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set(
    "callbackUrl",
    sanitizeAdminCallbackUrl(`${pathname}${req.nextUrl.search}`),
  );
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/admin/:path*"],
};
