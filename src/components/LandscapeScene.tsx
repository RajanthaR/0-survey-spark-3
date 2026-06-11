import { useId } from "react";

import { cn } from "@/lib/utils";

/* Living Landscape palette — defined as CSS variables in styles.css with
   fallbacks at the point of use. The near hill doubles as a section
   background colour so the illustration flows seamlessly into the page. */
export const HILL_FAR = "var(--hill-far, oklch(0.78 0.05 150))";
export const HILL_MID = "var(--hill-mid, oklch(0.52 0.09 158))";
export const HILL_NEAR = "var(--hill-near, oklch(0.33 0.06 163))";
export const CREAM = "var(--cream, oklch(0.97 0.015 95))";

export const FIREFLIES: Array<{ left: string; top: string; delay: string; size: number }> = [
  { left: "6%", top: "18%", delay: "0s", size: 5 },
  { left: "16%", top: "62%", delay: "2.1s", size: 4 },
  { left: "30%", top: "30%", delay: "0.9s", size: 6 },
  { left: "46%", top: "74%", delay: "3.4s", size: 4 },
  { left: "62%", top: "22%", delay: "1.5s", size: 5 },
  { left: "76%", top: "58%", delay: "2.8s", size: 6 },
  { left: "90%", top: "34%", delay: "0.4s", size: 4 },
];

export function Fireflies() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {FIREFLIES.map((f, i) => (
        <span
          key={i}
          className="firefly absolute rounded-full"
          style={{
            left: f.left,
            top: f.top,
            width: f.size,
            height: f.size,
            animationDelay: f.delay,
          }}
        />
      ))}
    </div>
  );
}

export function Landscape({
  className,
  withMist = true,
}: {
  /** Height classes for the SVG band (defaults to the landing-page sizes). */
  className?: string;
  withMist?: boolean;
}) {
  /* Unique per instance so two landscapes on one page don't collide on
     the palm silhouette's SVG id. */
  const palmId = useId();

  return (
    <div aria-hidden="true" className="pointer-events-none relative -mb-px select-none">
      {withMist && <div className="mist-band absolute left-0 top-[26%] h-16 w-full" />}
      <svg
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
        className={cn("block h-52 w-full sm:h-72 md:h-80", className)}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Stylised coconut palm silhouette, reused at three scales */}
          <g id={palmId} stroke={HILL_NEAR} fill="none" strokeLinecap="round">
            <path d="M0 0 C -4 -22 -2 -44 8 -62" strokeWidth="6" />
            <g strokeWidth="4.5">
              <path d="M8 -62 q -30 -14 -56 -4" />
              <path d="M8 -62 q -22 -24 -48 -26" />
              <path d="M8 -62 q 4 -28 -12 -44" />
              <path d="M8 -62 q 24 -20 48 -16" />
              <path d="M8 -62 q 30 -6 48 12" />
              <path d="M8 -62 q 20 10 26 30" />
            </g>
            <circle cx="4" cy="-58" r="5" fill={HILL_NEAR} stroke="none" />
            <circle cx="13" cy="-55" r="5" fill={HILL_NEAR} stroke="none" />
          </g>
        </defs>

        <path
          fill={HILL_FAR}
          opacity="0.65"
          d="M0 240 C 180 195, 360 228, 540 202 C 760 172, 900 232, 1080 207 C 1240 185, 1340 212, 1440 198 L 1440 420 L 0 420 Z"
        />
        <path
          fill={HILL_MID}
          d="M0 302 C 200 262, 420 322, 640 292 C 860 262, 1040 332, 1240 302 C 1320 290, 1390 302, 1440 297 L 1440 420 L 0 420 Z"
        />

        <use href={`#${palmId}`} transform="translate(1146 300)" />
        <use href={`#${palmId}`} transform="translate(1238 308) scale(0.72)" />
        <use href={`#${palmId}`} transform="translate(196 296) scale(0.85)" />

        <path
          fill={HILL_NEAR}
          d="M0 362 C 240 324, 480 396, 760 362 C 1020 332, 1240 392, 1440 357 L 1440 420 L 0 420 Z"
        />
      </svg>
    </div>
  );
}

export function Birds({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("bird-drift absolute left-0 top-32 z-0 text-foreground/45", className)}
    >
      <svg width="72" height="24" viewBox="0 0 72 24" fill="none" stroke="currentColor">
        <path d="M2 14 q 7 -9 14 0 q 7 -9 14 0" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 8 q 5 -7 11 0 q 5 -7 11 0" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export function SunGlow({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "sun-glow pointer-events-none absolute -top-28 right-[4%] z-0 size-72 rounded-full sm:size-[28rem]",
        className,
      )}
    />
  );
}
