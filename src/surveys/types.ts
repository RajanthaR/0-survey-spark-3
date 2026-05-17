import type { LocalizedString } from "@/lib/i18n";
import type { OptionIconName } from "./visuals/icons";

export type QuestionType =
  | "single_choice"
  | "multi_choice"
  | "likert_5"
  | "text"
  | "long_text"
  | "email"
  | "tel"
  | "number_range"
  | "geo"
  | "pairwise_saaty"
  | "yes_no"
  | "section_header";

/**
 * Optional per-option visual.
 *
 * Per-question rule (validated at module load — see `validate.ts`):
 * either every option in a question carries a `visual`, or none do.
 * Mixing the two within one question throws in dev and is logged in prod.
 */
export type OptionVisual =
  | {
      kind: "icon";
      /** Must be a key of `OPTION_ICONS` — typo-proof. */
      name: OptionIconName;
      /**
       * Tone tints the icon. `positive` -> success colour,
       * `negative` -> destructive colour, `default` -> currentColor.
       */
      tone?: "default" | "positive" | "negative";
    }
  | {
      kind: "image";
      /** Static-imported asset URL (e.g. `import farming from "@/assets/options/farming.webp"`). */
      src: string;
      /** Localized alt text. Omit when the visual is purely decorative. */
      alt?: LocalizedString;
    };

export interface Option {
  value: string;
  label: LocalizedString;
  visual?: OptionVisual;
}

export interface PairwiseCriterion {
  key: string;
  label: LocalizedString;
}

export interface Question {
  id: string;
  type: QuestionType;
  section: LocalizedString;
  label: LocalizedString;
  help?: LocalizedString;
  /**
   * Optional placeholder text for free-text inputs (text, email, tel,
   * number_range, long_text, geo). Falls back to a language-aware
   * default from `UI.placeholderDefaults` when absent so the user
   * never sees a stale English hint after toggling languages.
   */
  placeholder?: LocalizedString;
  required?: boolean;
  options?: Option[];
  allowOther?: boolean;
  /**
   * Conditional visibility. Legacy form `{ questionId, equals }` is still
   * supported (treated as `op: "eq"`). New form supports operators:
   *   - eq:       answer equals value (or any of value[])
   *   - neq:      answer is set AND not equal to value
   *   - in:       answer (or any element if array) is in value[]
   *   - answered: question has any non-empty answer (value ignored)
   */
  showIf?:
    | { questionId: string; equals: string | string[] }
    | {
        questionId: string;
        op: "eq" | "neq" | "in" | "answered";
        value?: string | string[];
      };
  /** for multi_choice — cap selections (e.g. "pick top 3") */
  maxSelect?: number;
  /** for multi_choice — minimum selections required (defaults to 1 when `required`) */
  minSelect?: number;
  /** for pairwise_saaty */
  criteria?: PairwiseCriterion[];
}

export interface Survey {
  slug: string;
  title: LocalizedString;
  subtitle: LocalizedString;
  estimatedMinutes: number;
  consent: {
    id: string;
    label: LocalizedString;
    shortLabel?: LocalizedString;
    required?: boolean;
  }[];
  questions: Question[];
}

/** Shared Yes/No option dictionary used by yes_no questions and the codebook. */
export const YES_NO_OPTIONS: Option[] = [
  {
    value: "yes",
    label: { en: "Yes", si: "ඔව්", ta: "ஆம்" },
    visual: { kind: "icon", name: "thumbs-up", tone: "positive" },
  },
  {
    value: "no",
    label: { en: "No", si: "නැත", ta: "இல்லை" },
    visual: { kind: "icon", name: "thumbs-down", tone: "negative" },
  },
];

export const LIKERT_5: Option[] = [
  {
    value: "1",
    label: { en: "Strongly disagree", si: "කිසිසේත් එකඟ නොවේ", ta: "முற்றிலும் ஏற்கவில்லை" },
    visual: { kind: "icon", name: "frown", tone: "negative" },
  },
  {
    value: "2",
    label: { en: "Disagree", si: "එකඟ නොවේ", ta: "ஏற்கவில்லை" },
    visual: { kind: "icon", name: "meh", tone: "negative" },
  },
  {
    value: "3",
    label: { en: "Neutral", si: "මධ්‍යස්ථ", ta: "நடுநிலை" },
    visual: { kind: "icon", name: "circle-dot" },
  },
  {
    value: "4",
    label: { en: "Agree", si: "එකඟයි", ta: "ஏற்கிறேன்" },
    visual: { kind: "icon", name: "smile", tone: "positive" },
  },
  {
    value: "5",
    label: { en: "Strongly agree", si: "සම්පූර්ණයෙන් එකඟයි", ta: "முற்றிலும் ஏற்கிறேன்" },
    visual: { kind: "icon", name: "laugh", tone: "positive" },
  },
];

