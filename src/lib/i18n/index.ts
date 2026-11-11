import { cookies } from "next/headers";
import { dictionaries, LOCALES, type Locale } from "./dictionaries";

export { LOCALES, type Locale } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const v = (await cookies()).get("locale")?.value;
  return LOCALES.includes(v as Locale) ? (v as Locale) : "fr";
}

/** Retourne la fonction de traduction ; repli sur le français puis sur la clé. */
export async function getT() {
  const locale = await getLocale();
  return (key: string, vars?: Record<string, string | number>) => {
    let s = dictionaries[locale][key] ?? dictionaries.fr[key] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) s = s.replace(`{${k}}`, String(v));
    return s;
  };
}
