import { useState } from "react";
import { pickText, useLang } from "@/lib/i18n";
import { OPTION_ICONS } from "@/surveys/visuals/icons";
import type { OptionVisual as OptionVisualSpec } from "@/surveys/types";

/**
 * Renders an option's visual into a fixed 40×40 square so all options in a
 * question line up, regardless of icon vs image. Returns `null` when there
 * is no visual — callers don't need to branch.
 */
export function OptionVisual({
  visual,
  active = false,
  size = "md",
}: {
  visual?: OptionVisualSpec;
  /** When true, tint is overridden by the parent's "selected" treatment. */
  active?: boolean;
  size?: "sm" | "md";
}) {
  const { lang } = useLang();
  if (!visual) return null;

  const box =
    size === "sm"
      ? "size-8 rounded-lg"
      : "size-10 rounded-xl";

  if (visual.kind === "image") {
    const altText = visual.alt ? pickText(visual.alt, lang) : "";
    return <ImageVisual src={visual.src} alt={altText} box={box} size={size} />;
  }

  const Icon = OPTION_ICONS[visual.name];
  const tone = visual.tone ?? "default";
  // When the parent shows a "selected" state, mute the per-icon tone so the
  // selected card stays visually coherent.
  const toneClass = active
    ? "text-primary"
    : tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : "text-muted-foreground";
  const bgClass = active ? "bg-primary/15" : "bg-muted/50";

  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center ${box} ${bgClass}`}
    >
      <Icon className={`size-5 ${toneClass}`} strokeWidth={2} />
    </span>
  );
}

/**
 * Renders an option illustration with a pulsing skeleton placeholder
 * until the image decodes. If the asset is already in the browser cache
 * the `<img>` reports `complete` synchronously on mount, so the skeleton
 * never flashes — important on repeat visits where the SW serves the
 * file instantly.
 */
function ImageVisual({
  src,
  alt,
  box,
  size,
}: {
  src: string;
  alt: string;
  box: string;
  size: "sm" | "md";
}) {
  // On SSR and first client mount we render as "loading". If the image
  // is already in the browser cache the ref callback flips this to
  // `loaded` synchronously, so the skeleton never flashes on repeat
  // visits — important once the option-image SW is active.
  const [loaded, setLoaded] = useState(false);
  const dim = size === "sm" ? 32 : 40;
  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden bg-muted/40 ${box}`}
      data-loaded={loaded || undefined}
    >
      {!loaded && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse bg-muted/60"
        />
      )}
      <img
        ref={(el) => {
          if (el && el.complete && el.naturalWidth > 0 && !loaded) {
            setLoaded(true);
          }
        }}
        src={src}
        alt={alt}
        aria-hidden={alt ? undefined : true}
        loading="lazy"
        decoding="async"
        width={dim}
        height={dim}
        {...({ fetchpriority: "low" } as { fetchpriority: "low" })}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={`relative size-full object-contain transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </span>
  );
}