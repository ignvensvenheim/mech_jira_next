const SUPER_ADMIN_USERNAME = "ignven";

function normalize(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

export function isSuperAdminIdentity(user: {
  name?: string | null;
  email?: string | null;
}) {
  const name = normalize(user.name);
  const email = normalize(user.email);
  const emailLocalPart = email.includes("@") ? email.split("@")[0] : email;

  return (
    name === SUPER_ADMIN_USERNAME || emailLocalPart === SUPER_ADMIN_USERNAME
  );
}