export const MONTHS_12: Option[] = [
  { value: "jan", label: { en: "Jan", si: "ජන", ta: "ஜன" } },
  { value: "feb", label: { en: "Feb", si: "පෙබ", ta: "பிப்" } },
  { value: "mar", label: { en: "Mar", si: "මාර්තු", ta: "மார்" } },
  { value: "apr", label: { en: "Apr", si: "අප්‍රේල්", ta: "ஏப்" } },
  { value: "may", label: { en: "May", si: "මැයි", ta: "மே" } },
  { value: "jun", label: { en: "Jun", si: "ජූනි", ta: "ஜூன்" } },
  { value: "jul", label: { en: "Jul", si: "ජූලි", ta: "ஜூலை" } },
  { value: "aug", label: { en: "Aug", si: "අගෝ", ta: "ஆக" } },
  { value: "sep", label: { en: "Sep", si: "සැප්", ta: "செப்" } },
  { value: "oct", label: { en: "Oct", si: "ඔක්", ta: "அக்" } },
  { value: "nov", label: { en: "Nov", si: "නොවැ", ta: "நவ" } },
  { value: "dec", label: { en: "Dec", si: "දෙසැ", ta: "டிச" } },
];

/** Documents block — shared by Phase 1 (G) and Phase 3 (H) */
export const DOC_OPTIONS: Option[] = [
  {
    value: "annual_reports",
    label: { en: "Annual reports", si: "වාර්ෂික වාර්තා", ta: "ஆண்டு அறிக்கைகள்" },
    visual: { kind: "icon", name: "file-text" },
  },
  {
    value: "strategic_plans",
    label: { en: "Strategic plans", si: "ක්‍රමෝපාය සැලසුම්", ta: "மூலோபாய திட்டங்கள்" },
    visual: { kind: "icon", name: "map" },
  },
  {
    value: "policy_docs",
    label: { en: "Policy documents", si: "ප්‍රතිපත්ති ලේඛන", ta: "கொள்கை ஆவணங்கள்" },
    visual: { kind: "icon", name: "book-open" },
  },
  {
    value: "project_reports",
    label: { en: "Project reports", si: "ව්‍යාපෘති වාර්තා", ta: "திட்ட அறிக்கைகள்" },
    visual: { kind: "icon", name: "bar-chart" },
  },
  {
    value: "eia",
    label: {
      en: "Environmental impact assessments",
      si: "පාරිසරික බලපෑම් ඇගයීම්",
      ta: "சுற்றுச்சூழல் தாக்க மதிப்பீடுகள்",
    },
    visual: { kind: "icon", name: "leaf" },
  },
  {
    value: "feasibility",
    label: { en: "Feasibility studies", si: "හැකියාව අධ්‍යයන", ta: "சாத்தியக்கூறு ஆய்வுகள்" },
    visual: { kind: "icon", name: "clipboard-check" },
  },
  {
    value: "training",
    label: {
      en: "Training material / courses",
      si: "පුහුණු ද්‍රව්‍ය / පாඨமாலා",
      ta: "பயிற்சி பொருட்கள்",
    },
    visual: { kind: "icon", name: "graduation-cap" },
  },
  {
    value: "org_charts",
    label: {
      en: "Organisation structure charts",
      si: "සංවිධාන ව්‍යුහ සටහන්",
      ta: "அமைப்பு கட்டமைப்பு",
    },
    visual: { kind: "icon", name: "network" },
  },
  {
    value: "budgets",
    label: { en: "Budget documents", si: "අයවැය ලේඛන", ta: "வரவு செலவு ஆவணங்கள்" },
    visual: { kind: "icon", name: "wallet" },
  },
  {
    value: "kpi",
    label: {
      en: "Performance / KPI reports",
      si: "කාර්ය සාධන දර්ශක / KPI වාර්තා",
      ta: "செயல்திறன் / KPI அறிக்கைகள்",
    },
    visual: { kind: "icon", name: "gauge" },
  },
];

export const DOC_SHARING_OPTIONS: Option[] = [
  {
    value: "all",
    label: {
      en: "Yes — all requested documents",
      si: "ඔව්, ඉල්ලූ සියලු ලේඛන",
      ta: "ஆம், கோரப்பட்ட அனைத்தும்",
    },
    visual: { kind: "icon", name: "check-check", tone: "positive" },
  },
  {
    value: "some",
    label: {
      en: "Yes — some, subject to approval",
      si: "ඔව්, සමහරක් (අනුමැතියට යටත්ව)",
      ta: "ஆம், சில (ஒப்புதலுக்கு உட்பட்டு)",
    },
    visual: { kind: "icon", name: "check" },
  },
  {
    value: "none",
    label: { en: "No — confidential documents", si: "නැත — රහස්‍ය ලේඛන", ta: "இல்லை — ரகசியம்" },
    visual: { kind: "icon", name: "lock", tone: "negative" },
  },
  {
    value: "on_request",
    label: {
      en: "Available after a formal request",
      si: "නිල ඉල්ලීමකින් පසු ලබාදිය හැක",
      ta: "முறையான கோரிக்கையின் பேரில்",
    },
    visual: { kind: "icon", name: "mail" },
  },
];
