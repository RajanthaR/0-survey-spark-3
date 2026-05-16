import { motion } from "framer-motion";
import { LANGS, useLang } from "@/lib/i18n";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, setLang } = useLang();
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border bg-card p-1 ${compact ? "" : "shadow-soft"}`}>
      {LANGS.map((l) => {
        const active = l.code === lang;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => setLang(l.code)}
            className="relative px-3 py-1.5 text-sm font-medium transition-colors min-w-12"
            aria-pressed={active}
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                className="absolute inset-0 rounded-full gradient-eco"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className={`relative z-10 ${active ? "text-primary-foreground" : "text-foreground/70"}`}>
              {l.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
