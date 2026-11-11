import Image from "next/image";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, auth, clientIp } from "@/lib/auth";
import { isLocked } from "@/lib/auth/rate-limit";
import { getLocale, getT } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitch } from "@/components/locale-switch";
import { SubmitButton } from "@/components/submit-button";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const { error } = await searchParams;
  const [t, locale] = await Promise.all([getT(), getLocale()]);

  async function login(form: FormData) {
    "use server";
    const email = String(form.get("email") ?? "");
    if (isLocked(email, clientIp(await headers()))) redirect("/login?error=locked");
    try {
      await signIn("credentials", { email, password: form.get("password"), redirectTo: "/" });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e;
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-4 bg-gradient-to-br from-amber-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute top-4 right-4 flex items-center gap-2"><LocaleSwitch locale={locale} /><ThemeToggle /></div>
      <form action={login} className="glass w-full max-w-sm rounded-2xl p-8 shadow-xl space-y-4">
        <div className="text-center">
          <span className="mx-auto mb-2 grid size-28 place-items-center rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/5">
            <Image src="/logo.png" alt="Log Book — Groupe de Microfinance" width={112} height={112} priority className="size-26 object-contain" />
          </span>
          <h1 className="sr-only">Log Book</h1>
          <p className="text-sm text-muted">{t("login.title")}</p>
        </div>
        {error && <p className="text-sm text-danger">{error === "locked" ? t("login.locked") : t("login.error")}</p>}
        <div className="space-y-1"><label htmlFor="email" className="text-sm font-medium">{t("login.email")}</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="input" /></div>
        <div className="space-y-1"><label htmlFor="password" className="text-sm font-medium">{t("login.password")}</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" /></div>
        <SubmitButton className="btn w-full">{t("login.submit")}</SubmitButton>
      </form>
    </main>
  );
}
