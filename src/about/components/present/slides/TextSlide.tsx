import type { TextSlideProps } from "@/about/components/present/types";

export function TextSlide({ eyebrow, supportingText, text }: TextSlideProps) {
  return (
    <section className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      {eyebrow && (
        <p className="mb-6 text-lg font-semibold uppercase tracking-[0.3em] text-primary">
          {eyebrow}
        </p>
      )}
      <p className="max-w-6xl text-balance text-4xl font-semibold leading-tight text-foreground sm:text-5xl lg:text-6xl">
        {text}
      </p>
      {supportingText && (
        <p className="mt-8 max-w-4xl text-balance text-xl leading-8 text-muted-foreground lg:text-3xl lg:leading-tight">
          {supportingText}
        </p>
      )}
    </section>
  );
}
