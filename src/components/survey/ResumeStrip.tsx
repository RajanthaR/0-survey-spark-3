import { useState } from "react";
import { Copy } from "lucide-react";

export function ResumeStrip({
  url,
  label,
  copyLabel,
  copiedLabel,
}: {
  url: string;
  label: string;
  copyLabel: string;
  copiedLabel: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="border-t bg-secondary/40 px-4 py-2 text-[11px] text-secondary-foreground">
      <div className="mx-auto flex max-w-2xl items-center gap-2">
        <span className="shrink-0 opacity-70">🔖 {label}</span>
        {!revealed ? (
          <button
            type="button"
            className="ml-auto rounded bg-background/70 px-2 py-1 hover:bg-background"
            onClick={() => setRevealed(true)}
          >
            {copyLabel}
          </button>
        ) : (
          <>
            <code className="flex-1 truncate rounded bg-background/70 px-2 py-1" title={url}>
              {url}
            </code>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-background/70"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                } catch {
                  /* noop */
                }
              }}
            >
              <Copy className="size-3" /> {copied ? copiedLabel : copyLabel}
            </button>
          </>
        )}
      </div>
      {revealed && (
        <p className="mx-auto mt-1 max-w-2xl text-[10px] opacity-70">
          Keep this link private — anyone with it can edit your response.
        </p>
      )}
    </div>
  );
}
