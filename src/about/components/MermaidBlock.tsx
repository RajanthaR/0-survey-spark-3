import { useEffect, useId, useMemo, useState } from "react";

type RenderState =
  | { status: "pending" }
  | { status: "ready"; svg: string }
  | { status: "error"; message: string };

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, source: string) => Promise<{ svg: string }> | { svg: string };
};

export function MermaidBlock({ source }: { source: string }) {
  const reactId = useId();
  const renderId = useMemo(() => `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`, [reactId]);
  const [state, setState] = useState<RenderState>({ status: "pending" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "pending" });

    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default as MermaidApi;
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "default" });
        const result = await mermaid.render(renderId, source);
        if (!cancelled) setState({ status: "ready", svg: result.svg });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error ? error.message : "Mermaid could not render this diagram.",
          });
        }
      }
    }

    void renderMermaid();
    return () => {
      cancelled = true;
    };
  }, [renderId, source]);

  if (state.status === "ready") {
    return (
      <div
        className="overflow-x-auto rounded-lg border bg-card p-4"
        dangerouslySetInnerHTML={{ __html: state.svg }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-4">
      {state.status === "error" && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Mermaid render failed: {state.message}
        </p>
      )}
      <pre className="overflow-x-auto text-xs" data-testid="mermaid-source">
        {source}
      </pre>
    </div>
  );
}
