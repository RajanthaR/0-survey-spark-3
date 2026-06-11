import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

import { Clock3, Globe2, ShieldCheck } from "lucide-react";

import { ABOUT_STUDY } from "@/about/copy/study";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { pickText, UI, useLang, type Lang } from "@/lib/i18n";
import { CONSENT_ITEMS } from "@/surveys/consent";
import { SURVEY_LIST } from "@/surveys";

type StudyLinkTarget = "/" | "/about/study" | "/about/research" | "/about/engineering";

type StudyLinkProps = {
  to: StudyLinkTarget;
  className: string;
  children: ReactNode;
  hash?: string;
};

type StudyLaneContentProps = {
  lang: Lang;
  renderLink?: (props: StudyLinkProps) => ReactNode;
};

const sectionOrder = [
  {
    heading: ABOUT_STUDY.whatItIsHeading,
    body: ABOUT_STUDY.whatItIsBody,
  },
  {
    heading: ABOUT_STUDY.eligibilityHeading,
    body: ABOUT_STUDY.eligibilityBody,
  },
  {
    heading: ABOUT_STUDY.tasksHeading,
    body: ABOUT_STUDY.tasksBody,
  },
] as const;

export const Route = createFileRoute("/about/study")({
  component: StudyLane,
  head: ({ match }) => {
    const lang = match.context.initialLang ?? "en";
    const title = `${pickText(ABOUT_STUDY.pageTitle, lang)} - EIP Insight`;
    const description = pickText(ABOUT_STUDY.pageDescription, lang);

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: "/about/study" },
      ],
      links: [{ rel: "canonical", href: "/about/study" }],
    };
  },
});

function StudyLane() {
  const { lang } = useLang();
  return <StudyLaneContent lang={lang} />;
}

export function StudyLaneContent({ lang, renderLink = defaultRenderLink }: StudyLaneContentProps) {
  const contactEmail = pickText(ABOUT_STUDY.contactEmail, lang);

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-6">
      <section className="rounded-3xl gradient-eco p-8 text-primary-foreground shadow-soft">
        <p className="text-sm font-medium opacity-90">EIP Insight</p>
        <h1 className="mt-2 text-3xl font-semibold">{pickText(ABOUT_STUDY.pageTitle, lang)}</h1>
        <p className="mt-3 text-sm leading-6 opacity-90">
          {pickText(ABOUT_STUDY.pageSubtitle, lang)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <StudyBadge icon={<Clock3 className="size-4" aria-hidden="true" />}>
            {studyMinutesLabel(lang)}
          </StudyBadge>
          <StudyBadge icon={<ShieldCheck className="size-4" aria-hidden="true" />}>
            {pickText(UI.homeAnonymousBadge, lang)}
          </StudyBadge>
          <StudyBadge icon={<Globe2 className="size-4" aria-hidden="true" />}>
            {pickText(UI.homeLanguagesBadge, lang)}
          </StudyBadge>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        {sectionOrder.map((section) => (
          <StudySection
            key={section.heading.en}
            heading={pickText(section.heading, lang)}
            body={pickText(section.body, lang)}
          />
        ))}

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">
            {pickText(ABOUT_STUDY.privacyHeading, lang)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {pickText(ABOUT_STUDY.privacyBody, lang)}
          </p>
          {renderLink({
            to: "/about/study",
            hash: "study-consent",
            className:
              "mt-3 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline",
            children: pickText(ABOUT_STUDY.privacyConsentLink, lang),
          })}
        </section>

        <section className="rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">
            {pickText(ABOUT_STUDY.contactHeading, lang)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {pickText(ABOUT_STUDY.contactBody, lang)}
          </p>
          <address className="mt-3 not-italic">
            <p className="text-sm font-medium text-foreground">
              {pickText(ABOUT_STUDY.contactName, lang)}
            </p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              {contactEmail}
            </a>
          </address>
        </section>

        <section id="study-consent" className="scroll-mt-6 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">
            {pickText(ABOUT_STUDY.consentHeading, lang)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {pickText(ABOUT_STUDY.consentIntro, lang)}
          </p>
          <Accordion type="multiple" className="mt-4 rounded-xl border px-4">
            {CONSENT_ITEMS.map((item) => {
              const stateLabel = item.required
                ? pickText(ABOUT_STUDY.requiredLabel, lang)
                : pickText(ABOUT_STUDY.optionalLabel, lang);
              return (
                <AccordionItem key={item.id} value={item.id} className="last:border-b-0">
                  <AccordionTrigger className="gap-3 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {pickText(item.shortLabel ?? item.label, lang)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{stateLabel}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-6 text-muted-foreground">
                    {pickText(item.label, lang)}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </section>
      </div>

      <footer className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap sm:items-center">
        {renderLink({
          to: "/",
          className:
            "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90",
          children: pickText(ABOUT_STUDY.footerTakeSurvey, lang),
        })}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {renderFooterLink({
            to: "/about/research",
            label: pickText(ABOUT_STUDY.footerForResearchers, lang),
            note: pickText(ABOUT_STUDY.footerEnglishOnlyNote, lang),
            renderLink,
          })}
          {renderFooterLink({
            to: "/about/engineering",
            label: pickText(ABOUT_STUDY.footerForEngineers, lang),
            note: pickText(ABOUT_STUDY.footerEnglishOnlyNote, lang),
            renderLink,
          })}
        </div>
      </footer>
    </article>
  );
}

function studyMinutesLabel(lang: Lang): string {
  const minutes = SURVEY_LIST.map((s) => s.estimatedMinutes);
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  const suffix = pickText(UI.minutesSuffix, lang);
  return min === max ? `~${min} ${suffix}` : `~${min}–${max} ${suffix}`;
}

function StudyBadge({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium">
      {icon}
      {children}
    </span>
  );
}

function StudySection({ heading, body }: { heading: string; body: string }) {
  return (
    <section className="rounded-2xl border bg-card p-5">
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </section>
  );
}

function defaultRenderLink({ to, className, children, hash }: StudyLinkProps) {
  return (
    <Link to={to} hash={hash} className={className}>
      {children}
    </Link>
  );
}

function renderFooterLink({
  to,
  label,
  note,
  renderLink,
}: {
  to: Exclude<StudyLinkTarget, "/">;
  label: string;
  note: string;
  renderLink: (props: StudyLinkProps) => ReactNode;
}) {
  return renderLink({
    to,
    className:
      "inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:underline",
    children: (
      <>
        <span>{label}</span>
        <span className="text-xs">({note})</span>
      </>
    ),
  });
}
