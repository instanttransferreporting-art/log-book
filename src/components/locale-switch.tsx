"use client";
import { useTransition } from "react";
import { setLocale } from "@/lib/i18n/actions";

export function LocaleSwitch({ locale }: { locale: string }) {
  const [pending, start] = useTransition();
  return (
    <select aria-label="Langue" value={locale} disabled={pending} onChange={(e) => start(() => setLocale(e.target.value))}
      className="bg-transparent text-xs text-muted rounded-md border px-1.5 py-1">
      <option value="fr">FR</option>
      <option value="en">EN</option>
    </select>
  );
}
