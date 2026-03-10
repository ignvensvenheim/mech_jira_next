import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import LoginPageContent from "./LoginPageContent";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user?.id) {
    redirect("/admin");
  }

  return (
    <Suspense fallback={<div className="page login-page" />}>
      <LoginPageContent />
    </Suspense>
  );
}
