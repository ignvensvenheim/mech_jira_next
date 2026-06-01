const DEFAULT_ADMIN_CALLBACK_URL = "/admin";

export function sanitizeAdminCallbackUrl(
  callbackUrl: string | null | undefined,
): string {
  if (!callbackUrl) {
    return DEFAULT_ADMIN_CALLBACK_URL;
  }

  const normalized = callbackUrl.trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//")) {
    return DEFAULT_ADMIN_CALLBACK_URL;
  }

  try {
    const url = new URL(normalized, "http://localhost");
    if (url.origin !== "http://localhost") {
      return DEFAULT_ADMIN_CALLBACK_URL;
    }

    if (!url.pathname.startsWith("/admin")) {
      return DEFAULT_ADMIN_CALLBACK_URL;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_ADMIN_CALLBACK_URL;
  }
}

export { DEFAULT_ADMIN_CALLBACK_URL };
