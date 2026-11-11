import { Spinner } from "@/components/spinner";

/** Affiché instantanément pendant le chargement d'une page de l'application. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="grid min-h-[50vh] place-items-center">
      <div className="flex flex-col items-center gap-3 text-muted">
        <Spinner size={32} className="text-primary" />
        <span className="text-sm">Chargement…</span>
      </div>
    </div>
  );
}
