import { describe, expect, it } from "vitest";
import { sanitizeAdminCallbackUrl } from "@/lib/authRedirect";

describe("sanitizeAdminCallbackUrl", () => {
  it("allows relative admin paths", () => {
    expect(sanitizeAdminCallbackUrl("/admin/users?tab=active")).toBe(
      "/admin/users?tab=active",
    );
  });

  it("falls back for non-admin paths", () => {
    expect(sanitizeAdminCallbackUrl("/login")).toBe("/admin");
  });

  it("falls back for external URLs", () => {
    expect(sanitizeAdminCallbackUrl("https://example.com/admin")).toBe("/admin");
  });

  it("falls back for protocol-relative URLs", () => {
    expect(sanitizeAdminCallbackUrl("//example.com/admin")).toBe("/admin");
  });
});
