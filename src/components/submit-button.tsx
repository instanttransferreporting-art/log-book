"use client";
import { useFormStatus } from "react-dom";
import { Spinner } from "./spinner";

/** Désactivé pendant l'envoi : protège contre les doubles soumissions. */
export function SubmitButton({ children, className = "btn", name, value, skipValidation }: { children: React.ReactNode; className?: string; name?: string; value?: string; skipValidation?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button name={name} value={value} formNoValidate={skipValidation} disabled={pending} className={`${className} inline-flex items-center justify-center gap-2 disabled:opacity-60`}>
      {pending && <Spinner size={14} />}{children}
    </button>
  );
}
