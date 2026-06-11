import type { TitleSlideProps } from "@/about/components/present/types";

export function TitleSlide({ eyebrow, meta, subtitle, title }: TitleSlideProps) {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      {eyebrow && (
        <p className="glass-chip mb-8 inline-flex items-center rounded-full border px-5 py-2 text-lg font-semibold uppercase tracking-[0.3em] text-primary">
          {eyebrow}
        </p>
      )}
      <h1 className="max-w-5xl text-balance bg-gradient-to-br from-foreground via-primary to-primary-glow bg-clip-text text-5xl font-semibold leading-[1.02] text-transparent sm:text-6xl lg:text-7xl xl:text-8xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-8 max-w-4xl text-balance text-2xl leading-9 text-muted-foreground lg:text-4xl lg:leading-tight">
          {subtitle}
        </p>
      )}
      {meta && (
        <p className="mt-10 text-lg font-medium text-muted-foreground lg:text-2xl">{meta}</p>
      )}
    </section>
  );
}
