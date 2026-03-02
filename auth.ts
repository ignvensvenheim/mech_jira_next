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
        const email = String(credentials?.email || "").trim().toLowerCase();
        const password = String(credentials?.password || "");

        if (!email || !password) return null;

        let user = await prisma.user.findUnique({ where: { email } });

        // Bootstrap first admin user from env on first login attempt.
        if (!user) {
          const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
          const adminPassword = process.env.ADMIN_PASSWORD || "";

          if (email === adminEmail && password === adminPassword) {
            const passwordHash = await bcrypt.hash(password, 10);
            user = await prisma.user.create({
              data: {
                email,
                name: "Admin",
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
      },
    }),
  ],
});
