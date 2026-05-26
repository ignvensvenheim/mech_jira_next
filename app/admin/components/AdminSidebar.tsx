"use client";

import Link from "next/link";
import type { AdminFunction, AdminTranslate } from "../adminShared";

type AdminSidebarProps = {
  activeFunction?: AdminFunction | null;
  currentUserLabel: string;
  currentUserCanManageUsers: boolean;
  onSelectFunction?: (value: AdminFunction) => void;
  getFunctionHref?: (value: AdminFunction) => string;
  title?: string;
  onLogout: () => void;
  t: AdminTranslate;
};

export default function AdminSidebar({
  activeFunction,
  currentUserLabel,
  currentUserCanManageUsers,
  onSelectFunction,
  getFunctionHref,
  title,
  onLogout,
  t,
}: AdminSidebarProps) {
  const items: Array<{
    value: AdminFunction;
    label: string;
  }> = [
    { value: "costs", label: t("admin.timeAndCost") },
    { value: "maintenance", label: t("admin.plannedMaintenance") },
    { value: "statistics", label: t("admin.statistics") },
    { value: "inventory", label: t("admin.manageInventory") },
  ];

  if (currentUserCanManageUsers) {
    items.push({ value: "users", label: t("admin.manageUsers") });
  }

  return (
    <aside className="page__sidebar">
      <div className="admin-sidebar">
        <div className="admin-sidebar__section">
          <div className="admin-sidebar__header">
            <div className="admin-sidebar__title">{title || t("admin.tools")}</div>
            {currentUserLabel && (
              <div className="admin-sidebar__session">{currentUserLabel}</div>
            )}
          </div>
          <div className="admin-sidebar__actions">
            {items.map((item) => {
              const className = `admin-function-button ${
                activeFunction === item.value ? "admin-function-button--active" : ""
              }`.trim();
              const content = item.label;

              if (getFunctionHref) {
                return (
                  <Link key={item.value} href={getFunctionHref(item.value)} className={className}>
                    {content}
                  </Link>
                );
              }

              return (
                <button
                  key={item.value}
                  type="button"
                  className={className}
                  onClick={() => onSelectFunction?.(item.value)}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </div>

        <div className="admin-sidebar__section admin-sidebar__section--bottom">
          <Link href="/" className="page__action-link admin-sidebar__link">
            {t("common.backToHome")}
          </Link>
          <button
            type="button"
            className="page__action-link admin-sidebar__link"
            onClick={onLogout}
          >
            {t("common.logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
