import { MermaidBlock } from "@/about/components/MermaidBlock";
import type { DiagramSlideProps } from "@/about/components/present/types";

export function DiagramSlide({ eyebrow, source, title }: DiagramSlideProps) {
  return (
    <section className="flex min-h-[74vh] flex-col gap-6">
      <div>
        {eyebrow && (
          <p className="glass-chip inline-flex items-center rounded-full border px-4 py-1.5 text-base font-semibold uppercase tracking-[0.25em] text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 bg-gradient-to-br from-foreground via-primary to-primary-glow bg-clip-text text-4xl font-semibold text-transparent lg:text-6xl">
          {title}
        </h1>
      </div>
      <div className="flex min-h-0 flex-1 items-center rounded-3xl border bg-card/85 p-4 shadow-soft backdrop-blur lg:p-8">
        <div className="w-full [&_.mermaid-block]:h-full [&_.mermaid-block]:w-full [&_.mermaid-block_svg]:mx-auto [&_.mermaid-block_svg]:max-h-[68vh] [&_.mermaid-block_svg]:w-full">
          <MermaidBlock source={source} />
        </div>
      </div>
    </section>
  );
}
