import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          const identifier = String(credentials?.email || "").trim();
          const password = String(credentials?.password || "");

          if (!identifier || !password) return null;

          const identifierLower = identifier.toLowerCase();
          let user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: identifierLower },
                { name: identifier },
                { name: identifierLower },
              ],
            },
          });

          // Bootstrap first admin user from env on first login attempt.
          if (!user) {
            const adminEmail = (process.env.ADMIN_EMAIL || "")
              .trim()
              .toLowerCase();
            const adminName = (process.env.ADMIN_NAME || "").trim();
            const adminPassword = process.env.ADMIN_PASSWORD || "";

            const matchesBootstrapIdentity =
              (adminEmail && identifierLower === adminEmail) ||
              (adminName &&
                (identifier === adminName ||
                  identifierLower === adminName.toLowerCase()));

            if (matchesBootstrapIdentity && password === adminPassword) {
              // If ADMIN_EMAIL is not a valid email-like value, keep it deterministic.
              const bootstrapEmail =
                adminEmail && adminEmail.includes("@")
                  ? adminEmail
                  : `${adminName || "admin"}@local.invalid`;
              const passwordHash = await bcrypt.hash(password, 10);
              user = await prisma.user.create({
                data: {
                  email: bootstrapEmail,
                  name: adminName || "Admin",
                  passwordHash,
                  role: "ADMIN",
                },
              });
            }
          }

          if (!user) return null;

          const matches = await bcrypt.compare(password, user.passwordHash);
          if (!matches) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("Auth authorize failed:", error);
          return null;
        }
      },
    }),
  ],
});
