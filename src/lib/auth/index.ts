import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { isLocked, recordFailure, resetFailures } from "./rate-limit";

export const clientIp = (h: Headers) => h.get("x-forwarded-for")?.split(",")[0].trim() || "local";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      async authorize(raw, request) {
        const p = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(raw);
        if (!p.success) return null;
        const email = p.data.email.toLowerCase();
        const ip = clientIp(request.headers);
        if (isLocked(email, ip)) return null;
        const user = await db.user.findUnique({ where: { email } });
        // bcrypt est exécuté même si l'utilisateur n'existe pas (pas de fuite par temps de réponse)
        const ok = await bcrypt.compare(p.data.password, user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi");
        if (!user || !user.isActive || !ok) { recordFailure(email, ip); return null; }
        resetFailures(email, ip);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) { if (user) token.uid = user.id; return token; },
    session({ session, token }) { if (token.uid) session.user.id = token.uid as string; return session; },
  },
});
