import { Suspense } from "react";
import "../page.css";
import AdminLayoutShell from "./components/AdminLayoutShell";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<Record<string, string | string[] | undefined>>;
}>) {
  return (
    <Suspense fallback={null}>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </Suspense>
  );
}
