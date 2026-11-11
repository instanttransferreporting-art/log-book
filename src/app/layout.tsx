import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getLocale } from "@/lib/i18n";
import { NavProgress } from "@/components/nav-progress";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
export const metadata: Metadata = { title: "Log Book", description: "Gestion documentaire multi-entreprises", icons: { icon: "/favicon-128.png", apple: "/apple-icon.png" } };

// Exécuté avant l'hydratation pour éviter le flash de thème
const themeScript = `try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="antialiased"><NavProgress />{children}</body>
    </html>
  );
}
