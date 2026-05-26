import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "en" | "si" | "ta";

export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "EN", native: "English" },
  { code: "si", label: "සි", native: "සිංහල" },
  { code: "ta", label: "த", native: "தமிழ்" },
];

export type LocalizedString = { en: string; si?: string; ta?: string };

export const LANG_LABELS: Record<Lang, LocalizedString> = {
  en: { en: "English", si: "ඉංග්‍රීසි", ta: "ஆங்கிலம்" },
  si: { en: "Sinhala", si: "සිංහල", ta: "சிங்களம்" },
  ta: { en: "Tamil", si: "දෙමළ", ta: "தமிழ்" },
};

const warned = new Set<string>();
let pickTextMissCount = 0;
const pickTextMisses: string[] = [];

function shouldTrackPickTextMisses() {
  return import.meta.env.MODE === "test";
}

function warnFallback(key: string, lang: Lang) {
  if (shouldTrackPickTextMisses()) {
    pickTextMissCount += 1;
    pickTextMisses.push(`${lang}:${key}`);
  }
  if (import.meta.env.PROD || import.meta.env.SSR) return;
  const id = `${lang}:${key}`;
  if (warned.has(id)) return;
  warned.add(id);
  console.warn(`[i18n] missing ${lang} translation, falling back to en: "${key.slice(0, 60)}"`);
}

export function getPickTextMisses(): readonly string[] {
  return pickTextMisses;
}

export function getPickTextMissCount(): number {
  return pickTextMissCount;
}

export function resetPickTextMisses(): void {
  pickTextMissCount = 0;
  pickTextMisses.length = 0;
}

export function pickText(s: LocalizedString | string | undefined, lang: Lang): string {
  if (!s) return "";
  if (typeof s === "string") return s;
  if (lang !== "en" && !s[lang] && s.en) warnFallback(s.en, lang);
  return s[lang] || s.en || "";
}

