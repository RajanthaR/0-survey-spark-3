import type { Lang } from "@/lib/i18n";

/**
 * Localized strings for the admin analytics-report panel.
 *
 * Keys mirror the English messages produced by `analyticsReportSchema`
 * in `admin.stats.functions.ts`, so the server's English payload can be
 * looked up directly via `SERVER_MSG_TO_KEY`. Anything the server adds
 * that is not in this map falls through to the original English string.
 *
 * Centralised in its own module so both the React panel and the
 * server↔client alignment tests can import the same source of truth
 * without pulling in React.
 */
export const DATE_I18N: Record<
  | "fromRequired"
  | "toRequired"
  | "fromFormat"
  | "toFormat"
  | "fromCalendar"
  | "toCalendar"
  | "missingTo"
  | "missingFrom"
  | "inverted"
  | "tooLong"
  | "rangeHelp"
  | "rangeExample"
  | "fromLabel"
  | "toLabel"
  | "csvBtn"
  | "pdfBtn"
  | "intro"
  | "downloaded"
  | "failed"
  | "datePlaceholder",
  Record<Lang, string>
> = {
  fromRequired: {
    en: "Start date is required.",
    si: "ආරම්භක දිනය අවශ්‍යයි.",
    ta: "தொடக்க தேதி தேவை.",
  },
  toRequired: {
    en: "End date is required.",
    si: "අවසන් දිනය අවශ්‍යයි.",
    ta: "முடிவு தேதி தேவை.",
  },
  fromFormat: {
    en: "Start date must be in YYYY-MM-DD format.",
    si: "ආරම්භක දිනය YYYY-MM-DD ආකෘතියෙන් විය යුතුය.",
    ta: "தொடக்க தேதி YYYY-MM-DD வடிவத்தில் இருக்க வேண்டும்.",
  },
  toFormat: {
    en: "End date must be in YYYY-MM-DD format.",
    si: "අවසන් දිනය YYYY-MM-DD ආකෘතියෙන් විය යුතුය.",
    ta: "முடிவு தேதி YYYY-MM-DD வடிவத்தில் இருக்க வேண்டும்.",
  },
  fromCalendar: {
    en: "Start date is not a valid calendar date.",
    si: "ආරම්භක දිනය වලංගු දින දර්ශනයක් නොවේ.",
    ta: "தொடக்க தேதி சரியான நாட்காட்டி தேதி அல்ல.",
  },
  toCalendar: {
    en: "End date is not a valid calendar date.",
    si: "අවසන් දිනය වලංගු දින දර්ශනයක් නොවේ.",
    ta: "முடிவு தேதி சரியான நாட்காட்டி தேதி அல்ல.",
  },
  missingTo: {
    en: "End date is required when start date is set.",
    si: "ආරම්භක දිනය ලබා දුන් විට අවසන් දිනයත් අවශ්‍යයි.",
    ta: "தொடக்க தேதி அமைக்கப்பட்டால் முடிவு தேதியும் தேவை.",
  },
  missingFrom: {
    en: "Start date is required when end date is set.",
    si: "අවසන් දිනය ලබා දුන් විට ආරම්භක දිනයත් අවශ්‍යයි.",
    ta: "முடிவு தேதி அமைக்கப்பட்டால் தொடக்க தேதியும் தேவை.",
  },
  inverted: {
    en: "Start date must be on or before end date.",
    si: "ආරම්භක දිනය අවසන් දිනයට හෝ ඊට පෙර විය යුතුය.",
    ta: "தொடக்க தேதி முடிவு தேதிக்கு முன்னரோ அல்லது அதே நாளிலோ இருக்க வேண்டும்.",
  },
  tooLong: {
    en: "Date range cannot exceed 366 days.",
    si: "දින පරාසය දින 366 ට වඩා වැඩි විය නොහැක.",
    ta: "தேதி வரம்பு 366 நாட்களை மீறக் கூடாது.",
  },
  rangeHelp: {
    en: "The range is capped at 366 days so the report stays fast and the per-question table fits in one PDF. To cover more, run the report twice with adjacent ranges.",
    si: "වාර්තාව වේගවත්ව තබා ගැනීමට සහ එක් PDF එකකට ගැළපීමට පරාසය දින 366 කට සීමා කර ඇත. වැඩි කාලයක් ආවරණය කිරීමට යාබද පරාස දෙකකින් වාර්තාව දෙවරක් ධාවනය කරන්න.",
    ta: "அறிக்கை வேகமாக இருக்கவும் ஒற்றை PDF இல் பொருந்தவும் வரம்பு 366 நாட்களாக வரையறுக்கப்பட்டுள்ளது. அதிக காலத்தை உள்ளடக்க, அடுத்தடுத்த இரண்டு வரம்புகளுடன் அறிக்கையை இருமுறை இயக்கவும்.",
  },
  // Concrete 2 × 182-day example so admins can copy the pattern. Each
  // chunk is 182 days inclusive (well under the 366-day cap), and the
  // two chunks are adjacent with no overlap.
  rangeExample: {
    en: "Example: split a full year into 2025-01-01 → 2025-07-01 and 2025-07-02 → 2025-12-30 (two 182-day chunks).",
    si: "උදාහරණයක්: සම්පූර්ණ වසරක් 2025-01-01 → 2025-07-01 සහ 2025-07-02 → 2025-12-30 ලෙස කොටස් දෙකකට වෙන් කරන්න (දින 182 බැගින්).",
    ta: "உதாரணம்: முழு ஆண்டையும் 2025-01-01 → 2025-07-01 மற்றும் 2025-07-02 → 2025-12-30 என இரண்டு 182-நாள் பகுதிகளாக பிரிக்கவும்.",
  },
  fromLabel: { en: "From", si: "සිට", ta: "முதல்" },
  toLabel: { en: "To", si: "දක්වා", ta: "வரை" },
  csvBtn: { en: "Download CSV", si: "CSV බාගන්න", ta: "CSV பதிவிறக்கு" },
  pdfBtn: { en: "Download PDF", si: "PDF බාගන්න", ta: "PDF பதிவிறக்கு" },
  intro: {
    en: "Download a snapshot of completion rate, language breakdown, and (when scoped to a single survey) per-question drop-off for the selected date range. Filter is applied on the response start date.",
    si: "තෝරාගත් දින පරාසය සඳහා සම්පූර්ණ කිරීමේ අනුපාතය, භාෂා බෙදාහැරීම සහ (තනි සමීක්ෂණයකට සීමා කළ විට) ප්‍රශ්නය අනුව හැර යාම බාගන්න. පෙරහන ප්‍රතිචාරයේ ආරම්භක දිනය මත යෙදේ.",
    ta: "தேர்ந்தெடுக்கப்பட்ட தேதி வரம்பிற்கான நிறைவு விகிதம், மொழி பகிர்வு மற்றும் (ஒற்றை கணக்கெடுப்புக்கு வரம்பிட்டால்) கேள்வி வாரியான கைவிடும் விகிதத்தை பதிவிறக்கவும். வடிகட்டி பதிலின் தொடக்க தேதியில் பயன்படுத்தப்படுகிறது.",
  },
  downloaded: {
    en: "Report downloaded",
    si: "වාර්තාව බාගත කර ඇත",
    ta: "அறிக்கை பதிவிறக்கப்பட்டது",
  },
  failed: {
    en: "Report failed",
    si: "වාර්තාව අසාර්ථකයි",
    ta: "அறிக்கை தோல்வி",
  },
  datePlaceholder: {
    en: "YYYY-MM-DD",
    si: "YYYY-MM-DD",
    ta: "YYYY-MM-DD",
  },
};

