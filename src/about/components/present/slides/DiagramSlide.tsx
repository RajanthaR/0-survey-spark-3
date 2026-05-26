import { MermaidBlock } from "@/about/components/MermaidBlock";
import type { DiagramSlideProps } from "@/about/components/present/types";

export function DiagramSlide({ eyebrow, source, title }: DiagramSlideProps) {
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
      <div className="flex min-h-0 flex-1 items-center rounded-3xl border bg-card/90 p-4 shadow-soft lg:p-8">
        <div className="w-full [&_.mermaid-block]:h-full [&_.mermaid-block]:w-full [&_.mermaid-block_svg]:mx-auto [&_.mermaid-block_svg]:max-h-[68vh] [&_.mermaid-block_svg]:w-full">
          <MermaidBlock source={source} />
        </div>
      </div>
    </section>
  );
}