// UI strings
export const UI = {
  appName: { en: "EIP Insight", si: "EIP Insight", ta: "EIP Insight" },
  tagline: {
    en: "Help shape Sri Lanka's first Eco-Industrial Park model",
    si: "ශ්‍රී ලංකාවේ පළමු පරිසර කාර්මික උද්‍යාන මාදිලිය හැඩ ගැස්වීමට සහාය වන්න",
    ta: "இலங்கையின் முதல் சுற்றுச்சூழல் தொழில் பூங்கா மாதிரியை வடிவமைக்க உதவுங்கள்",
  },
  intro: {
    en: "A short, anonymous research survey by the University of Sri Jayewardenepura. Your input directly informs PhD research on sustainable industrial development across South Asia.",
    si: "ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලය විසින් පවත්වන කෙටි, නිර්නාමික පර්යේෂණ සමීක්ෂණයකි. ඔබේ අදහස් දකුණු ආසියාවේ තිරසර කාර්මික සංවර්ධනය පිළිබඳ ආචාර්ය උපාධි පර්යේෂණයට සෘජුව දායක වේ.",
    ta: "ஸ்ரீ ஜயவர்தனபுர பல்கலைக்கழகம் நடத்தும் குறுகிய, அநாமதேய ஆராய்ச்சி கணக்கெடுப்பு. உங்கள் கருத்துகள் தென் ஆசியாவில் நிலையான தொழில்துறை வளர்ச்சி குறித்த முனைவர் பட்ட ஆராய்ச்சிக்கு நேரடியாக உதவும்.",
  },
  skipToMain: {
    en: "Skip to main content",
    si: "ප්‍රධාන අන්තර්ගතයට යන්න",
    ta: "முக்கிய உள்ளடக்கத்திற்குச் செல்லவும்",
  },
  start: { en: "Start", si: "ආරම්භ කරන්න", ta: "தொடங்கு" },
  resume: { en: "Resume", si: "නැවත ආරම්භ", ta: "தொடரவும்" },
  next: { en: "Next", si: "ඊළඟ", ta: "அடுத்தது" },
  back: { en: "Back", si: "ආපසු", ta: "பின்" },
  submit: { en: "Submit", si: "ඉදිරිපත් කරන්න", ta: "சமர்ப்பி" },
  saveExit: { en: "Save & exit", si: "සුරකින්න", ta: "சேமி & வெளியேறு" },
  required: { en: "Required", si: "අවශ්‍යයි", ta: "கட்டாயம்" },
  optional: { en: "Optional", si: "විකල්ප", ta: "விருப்பம்" },
  consentTitle: { en: "Consent to participate", si: "සහභාගීත්ව එකඟතාව", ta: "பங்கேற்க ஒப்புதல்" },
  consentLead: {
    en: "Please review and accept the items below before continuing. Your participation is voluntary and you can withdraw at any time.",
    si: "කරුණාකර පහත කරුණු කියවා පිළිගන්න. ඔබේ සහභාගීත්වය ස්වේච්ඡා වේ.",
    ta: "தொடர்வதற்கு முன் கீழே உள்ள உருப்படிகளை ஏற்றுக்கொள்ளவும்.",
  },
  consentAgree: {
    en: "I agree and want to continue",
    si: "මම එකඟ වෙමි",
    ta: "நான் ஒப்புக்கொள்கிறேன்",
  },
  progress: { en: "Progress", si: "ප්‍රගතිය", ta: "முன்னேற்றம்" },
  question: { en: "Question", si: "ප්‍රශ්නය", ta: "கேள்வி" },
  of: { en: "of", si: "/", ta: "இல்" },
  thanksTitle: { en: "Thank you 🌱", si: "ස්තූතියි 🌱", ta: "நன்றி 🌱" },
  thanksLead: {
    en: "Your response has been recorded. Optionally leave your contact below to be notified about results.",
    si: "ඔබේ ප්‍රතිචාරය සටහන් කර ඇත.",
    ta: "உங்கள் பதில் பதிவு செய்யப்பட்டது.",
  },
  resumeLink: {
    en: "Save this link to come back to your survey on any device:",
    si: "ඕනෑම උපාංගයකින් නැවත පැමිණීමට මෙම සබැඳිය සුරකින්න:",
    ta: "எந்த சாதனத்திலிருந்தும் திரும்ப வர இந்த இணைப்பை சேமிக்கவும்:",
  },
  copy: { en: "Copy link", si: "පිටපත්", ta: "நகலெடு" },
  copied: { en: "Copied!", si: "පිටපත් කර ඇත!", ta: "நகலெடுக்கப்பட்டது!" },
  encouragements: [
    { en: "Nice work — keep going.", si: "හොඳයි — දිගටම යන්න.", ta: "சிறந்தது — தொடரவும்." },
    { en: "Halfway there. 🌿", si: "අඩක් ඉවරයි. 🌿", ta: "பாதி வழி. 🌿" },
    { en: "Almost done — just a few more.", si: "ඉවර වෙන්න ඔන්න.", ta: "முடிய இன்னும் சில." },
  ],
  emailLabel: { en: "Email (optional)", si: "ඊමේල් (විකල්ප)", ta: "மின்னஞ்சல் (விருப்பம்)" },
  nameLabel: { en: "Name (optional)", si: "නම (විකල්ප)", ta: "பெயர் (விருப்பம்)" },
  orgLabel: { en: "Organization (optional)", si: "ආයතනය", ta: "நிறுவனம்" },
  errorSave: {
    en: "Couldn't save right now. Check your connection and try again.",
    si: "දැන් සුරැකීම අසාර්ථකයි.",
    ta: "சேமிக்க முடியவில்லை.",
  },
  reviewTitle: {
    en: "Review your answers",
    si: "ඔබේ පිළිතුරු සමාලෝචනය කරන්න",
    ta: "உங்கள் பதில்களை மீளாய்வு செய்யவும்",
  },
  reviewLead: {
    en: "Tap any answer to edit. When you're happy, continue to submit.",
    si: "සංස්කරණය කිරීමට ඕනෑම පිළිතුරක් තට්ටු කරන්න.",
    ta: "திருத்த எந்த பதிலையும் தட்டவும்.",
  },
  edit: { en: "Edit", si: "සංස්කරණය", ta: "திருத்து" },
  notAnswered: { en: "Not answered", si: "පිළිතුරු නොදුන්", ta: "பதிலளிக்கப்படவில்லை" },
  invalidEmail: {
    en: "Please enter a valid email address.",
    si: "වලංගු ඊමේල් ලිපිනයක් ඇතුළත් කරන්න.",
    ta: "சரியான மின்னஞ்சல் முகவரியை உள்ளிடவும்.",
  },
  invalidTel: {
    en: "Please enter a valid phone number.",
    si: "වලංගු දුරකථන අංකයක් ඇතුළත් කරන්න.",
    ta: "சரியான தொலைபேசி எண்ணை உள்ளிடவும்.",
  },
  invalidNumber: {
    en: "Please enter a valid number.",
    si: "වලංගු අංකයක් ඇතුළත් කරන්න.",
    ta: "சரியான எண்ணை உள்ளிடவும்.",
  },
  selectAtLeast: {
    en: "Please select at least {n} options.",
    si: "අවම වශයෙන් විකල්ප {n}ක් තෝරන්න.",
    ta: "குறைந்தது {n} விருப்பங்களைத் தேர்ந்தெடுக்கவும்.",
  },
  saved: { en: "Saved", si: "සුරකින ලදී", ta: "சேமிக்கப்பட்டது" },
  requirementsTitle: { en: "Requirements", si: "අවශ්‍යතා", ta: "தேவைகள்" },
  requirementsLead: {
    en: "All items below are required to participate. Tap any item to read the full text.",
    si: "සහභාගී වීමට පහත සියල්ල අවශ්‍යයි. සම්පූර්ණ පෙළ බැලීමට ඕනෑම අයිතමයක් තට්ටු කරන්න.",
    ta: "பங்கேற்க கீழே உள்ள அனைத்தும் தேவை. முழு உரையைப் படிக்க எந்த உருப்படியையும் தட்டவும்.",
  },
  optionalTitle: { en: "Optional permissions", si: "විකල්ප අවසර", ta: "விருப்ப அனுமதிகள்" },
  optionalLead: {
    en: "These are optional. You can continue without selecting either.",
    si: "මේවා විකල්පයි. ඒවා තෝරා නොගෙනත් ඉදිරියට යා හැක.",
    ta: "இவை விருப்பமானவை. தேர்வு செய்யாமலும் தொடரலாம்.",
  },
  continueLabel: { en: "Continue", si: "ඉදිරියට", ta: "தொடரவும்" },
  tapToSelect: {
    en: "Tap card to select",
    si: "තේරීමට කාඩ්පත තට්ටු කරන්න",
    ta: "தேர்வு செய்ய அட்டையைத் தட்டவும்",
  },
  selected: { en: "Selected", si: "තෝරාගන්නා ලදී", ta: "தேர்ந்தெடுக்கப்பட்டது" },
  deselected: { en: "Deselected", si: "තේරීම ඉවත් කරන ලදී", ta: "தேர்வு நீக்கப்பட்டது" },
  optionalHintIdle: {
    en: "Tap to select an option, or skip — both are optional.",
    si: "විකල්පයක් තේරීමට තට්ටු කරන්න, නැතහොත් මඟ හරින්න — දෙකම විකල්පයි.",
    ta: "ஒரு விருப்பத்தைத் தேர்வு செய்ய தட்டவும், அல்லது தவிர்க்கவும் — இரண்டும் விருப்பமானவை.",
  },
  optionalHintReady: {
    en: "You can continue now.",
    si: "ඔබට දැන් ඉදිරියට යා හැක.",
    ta: "நீங்கள் இப்போது தொடரலாம்.",
  },
  optionalCardAria: {
    en: "Optional consent. Double tap to toggle.",
    si: "විකල්ප එකඟතාව. මාරු කිරීමට දෙවරක් තට්ටු කරන්න.",
    ta: "விருப்ப ஒப்புதல். மாற்ற இருமுறை தட்டவும்.",
  },
  optionalKeyboardHint: {
    en: "Keyboard: ↑ ↓ ← → to move between cards, Home / End for first / last, Enter or Space to toggle.",
    si: "යතුරුපුවරුව: කාඩ්පත් අතර යාමට ↑ ↓ ← →, මුල / අග සඳහා Home / End, මාරු කිරීමට Enter හෝ Space.",
    ta: "விசைப்பலகை: அட்டைகளுக்கு இடையில் நகர ↑ ↓ ← →, முதல் / கடைசிக்கு Home / End, மாற்ற Enter அல்லது Space.",
  },
  optionalMobileHint: {
    en: "Tap each card to choose, then continue to the questionnaire.",
    si: "තේරීමට එක් එක් කාඩ්පත තට්ටු කර, පසුව ප්‍රශ්නාවලියට ඉදිරියට යන්න.",
    ta: "தேர்வு செய்ய ஒவ்வொரு அட்டையையும் தட்டி, பின்னர் கேள்வித்தாளுக்குத் தொடரவும்.",
  },
  verifyFailedTitle: {
    en: "Verification needed",
    si: "තහවුරු කිරීම අවශ්‍යයි",
    ta: "சரிபார்ப்பு தேவை",
  },
  verifyFailedLead: {
    en: "We couldn't confirm you're human. Please try again — no answers were lost.",
    si: "ඔබ මිනිසෙකු බව තහවුරු කළ නොහැකි විය. නැවත උත්සාහ කරන්න — පිළිතුරු නැති වී නැත.",
    ta: "நீங்கள் மனிதர் என்பதை உறுதிப்படுத்த முடியவில்லை. மீண்டும் முயற்சிக்கவும் — எந்தப் பதிலும் இழக்கப்படவில்லை.",
  },
  retry: {
    en: "Try again",
    si: "නැවත උත්සාහ කරන්න",
    ta: "மீண்டும் முயற்சிக்கவும்",
  },
  goHome: { en: "Go home", si: "මුල් පිටුවට යන්න", ta: "முகப்புக்குச் செல்லவும்" },
  notFoundTitle: { en: "Page not found", si: "පිටුව හමු නොවීය", ta: "பக்கம் கிடைக்கவில்லை" },
  notFoundBody: {
    en: "The page you're looking for doesn't exist or has been moved.",
    si: "ඔබ සොයන පිටුව නොමැත හෝ වෙනත් ස්ථානයකට ගෙන ගොස් ඇත.",
    ta: "நீங்கள் தேடும் பக்கம் இல்லை அல்லது இடம் மாற்றப்பட்டுள்ளது.",
  },
  errorTitle: {
    en: "This page didn't load",
    si: "මෙම පිටුව පූරණය නොවීය",
    ta: "இந்தப் பக்கம் ஏற்றப்படவில்லை",
  },
  errorBody: {
    en: "Something went wrong on our end. You can try refreshing or head back home.",
    si: "අපගේ පාර්ශ්වයේ දෝෂයක් සිදු විය. පිටුව නැවත පූරණය කරන්න හෝ මුල් පිටුවට යන්න.",
    ta: "எங்களிடம் ஏதோ தவறு ஏற்பட்டது. புதுப்பிக்க முயற்சிக்கலாம் அல்லது முகப்புக்குச் செல்லலாம்.",
  },
  surveyNotFound: {
    en: "Survey not found",
    si: "සමීක්ෂණය හමු නොවීය",
    ta: "கணக்கெடுப்பு கிடைக்கவில்லை",
  },
  researcherLogin: {
    en: "Researcher login",
    si: "පර්යේෂක පිවිසුම",
    ta: "ஆராய்ச்சியாளர் உள்நுழைவு",
  },
  aboutLink: {
    en: "About this research",
    si: "මෙම පර්යේෂණය ගැන",
    ta: "இந்த ஆராய்ச்சி பற்றி",
  },
  placeholderText: {
    en: "Type your answer",
    si: "ඔබේ පිළිතුර ටයිප් කරන්න",
    ta: "உங்கள் பதிலைத் தட்டச்சு செய்க",
  },
  placeholderLongText: {
    en: "Type your answer",
    si: "ඔබේ පිළිතුර ටයිප් කරන්න",
    ta: "உங்கள் பதிலைத் தட்டச்சு செய்க",
  },
  placeholderEmail: {
    en: "name@example.com",
    si: "name@example.com",
    ta: "name@example.com",
  },
  placeholderTel: {
    en: "Phone number",
    si: "දුරකථන අංකය",
    ta: "தொலைபேசி எண்",
  },
  placeholderNumber: {
    en: "Enter a number",
    si: "අංකයක් ඇතුළත් කරන්න",
    ta: "எண்ணை உள்ளிடவும்",
  },
  placeholderGeo: {
    en: "lat, lng or place name",
    si: "අක්ෂාංශ, දේශාංශ හෝ ස්ථානයේ නම",
    ta: "அட்சரேகை, தீர்க்கரேகை அல்லது இடப் பெயர்",
  },
  questionMap: { en: "Question map", si: "ප්‍රශ්න සිතියම", ta: "கேள்வி வரைபடம்" },
  questionMapLead: {
    en: "Jump to any question. Answered items are checked; the current one is highlighted.",
    si: "ඕනෑම ප්‍රශ්නයකට යන්න. පිළිතුරු දුන් ඒවා සලකුණු වී ඇත; වත්මන් එක උද්දීපනය වේ.",
    ta: "எந்த கேள்விக்கும் செல்லவும். பதிலளிக்கப்பட்டவை குறிக்கப்பட்டுள்ளன; தற்போதையது சிறப்பிக்கப்பட்டுள்ளது.",
  },
  answered: { en: "Answered", si: "පිළිතුරු දී ඇත", ta: "பதிலளிக்கப்பட்டது" },
  skipped: { en: "skipped", si: "මඟ හරින ලදී", ta: "தவிர்க்கப்பட்டது" },
  responseVisualHeading: { en: "Your selections", si: "ඔබේ තේරීම්", ta: "உங்கள் தேர்வுகள்" },
  responseVisualTapHint: { en: "Tap to expand", si: "විස්තර බලන්න", ta: "விரிவாக்க தட்டவும்" },
  current: { en: "Current", si: "වත්මන්", ta: "தற்போதையது" },
  jumpToNextUnanswered: {
    en: "Jump to next unanswered",
    si: "පිළිතුරු නොදුන් මීළඟ ප්‍රශ්නයට යන්න",
    ta: "அடுத்த பதிலளிக்கப்படாத கேள்விக்குச் செல்லவும்",
  },
  errorSummaryTitle: {
    en: "Please fix this to continue",
    si: "ඉදිරියට යාමට මෙය නිවැරදි කරන්න",
    ta: "தொடர இதைச் சரிசெய்யவும்",
  },
} satisfies Record<string, LocalizedString | LocalizedString[]>;

