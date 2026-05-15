"use client";

import Link from "next/link";
import type { AdminFunction, AdminTranslate } from "../adminShared";

type AdminSidebarProps = {
  activeFunction: AdminFunction;
  currentUserLabel: string;
  currentUserCanManageUsers: boolean;
  maintenanceBadgeCount: number;
  onSelectFunction: (value: AdminFunction) => void;
  onLogout: () => void;
  t: AdminTranslate;
};

export default function AdminSidebar({
  activeFunction,
  currentUserLabel,
  currentUserCanManageUsers,
  maintenanceBadgeCount,
  onSelectFunction,
  onLogout,
  t,
}: AdminSidebarProps) {
  return (
    <aside className="page__sidebar">
      <div className="admin-sidebar">
        <div className="admin-sidebar__section">
          <div className="admin-sidebar__header">
            <div className="admin-sidebar__title">{t("admin.tools")}</div>
            {currentUserLabel && (
              <div className="admin-sidebar__session">{currentUserLabel}</div>
            )}
          </div>
          <div className="admin-sidebar__actions">
            <button
              type="button"
              className={`admin-function-button ${
                activeFunction === "costs" ? "admin-function-button--active" : ""
              }`}
              onClick={() => onSelectFunction("costs")}
            >
              {t("admin.timeAndCost")}
            </button>
            <button
              type="button"
              className={`admin-function-button ${
                activeFunction === "maintenance"
                  ? "admin-function-button--active"
                  : ""
              }`}
              onClick={() => onSelectFunction("maintenance")}
            >
              <span className="admin-function-button__content">
                <span>{t("admin.plannedMaintenance")}</span>
                {maintenanceBadgeCount > 0 && (
                  <span className="admin-function-badge">{maintenanceBadgeCount}</span>
                )}
              </span>
            </button>
            <button
              type="button"
              className={`admin-function-button ${
                activeFunction === "statistics"
                  ? "admin-function-button--active"
                  : ""
              }`}
              onClick={() => onSelectFunction("statistics")}
            >
              {t("admin.statistics")}
            </button>
            <button
              type="button"
              className={`admin-function-button ${
                activeFunction === "inventory"
                  ? "admin-function-button--active"
                  : ""
              }`}
              onClick={() => onSelectFunction("inventory")}
            >
              {t("admin.manageInventory")}
            </button>
            {currentUserCanManageUsers && (
              <button
                type="button"
                className={`admin-function-button ${
                  activeFunction === "users" ? "admin-function-button--active" : ""
                }`}
                onClick={() => onSelectFunction("users")}
              >
                {t("admin.manageUsers")}
              </button>
            )}
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