/**
 * Map every English server-side validation message to its translation
 * key. Add an entry here whenever a new message is added to
 * `analyticsReportSchema` — the `analytics-report.i18n-alignment` test
 * fails if the two drift apart.
 */
export const SERVER_MSG_TO_KEY: Record<string, keyof typeof DATE_I18N> = {
  "Start date is required.": "fromRequired",
  "End date is required.": "toRequired",
  "Start date must be in YYYY-MM-DD format.": "fromFormat",
  "End date must be in YYYY-MM-DD format.": "toFormat",
  "Start date is not a valid calendar date.": "fromCalendar",
  "End date is not a valid calendar date.": "toCalendar",
  "End date is required when start date is set.": "missingTo",
  "Start date is required when end date is set.": "missingFrom",
  "Start date must be on or before end date.": "inverted",
  "Date range cannot exceed 366 days.": "tooLong",
};

export function localizeServerMessage(msg: string, lang: Lang): string {
  const key = SERVER_MSG_TO_KEY[msg];
  return key ? DATE_I18N[key][lang] : msg;
}

/**
 * Field keys returned by the server-side schema. Kept in sync with the
 * `path` arguments in `analyticsReportSchema`'s `addIssue` calls.
 */
export const FIELD_KEYS = ["dateFrom", "dateTo"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];