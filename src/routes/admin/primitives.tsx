import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Small visual primitives used by the admin dashboard. Extracted from
 * admin.tsx (D19). These are presentation-only — no state, no server
 * coupling — so importing them from anywhere on the admin surface is
 * cheap and side-effect free.
 */

export function ChartFallback() {
  return (
    <div className="grid h-[240px] place-items-center">
      <Loader2 className="size-5 animate-spin text-muted-foreground" />
    </div>
  );
}

export function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-soft">{children}</div>
    </div>
  );
}

export function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${accent ? "gradient-eco text-primary-foreground" : "bg-card"}`}
    >
      <p
        className={`text-xs uppercase tracking-wider ${accent ? "opacity-80" : "text-muted-foreground"}`}
      >
        {label}
      </p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}
