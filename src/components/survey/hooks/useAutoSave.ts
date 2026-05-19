import { useEffect, useRef } from "react";

import type { Lang } from "@/lib/i18n";

export type AutoSavePayload = {
  answers: Record<string, unknown>;
  progressPct: number;
  language: Lang;
};

export function useAutoSave({
  enabled,
  payload,
  debounceMs = 1500,
  save,
}: {
  enabled: boolean;
  payload: AutoSavePayload;
  debounceMs?: number;
  save: (payload: AutoSavePayload) => Promise<unknown>;
}) {
  const saveRef = useRef(save);
  const lastSavedRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  saveRef.current = save;

  useEffect(() => {
    if (!enabled) return;
    const serialized = JSON.stringify(payload);
    if (serialized === lastSavedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = serialized;
      saveRef.current(payload).catch(() => {
        lastSavedRef.current = "";
      });
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [debounceMs, enabled, payload]);

  useEffect(() => {
    if (!enabled) return;
    const flush = () => {
      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedRef.current) return;
      lastSavedRef.current = serialized;
      saveRef.current(payload).catch(() => {});
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
    };
  }, [enabled, payload]);

  return {
    markSaved: () => {
      lastSavedRef.current = JSON.stringify(payload);
    },
  };
}
