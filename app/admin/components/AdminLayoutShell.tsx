"use client";

import { useSearchParams } from "next/navigation";
import { useI18n } from "@/components/I18nProvider";
import AdminSidebar from "./AdminSidebar";
import { useAdminMaintenance } from "../hooks/useAdminMaintenance";
import { useAdminSession } from "../hooks/useAdminSession";

export default function AdminLayoutShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const searchParams = useSearchParams();
  const { locale, t } = useI18n();
  const {
    currentUserLabel,
    currentUserCanManageUsers,
    currentUserIsAdmin,
    sessionResolved,
    activeFunction,
    handleLogout,
  } = useAdminSession(searchParams);
  const { maintenanceBadgeCount } = useAdminMaintenance({
    sessionResolved,
    currentUserIsAdmin,
    locale,
    t,
    machineLabelByKey: {},
    upsertAssetDetailsCache: () => {},
  });

  return (
    <div className="page page--home">
      <div className="page__layout">
        <AdminSidebar
          activeFunction={activeFunction}
          currentUserLabel={currentUserLabel}
          currentUserCanManageUsers={currentUserCanManageUsers}
          maintenanceBadgeCount={maintenanceBadgeCount}
          getFunctionHref={(value) => `/admin?view=${value}`}
          onLogout={handleLogout}
          t={t}
        />
        <section className="page__content">{children}</section>
      </div>
    </div>
  );
}
