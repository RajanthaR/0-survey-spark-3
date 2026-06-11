import type { AboutSectionId } from "@/about/lib/sections";
import { pickText, type Lang, type LocalizedString } from "@/lib/i18n";

type CompleteLocalizedString = Required<LocalizedString>;

export const ABOUT_UI_COPY_KEYS = [
  "appName",
  "shellSubtitle",
  "navAriaLabel",
  "laneLabel",
  "chooseLane",
  "hubLabel",
  "breadcrumbAbout",
  "searchButton",
  "searchPlaceholder",
  "searchEmpty",
  "searchGroup",
  "hubEyebrow",
  "hubTitle",
  "hubDescription",
  "openSection",
] as const;

export type AboutUiCopyKey = (typeof ABOUT_UI_COPY_KEYS)[number];

export const ABOUT_UI_SECTION_IDS = ["study", "research", "engineering", "present"] as const;

type AboutUiSectionCopy = {
  label: CompleteLocalizedString;
  title: CompleteLocalizedString;
  description: CompleteLocalizedString;
};

// SI/TA strings are AI-drafted for implementation; human review is required before merge.
export const ABOUT_UI = {
  appName: {
    en: "EIP Insight",
    si: "EIP Insight",
    ta: "EIP Insight",
  },
  shellSubtitle: {
    en: "Research documentation explorer",
    si: "පර්යේෂණ ලේඛන ගවේෂකය",
    ta: "ஆராய்ச்சி ஆவண உலாவி",
  },
  navAriaLabel: {
    en: "About lanes",
    si: "ගැන කොටස්",
    ta: "பற்றி பகுதிகள்",
  },
  laneLabel: {
    en: "Lane {n}",
    si: "පථය {n}",
    ta: "பாதை {n}",
  },
  chooseLane: {
    en: "Choose about lane",
    si: "ගැන පථයක් තෝරන්න",
    ta: "பற்றி பாதையைத் தேர்ந்தெடுக்கவும்",
  },
  hubLabel: {
    en: "Hub",
    si: "මධ්‍යස්ථානය",
    ta: "மையம்",
  },
  breadcrumbAbout: {
    en: "About",
    si: "ගැන",
    ta: "பற்றி",
  },
  searchButton: {
    en: "Search docs",
    si: "ලේඛන සොයන්න",
    ta: "ஆவணங்களைத் தேடுங்கள்",
  },
  searchPlaceholder: {
    en: "Search titles and headings...",
    si: "ශීර්ෂ සහ මාතෘකා සොයන්න...",
    ta: "தலைப்புகள் மற்றும் துணைத்தலைப்புகளைத் தேடுங்கள்...",
  },
  searchEmpty: {
    en: "No documents found.",
    si: "ලේඛන හමු නොවීය.",
    ta: "ஆவணங்கள் கிடைக்கவில்லை.",
  },
  searchGroup: {
    en: "Documents",
    si: "ලේඛන",
    ta: "ஆவணங்கள்",
  },
  hubEyebrow: {
    en: "Research explorer",
    si: "පර්යේෂණ ගවේෂකය",
    ta: "ஆராய்ச்சி உலாவி",
  },
  hubTitle: {
    en: "About this research",
    si: "මෙම පර්යේෂණය ගැන",
    ta: "இந்த ஆராய்ச்சி பற்றி",
  },
  hubDescription: {
    en: "A shared entry point for participant context, research evidence, engineering records, and presentation-ready summaries.",
    si: "සහභාගී වන්නන්ගේ පසුබිම, පර්යේෂණ සාක්ෂි, ඉංජිනේරු වාර්තා සහ ඉදිරිපත් කිරීමට සූදානම් සාරාංශ සඳහා එකම පිවිසුමකි.",
    ta: "பங்கேற்பாளர் பின்னணி, ஆராய்ச்சி ஆதாரம், பொறியியல் பதிவுகள் மற்றும் வழங்கத் தயாரான சுருக்கங்களுக்கான ஒருங்கிணைந்த நுழைவிடம்.",
  },
  openSection: {
    en: "Open {label}",
    si: "{label} විවෘත කරන්න",
    ta: "{label} திறக்க",
  },
  sections: {
    study: {
      label: {
        en: "Study",
        si: "අධ්‍යයනය",
        ta: "ஆய்வு",
      },
      title: {
        en: "Study & participation",
        si: "අධ්‍යයනය සහ සහභාගීත්වය",
        ta: "ஆய்வும் பங்கேற்பும்",
      },
      description: {
        en: "Participant-facing context, consent, survey scope, and research purpose.",
        si: "සහභාගී වන්නන්ට අවශ්‍ය පසුබිම, එකඟතාව, සමීක්ෂණ පරාසය සහ පර්යේෂණ අරමුණ.",
        ta: "பங்கேற்பாளர்களுக்கான பின்னணி, ஒப்புதல், கணக்கெடுப்பு வரம்பு மற்றும் ஆராய்ச்சி நோக்கம்.",
      },
    },
    research: {
      label: {
        en: "Research",
        si: "පර්යේෂණය",
        ta: "ஆராய்ச்சி",
      },
      title: {
        en: "Research narrative",
        si: "පර්යේෂණ විස්තරය",
        ta: "ஆராய்ச்சி விவரணம்",
      },
      description: {
        en: "Narrative evidence, design rationale, and research-method notes.",
        si: "විස්තරාත්මක සාක්ෂි, සැලසුම් හේතුකරණය සහ පර්යේෂණ ක්‍රම සටහන්.",
        ta: "விவர ஆதாரம், வடிவமைப்பு காரணம் மற்றும் ஆராய்ச்சி முறை குறிப்புகள்.",
      },
    },
    engineering: {
      label: {
        en: "Engineering",
        si: "ඉංජිනේරු",
        ta: "பொறியியல்",
      },
      title: {
        en: "Engineering & architecture",
        si: "ඉංජිනේරු සහ ගෘහනිර්මාණය",
        ta: "பொறியியலும் கட்டமைப்பும்",
      },
      description: {
        en: "Architecture, audits, runbooks, and implementation traceability.",
        si: "ගෘහනිර්මාණය, විගණන, ක්‍රියාපටිපාටි සහ ක්‍රියාත්මක කිරීමේ සලකුණු.",
        ta: "கட்டமைப்பு, தணிக்கைகள், செயல் வழிகாட்டிகள் மற்றும் அமலாக்க தடயங்கள்.",
      },
    },
    present: {
      label: {
        en: "Present",
        si: "ඉදිරිපත් කිරීම",
        ta: "வழங்கல்",
      },
      title: {
        en: "Presentation deck",
        si: "ඉදිරිපත් කිරීමේ විනිවිදක පෙළ",
        ta: "விளக்கக்காட்சி ஸ்லைடுகள்",
      },
      description: {
        en: "Reusable presentation views assembled from the other explorer lanes.",
        si: "අනෙකුත් ගවේෂක පථවලින් එකතු කළ නැවත භාවිත කළ හැකි ඉදිරිපත් කිරීමේ දසුන්.",
        ta: "மற்ற உலாவி பாதைகளிலிருந்து சேர்க்கப்பட்ட மறுபயன்பாட்டு வழங்கல் காட்சிகள்.",
      },
    },
  },
} satisfies Record<AboutUiCopyKey, CompleteLocalizedString> & {
  sections: Record<AboutSectionId, AboutUiSectionCopy>;
};

export function aboutLaneLabel(laneNumber: number, lang: Lang): string {
  return pickText(ABOUT_UI.laneLabel, lang).replace("{n}", String(laneNumber));
}

export function aboutOpenLabel(sectionId: AboutSectionId, lang: Lang): string {
  return pickText(ABOUT_UI.openSection, lang).replace(
    "{label}",
    pickText(ABOUT_UI.sections[sectionId].label, lang),
  );
}
