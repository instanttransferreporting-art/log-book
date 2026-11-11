"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { LOCALES, type Locale } from "./dictionaries";

export async function setLocale(locale: string) {
  if (!LOCALES.includes(locale as Locale)) return;
  (await cookies()).set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
