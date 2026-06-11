import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Globe2,
  GraduationCap,
  Leaf,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AboutHeaderLink } from "@/about/components/AboutHeaderLink";
import { LanguageToggle } from "@/components/LanguageToggle";
import { QuestionCount } from "@/components/QuestionCount";
import { pickText, useLang, UI } from "@/lib/i18n";
import { SURVEY_LIST } from "@/surveys";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "EIP Insight — Sri Lanka Eco-Industrial Park research" },
      {
        name: "description",
        content:
          "Take a short, anonymous trilingual survey from the University of Sri Jayewardenepura on sustainable industrial development in Sri Lanka.",
      },
      { property: "og:title", content: "EIP Insight — Sri Lanka Eco-Industrial Park research" },
      {
        property: "og:description",
        content: "Take a short, anonymous trilingual research survey on sustainable industry.",
      },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
});

/* Landscape palette — the near hill doubles as the survey-section background
   so the illustration flows seamlessly into the page below it. */
const HILL_FAR = "oklch(0.78 0.05 150)";
const HILL_MID = "oklch(0.52 0.09 158)";
const HILL_NEAR = "oklch(0.33 0.06 163)";
const CREAM = "oklch(0.97 0.015 95)";

const FIREFLIES: Array<{ left: string; top: string; delay: string; size: number }> = [
  { left: "6%", top: "18%", delay: "0s", size: 5 },
  { left: "16%", top: "62%", delay: "2.1s", size: 4 },
  { left: "30%", top: "30%", delay: "0.9s", size: 6 },
  { left: "46%", top: "74%", delay: "3.4s", size: 4 },
  { left: "62%", top: "22%", delay: "1.5s", size: 5 },
  { left: "76%", top: "58%", delay: "2.8s", size: 6 },
  { left: "90%", top: "34%", delay: "0.4s", size: 4 },
];

function Landscape() {
  return (
    <div aria-hidden className="pointer-events-none relative -mb-px select-none">
      <div className="mist-band absolute left-0 top-[26%] h-16 w-full" />
      <svg
        viewBox="0 0 1440 420"
        preserveAspectRatio="xMidYMax slice"
        className="block h-52 w-full sm:h-72 md:h-80"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Stylised coconut palm silhouette, reused at three scales */}
          <g id="palm" stroke={HILL_NEAR} fill="none" strokeLinecap="round">
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

        <use href="#palm" transform="translate(1146 300)" />
        <use href="#palm" transform="translate(1238 308) scale(0.72)" />
        <use href="#palm" transform="translate(196 296) scale(0.85)" />

        <path
          fill={HILL_NEAR}
          d="M0 362 C 240 324, 480 396, 760 362 C 1020 332, 1240 392, 1440 357 L 1440 420 L 0 420 Z"
        />
      </svg>
    </div>
  );
}

