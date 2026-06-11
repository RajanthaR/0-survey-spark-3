import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "@tanstack/react-router";

import { Birds, Landscape, SunGlow } from "@/components/LandscapeScene";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { clampSlideIndex, moveSlideIndex, parseSlideHash, slideHash } from "./navigation";
import { ComponentSlide } from "./slides/ComponentSlide";
import { DiagramSlide } from "./slides/DiagramSlide";
import { TextSlide } from "./slides/TextSlide";
import { TitleSlide } from "./slides/TitleSlide";
import type { SlideDefinition } from "./types";

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    tag === "button" ||
    tag === "a" ||
    target.isContentEditable
  );
}

function renderSlide(slide: SlideDefinition) {
  if (slide.kind === "title") return <TitleSlide {...slide.props} />;
  if (slide.kind === "text") return <TextSlide {...slide.props} />;
  if (slide.kind === "diagram") return <DiagramSlide {...slide.props} />;
  return <ComponentSlide {...slide.props} />;
}

export function SlideDeck({ slides }: { slides: SlideDefinition[] }) {
  const total = slides.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    return parseSlideHash(window.location.hash, total);
  });
  const [helpOpen, setHelpOpen] = useState(false);
  const [fullscreenFallback, setFullscreenFallback] = useState(false);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const isFullscreen = nativeFullscreen || fullscreenFallback;
  const currentSlide = slides[clampSlideIndex(currentIndex, total)];
  const progressPct = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;

  const navigate = useCallback(
    (action: "next" | "prev" | "first" | "last") => {
      setCurrentIndex((index) => moveSlideIndex(index, total, action));
    },
    [total],
  );

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setFullscreenFallback(false);
      } else {
        await rootRef.current?.requestFullscreen();
      }
    } catch {
      setFullscreenFallback((value) => !value);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("presentation");
    return () => document.body.classList.remove("presentation");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextHash = slideHash(currentIndex);
    if (window.location.hash === nextHash) return;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${nextHash}`,
    );
  }, [currentIndex]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleHashChange = () => setCurrentIndex(parseSlideHash(window.location.hash, total));
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [total]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleFullscreenChange = () => {
      setNativeFullscreen(Boolean(document.fullscreenElement));
      if (document.fullscreenElement) setFullscreenFallback(false);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInteractiveTarget(event.target)) return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        navigate("next");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigate("prev");
      } else if (event.key === "Home") {
        event.preventDefault();
        navigate("first");
      } else if (event.key === "End") {
        event.preventDefault();
        navigate("last");
      } else if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        void toggleFullscreen();
      } else if (event.key === "?") {
        event.preventDefault();
        setHelpOpen((value) => !value);
      } else if (event.key === "Escape") {
        setHelpOpen(false);
        setFullscreenFallback(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, toggleFullscreen]);

  useEffect(() => {
    const nextSlide = slides[currentIndex + 1];
    if (nextSlide?.kind !== "diagram") return;
    void import("mermaid");
  }, [currentIndex, slides]);

  if (!currentSlide) {
    return <p className="text-muted-foreground">No presentation slides are configured.</p>;
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "hero-sky relative min-h-screen overflow-hidden text-foreground",
        fullscreenFallback && "fixed inset-0 z-50",
      )}
      data-fullscreen={isFullscreen ? "true" : "false"}
    >
      {/* ambient Living Landscape scenery behind every slide */}
      <SunGlow className="-top-40 right-[2%] opacity-80" />
      <Birds className="top-20" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 z-0">
        <Landscape className="h-32 opacity-90 sm:h-40 md:h-48" withMist={false} />
      </div>

      {!isFullscreen && (
        <Button
          asChild
          variant="outline"
          className="glass-chip absolute right-4 top-4 z-20 rounded-full"
        >
          <Link to="/about">Exit presentation</Link>
        </Button>
      )}

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[118rem] flex-col px-5 py-16 sm:px-8 lg:px-12">
        <div className="relative min-h-0 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide.id}
              className="h-full"
              initial={reduceMotion ? { opacity: 1 } : { x: 100, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { x: -100, opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: "easeInOut" }}
            >
              {renderSlide(currentSlide)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/15 bg-background/60 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[118rem] items-center gap-4">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="gradient-eco h-full rounded-full transition-[width] duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="min-w-20 text-right text-sm font-medium text-foreground/80">
            {currentIndex + 1} / {total}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </Button>
        </div>
      </div>

      {helpOpen && (
        <div
          className="absolute inset-0 z-30 flex cursor-default items-center justify-center bg-background/80 p-6 text-left backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Presentation shortcuts"
        >
          <div
            className="w-full max-w-xl rounded-3xl border bg-card p-6 shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold text-foreground">Keyboard shortcuts</h2>
            <div className="mt-5 grid gap-3 text-base text-muted-foreground">
              <p>Right arrow or Space: next slide</p>
              <p>Left arrow: previous slide</p>
              <p>Home / End: first or last slide</p>
              <p>F: toggle fullscreen</p>
              <p>?: show or hide this help</p>
              <p>Esc: close overlays or exit fullscreen</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
