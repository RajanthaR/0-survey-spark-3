import { Link } from "@tanstack/react-router";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pickText, UI, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function AboutHeaderLink({ className }: { className?: string }) {
  const { lang } = useLang();

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className={cn(
        "px-2 whitespace-normal text-left leading-tight sm:whitespace-nowrap",
        className,
      )}
    >
      <Link to="/about">
        <Info data-icon="inline-start" aria-hidden="true" />
        <span>{pickText(UI.aboutLink, lang)}</span>
      </Link>
    </Button>
  );
}