export function t(key: keyof typeof UI, lang: Lang): string {
  const v = UI[key];
  if (Array.isArray(v)) return pickText(v[0], lang);
  return pickText(v, lang);
}

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  /**
   * Adopt a language value that came from server data (e.g. a resumed
   * response). No-op when the user has already made an explicit
   * selection via the toggle, so the user's persisted choice is never
   * overwritten by server data on re-mount or refresh.
   */
  adoptServerLang: (l: Lang, opts?: { force?: boolean }) => void;
  /** True once the user has explicitly selected a language. */
  langTouched: boolean;
}
const Ctx = createContext<I18nCtx>({
  lang: "en",
  setLang: () => {},
  adoptServerLang: () => {},
  langTouched: false,
});

const TOUCHED_KEY = "eip.lang.touched";
const LANG_KEY = "eip.lang";

function writeLangCookie(l: Lang) {
  document.cookie = `${LANG_KEY}=${encodeURIComponent(l)}; path=/; max-age=31536000; samesite=lax`;
}

export function I18nProvider({
  children,
  initialLang = "en",
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return initialLang;
    const stored = window.localStorage.getItem(LANG_KEY);
    return stored && LANGS.some((l) => l.code === stored) ? (stored as Lang) : initialLang;
  });
  const [langTouched, setLangTouched] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(TOUCHED_KEY) === "1";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_KEY, l);
      window.localStorage.setItem(TOUCHED_KEY, "1");
      writeLangCookie(l);
      document.documentElement.lang = l;
    }
    setLangTouched(true);
  };

  const adoptServerLang = (l: Lang, opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    // Honour an explicit user choice above anything the server says.
    if (!force && langTouched) return;
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LANG_KEY, l);
      writeLangCookie(l);
      document.documentElement.lang = l;
    }
  };

  return (
    <Ctx.Provider value={{ lang, setLang, adoptServerLang, langTouched }}>{children}</Ctx.Provider>
  );
}

export const useLang = () => useContext(Ctx);
