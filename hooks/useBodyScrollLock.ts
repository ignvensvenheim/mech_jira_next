"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __modalScrollLockCount__?: number;
  }
}

export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked || typeof window === "undefined") {
      return;
    }

    const html = document.documentElement;
    const body = document.body;
    const nextCount = (window.__modalScrollLockCount__ ?? 0) + 1;
    window.__modalScrollLockCount__ = nextCount;

    if (nextCount === 1) {
      html.style.overflow = "hidden";
      body.style.overflow = "hidden";
    }

    return () => {
      const currentCount = window.__modalScrollLockCount__ ?? 1;
      const updatedCount = Math.max(0, currentCount - 1);
      window.__modalScrollLockCount__ = updatedCount;

      if (updatedCount === 0) {
        html.style.overflow = "";
        body.style.overflow = "";
      }
    };
  }, [isLocked]);
}
