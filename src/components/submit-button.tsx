"use client";
import { useFormStatus } from "react-dom";

/** Désactivé pendant l'envoi : protège contre les doubles soumissions. */
export function SubmitButton({ children, className = "btn", name, value, skipValidation }: { children: React.ReactNode; className?: string; name?: string; value?: string; skipValidation?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button name={name} value={value} formNoValidate={skipValidation} disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? "…" : children}
    </button>
  );
}
