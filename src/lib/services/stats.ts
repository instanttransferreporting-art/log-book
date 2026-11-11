import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/access";

export type Period = "today" | "week" | "month" | "year" | "custom";
export const PERIODS: Period[] = ["today", "week", "month", "year", "custom"];

/** Résout une période en bornes [from, to[ (dates locales du serveur). */
export function resolvePeriod(period: Period, fromStr?: string, toStr?: string, now = new Date()) {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const add = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  switch (period) {
    case "today": return { from: day, to: add(day, 1) };
    case "week": { const s = add(day, -((day.getDay() + 6) % 7)); return { from: s, to: add(s, 7) }; }
    case "year": return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear() + 1, 0, 1) };
    case "custom": {
      const f = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(`${fromStr}T00:00:00`) : null;
      const t = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(`${toStr}T00:00:00`) : null;
      if (f && t && f <= t) return { from: f, to: add(t, 1) };
      return resolvePeriod("month", undefined, undefined, now);
    }
    default: return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 1) };
  }
}

/** Statistiques du tableau de bord, toujours restreintes aux entreprises de l'utilisateur. */
export async function dashboardStats(user: CurrentUser, from: Date, to: Date) {
  const scope: Prisma.DocumentWhereInput = user.isSuperAdmin ? {} : { companyId: { in: user.companyIds } };
  const where: Prisma.DocumentWhereInput = { ...scope, deletedAt: null, createdAt: { gte: from, lt: to } };

  const spanDays = (to.getTime() - from.getTime()) / 86_400_000;
  const unit = spanDays > 62 ? "month" : "day";
  const companyFilter = user.isSuperAdmin ? Prisma.empty : Prisma.sql`AND "companyId" IN (${Prisma.join(user.companyIds.length ? user.companyIds : ["-"])})`;

  const [total, byCompanyRaw, byCategoryRaw, series] = await Promise.all([
    db.document.count({ where }),
    db.document.groupBy({ by: ["companyId"], where, _count: { _all: true } }),
    db.document.groupBy({ by: ["categoryId"], where, _count: { _all: true }, orderBy: { _count: { categoryId: "desc" } }, take: 10 }),
    db.$queryRaw<{ bucket: Date; n: bigint }[]>`
      SELECT date_trunc(${unit}, "createdAt") AS bucket, COUNT(*) AS n FROM "Document"
      WHERE "deletedAt" IS NULL AND "createdAt" >= ${from} AND "createdAt" < ${to} ${companyFilter}
      GROUP BY 1 ORDER BY 1`,
  ]);

  const [companies, categories] = await Promise.all([
    db.company.findMany({ where: { id: { in: byCompanyRaw.map((r) => r.companyId) } }, select: { id: true, name: true, color: true } }),
    db.documentCategory.findMany({ where: { id: { in: byCategoryRaw.map((r) => r.categoryId) } }, select: { id: true, name: true, company: { select: { code: true } } } }),
  ]);

  const byCompany = byCompanyRaw
    .map((r) => { const c = companies.find((x) => x.id === r.companyId); return { name: c?.name ?? "?", value: r._count._all, color: c?.color }; })
    .sort((a, b) => b.value - a.value);
  const byCategory = byCategoryRaw.map((r) => { const c = categories.find((x) => x.id === r.categoryId); return { name: c ? `${c.company.code} · ${c.name}` : "?", value: r._count._all }; });
  const evolution = series.map((s) => ({
    label: unit === "month" ? s.bucket.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }) : s.bucket.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
    value: Number(s.n),
  }));
  return { total, byCompany, byCategory, evolution };
}
