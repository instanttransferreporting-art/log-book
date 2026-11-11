import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser, companyScope } from "@/lib/auth/session";
import { getT } from "@/lib/i18n";
import { dashboardStats, PERIODS, resolvePeriod, type Period } from "@/lib/services/stats";
import { BarList, TimeSeries } from "@/components/charts";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ period?: string; from?: string; to?: string }> }) {
  const user = await requireUser();
  const t = await getT();
  const sp = await searchParams;
  const period: Period = PERIODS.includes(sp.period as Period) ? (sp.period as Period) : "month";
  const { from, to } = resolvePeriod(period, sp.from, sp.to);

  const scope = user.isSuperAdmin ? {} : { companyId: { in: user.companyIds } };
  const base = { ...scope, deletedAt: null };
  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startDay);
  startWeek.setDate(startDay.getDate() - ((startDay.getDay() + 6) % 7));

  const [stats, today, week, companies, categories, recent] = await Promise.all([
    dashboardStats(user, from, to),
    db.document.count({ where: { ...base, createdAt: { gte: startDay } } }),
    db.document.count({ where: { ...base, createdAt: { gte: startWeek } } }),
    db.company.count({ where: { isActive: true, ...companyScope(user) } }),
    db.documentCategory.count({ where: { isActive: true, company: companyScope(user) } }),
    db.document.findMany({ where: base, orderBy: { createdAt: "desc" }, take: 8, include: { company: true, category: true, createdBy: true } }),
  ]);

  const cards: [string, number][] = [
    [`${t("dash.documents")} (${t(`dash.period.${period}`)})`, stats.total],
    [t("dash.period.today"), today], [t("dash.period.week"), week],
    [t("dash.companies"), companies], [t("dash.categories"), categories],
  ];
  const tab = (p: Period) => (p === "custom" ? `/?period=custom&from=${sp.from ?? ""}&to=${sp.to ?? ""}` : `/?period=${p}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("dash.title")}</h1>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          {PERIODS.filter((p) => p !== "custom").map((p) => (
            <Link key={p} href={tab(p)} className={`rounded-lg border px-3 py-1.5 ${p === period ? "bg-primary/15 text-primary border-primary" : "text-muted hover:text-fg"}`}>{t(`dash.period.${p}`)}</Link>
          ))}
          <form className="flex items-end gap-2">
            <input type="hidden" name="period" value="custom" />
            <label className="text-xs text-muted">{t("dash.from")}<input type="date" name="from" defaultValue={sp.from} className="input !py-1" required /></label>
            <label className="text-xs text-muted">{t("dash.to")}<input type="date" name="to" defaultValue={sp.to} className="input !py-1" required /></label>
            <button className={`rounded-lg border px-3 py-1.5 ${period === "custom" ? "bg-primary/15 text-primary border-primary" : "text-muted hover:text-fg"}`}>{t("dash.apply")}</button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map(([l, v]) => (
          <div key={l} className="card p-4"><div className="text-sm text-muted">{l}</div><div className="text-3xl font-semibold mt-1">{v}</div></div>
        ))}
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">{t("dash.evolution")}</h2>
        {stats.evolution.length === 0 ? <p className="text-sm text-muted">{t("dash.noData")}</p> : <TimeSeries data={stats.evolution} />}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-medium mb-3">{t("dash.byCompany")}</h2>
          {stats.byCompany.length === 0 ? <p className="text-sm text-muted">{t("dash.noData")}</p> : <BarList data={stats.byCompany} />}
        </div>
        <div className="card p-4">
          <h2 className="font-medium mb-3">{t("dash.byCategory")}</h2>
          {stats.byCategory.length === 0 ? <p className="text-sm text-muted">{t("dash.noData")}</p> : <BarList data={stats.byCategory} />}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-medium mb-3">{t("dash.recent")}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">{t("dash.empty")}</p>
        ) : (
          <ul className="divide-y">
            {recent.map((d) => (
              <li key={d.id} className="py-2 text-sm flex justify-between">
                <span>{d.company.name} › {d.category.name} — {d.subject ?? d.reference}</span>
                <span className="text-muted">{d.createdBy.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
