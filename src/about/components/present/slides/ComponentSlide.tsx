import type { ComponentSlideProps } from "@/about/components/present/types";

export function ComponentSlide({ children, eyebrow, footnote, title }: ComponentSlideProps) {
  return (
    <section className="flex min-h-[74vh] flex-col gap-6">
      <div>
        {eyebrow && (
          <p className="text-base font-semibold uppercase tracking-[0.25em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-2 text-4xl font-semibold text-foreground lg:text-6xl">{title}</h1>
      </div>
      <div className="min-h-0 flex-1 rounded-3xl border bg-card/90 p-4 shadow-soft lg:p-8">
        {children}
      </div>
      {footnote && <p className="text-lg text-muted-foreground">{footnote}</p>}
    </section>
  );
}
