import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CopyRequestIdButtonProps {
  requestId: string;
  testId?: string;
}

/**
 * Small inline button that copies a requestId to the clipboard so admins
 * can quickly paste it into a logging system or share with support.
 *
 * Shows a brief check-mark confirmation and a sonner toast. Falls back to
 * a manual prompt path if the Clipboard API is unavailable (older browsers
 * or insecure contexts).
 */
export function CopyRequestIdButton({ requestId, testId }: CopyRequestIdButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(requestId);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopied(true);
      toast.success("requestId copied", { description: requestId });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy requestId", {
        description: "Copy it manually from the banner.",
      });
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleCopy}
      data-testid={testId}
      title={`Copy requestId ${requestId} to clipboard`}
      aria-label={`Copy requestId ${requestId} to clipboard`}
      className="h-7 gap-1 px-2 text-xs"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" aria-hidden />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" aria-hidden />
          Copy requestId
        </>
      )}
    </Button>
  );
}