function Birds() {
  return (
    <div aria-hidden className="bird-drift absolute left-0 top-32 z-0 text-foreground/45">
      <svg width="72" height="24" viewBox="0 0 72 24" fill="none" stroke="currentColor">
        <path d="M2 14 q 7 -9 14 0 q 7 -9 14 0" strokeWidth="2" strokeLinecap="round" />
        <path d="M46 8 q 5 -7 11 0 q 5 -7 11 0" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function HeroBadge({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span className="glass-chip inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium text-foreground/85">
      <Icon className="size-4 text-primary" aria-hidden="true" />
      {label}
    </span>
  );
}

function Index() {
  const { lang } = useLang();

  const minutes = SURVEY_LIST.map((s) => s.estimatedMinutes);
  const minutesLabel = `~${Math.min(...minutes)}–${Math.max(...minutes)} min`;

  /* CSS-only entrance so the page is fully visible even before hydration. */
  const riseDelay = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div className="hero-sky relative min-h-screen overflow-x-clip">
      {/* ambient sky */}
      <div
        aria-hidden
        className="sun-glow pointer-events-none absolute -top-28 right-[4%] z-0 size-72 rounded-full sm:size-[28rem]"
      />
      <Birds />

      <header className="relative z-20 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <span className="glass-chip inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold tracking-wide text-primary">
          <Leaf className="size-4" aria-hidden="true" />
          {pickText(UI.appName, lang)}
        </span>
        <div className="glass-chip flex items-center gap-1 rounded-full border py-1 pl-2 pr-1">
          <AboutHeaderLink />
          <LanguageToggle compact />
        </div>
      </header>

      <main id="main" className="relative z-10">
        {/* hero */}
        <section className="relative mx-auto flex max-w-4xl flex-col items-center px-5 pb-10 pt-10 text-center sm:pt-16">
          <p
            style={riseDelay(0)}
            className="rise-in glass-chip inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-primary"
          >
            <GraduationCap className="size-4" aria-hidden="true" />
            {pickText(UI.university, lang)}
          </p>

          <h1
            style={riseDelay(90)}
            className="rise-in mt-6 text-balance bg-gradient-to-br from-foreground via-primary to-primary-glow bg-clip-text text-4xl font-semibold leading-[1.08] text-transparent sm:text-5xl md:text-6xl"
          >
            {pickText(UI.tagline, lang)}
          </h1>

          <p
            style={riseDelay(180)}
            className="rise-in mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            {pickText(UI.intro, lang)}
          </p>

          <div
            style={riseDelay(270)}
            className="rise-in mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            <HeroBadge icon={Clock3} label={minutesLabel} />
            <HeroBadge icon={ShieldCheck} label={pickText(UI.homeAnonymousBadge, lang)} />
            <HeroBadge icon={Globe2} label={pickText(UI.homeLanguagesBadge, lang)} />
          </div>

          <span
            style={riseDelay(380)}
            aria-hidden="true"
            className="rise-in mt-12 grid size-10 place-items-center rounded-full border bg-card/70 text-primary"
          >
            <ChevronDown className="scroll-cue size-5" />
          </span>
        </section>

        <Landscape />

        {/* survey field — continues the near hill */}
        <section className="relative" style={{ backgroundColor: HILL_NEAR }}>
          <div aria-hidden className="pointer-events-none absolute inset-0">
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

          <div className="relative mx-auto max-w-4xl px-5 pb-16 pt-12 sm:pt-16">
            <h2 className="text-center text-2xl font-semibold sm:text-3xl" style={{ color: CREAM }}>
              {pickText(UI.homeChooseSurvey, lang)}
            </h2>
            <p
              className="mx-auto mt-3 max-w-xl text-center text-sm leading-relaxed opacity-70 sm:text-base"
              style={{ color: CREAM }}
            >
              {pickText(UI.homeChooseSurveyLead, lang)}
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
              {SURVEY_LIST.map((s, i) => (
                <div key={s.slug} className="rise-in" style={riseDelay(450 + i * 130)}>
                  <Link
                    to="/s/$slug"
                    params={{ slug: s.slug }}
                    search={{ token: undefined }}
                    className="group relative block h-full overflow-hidden rounded-3xl bg-card p-6 shadow-[0_28px_70px_-30px_rgba(0,0,0,0.65)] transition-transform duration-300 hover:-translate-y-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-8"
                  >
                    <span
                      aria-hidden="true"
                      className="font-display pointer-events-none absolute -top-7 right-1 select-none text-[6.5rem] font-semibold leading-none text-primary/10"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      aria-hidden="true"
                      className="gradient-eco absolute inset-x-0 top-0 h-1.5 origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                    />

                    <h3 className="max-w-[85%] text-xl font-semibold leading-snug sm:text-2xl">
                      {pickText(s.title, lang)}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {pickText(s.subtitle, lang)}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-3 border-t pt-4 text-sm">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 className="size-4" aria-hidden="true" />
                        <span>
                          ~{s.estimatedMinutes} min · <QuestionCount count={s.questions.length} />
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                        {pickText(UI.start, lang)}
                        <ArrowRight
                          className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            <footer
              className="mt-14 flex flex-col items-center gap-2 text-center text-xs"
              style={{ color: CREAM }}
            >
              <p className="opacity-60">{pickText(UI.university, lang)}</p>
              <Link
                to="/admin"
                className="opacity-60 underline underline-offset-4 transition-opacity hover:opacity-100"
              >
                {pickText(UI.researcherLogin, lang)}
              </Link>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
