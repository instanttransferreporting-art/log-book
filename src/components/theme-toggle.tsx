"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Pref = "light" | "dark" | "system";
const ORDER: Pref[] = ["light", "dark", "system"];
const LABEL: Record<Pref, string> = { light: "Thème clair", dark: "Thème sombre", system: "Thème du système" };

function apply(pref: Pref) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

/** Bascule clair → sombre → système ; la préférence est mémorisée dans le navigateur. */
export function ThemeToggle() {
  const [pref, setPref] = useState<Pref>("system");

  useEffect(() => {
    let saved: Pref = "system";
    try { const v = localStorage.getItem("theme"); if (v === "light" || v === "dark") saved = v; } catch {}
    setPref(saved);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => { if (!localStorage.getItem("theme")) apply("system"); };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next = () => {
    const n = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setPref(n);
    try { if (n === "system") localStorage.removeItem("theme"); else localStorage.setItem("theme", n); } catch {}
    apply(n);
  };

  const Icon = pref === "light" ? Sun : pref === "dark" ? Moon : Monitor;
  return (
    <button type="button" onClick={next} title={LABEL[pref]} aria-label={LABEL[pref]} className="rounded-lg p-2 text-muted hover:text-fg hover:bg-black/5">
      <Icon size={16} />
    </button>
  );
}
