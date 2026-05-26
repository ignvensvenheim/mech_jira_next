"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { AdminFunction } from "../adminShared";

export function useAdminSession(searchParams: ReadonlyURLSearchParams) {
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserLabel, setCurrentUserLabel] = useState("");
  const [currentUserIsAdmin, setCurrentUserIsAdmin] = useState(false);
  const [currentUserCanManageUsers, setCurrentUserCanManageUsers] = useState(false);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [activeFunction, setActiveFunction] = useState<AdminFunction>("costs");

  const handleLogout = useCallback(() => {
    void signOut({ callbackUrl: "/login" });
  }, []);

  useEffect(() => {
    const requestedView = searchParams.get("view");
    if (
      requestedView === "costs" ||
      requestedView === "maintenance" ||
      requestedView === "inventory" ||
      requestedView === "users" ||
      requestedView === "statistics"
    ) {
      setActiveFunction(requestedView);
    }
  }, [searchParams]);

  useEffect(() => {
    if (sessionResolved && !currentUserIsAdmin && activeFunction === "users") {
      setActiveFunction("costs");
    }
  }, [activeFunction, currentUserIsAdmin, sessionResolved]);

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          user?: {
            id?: string | null;
            name?: string | null;
            email?: string | null;
            role?: string | null;
          };
        };
        const userId = String(data.user?.id || "");
        const normalizedName = String(data.user?.name || "").trim().toLowerCase();
        const normalizedEmail = String(data.user?.email || "").trim().toLowerCase();
        const normalizedRole = String(data.user?.role || "").trim().toUpperCase();
        const displayName = String(data.user?.name || "").trim();
        const displayEmail = String(data.user?.email || "").trim();
        const emailLocalPart = normalizedEmail.includes("@")
          ? normalizedEmail.split("@")[0]
          : normalizedEmail;
        const isSuperAdmin = normalizedName === "ignven" || emailLocalPart === "ignven";
        const isAdmin = normalizedRole === "ADMIN" || isSuperAdmin;

        setCurrentUserId(userId);
        setCurrentUserLabel(displayName || displayEmail || userId);
        setCurrentUserIsAdmin(isAdmin);
        setCurrentUserCanManageUsers(isSuperAdmin);
      } catch {
        setCurrentUserId("");
        setCurrentUserLabel("");
        setCurrentUserIsAdmin(false);
        setCurrentUserCanManageUsers(false);
      } finally {
        setSessionResolved(true);
      }
    };

    void loadSession();
  }, []);

  return {
    currentUserId,
    currentUserLabel,
    currentUserIsAdmin,
    currentUserCanManageUsers,
    sessionResolved,
    activeFunction,
    setActiveFunction,
    handleLogout,
  };
}
