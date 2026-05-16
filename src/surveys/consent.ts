import type { LocalizedString } from "@/lib/i18n";

/** Study metadata from the official Consent Form */
export const STUDY_META = {
  ercNumber: "ERC-HSS/FGS/2025/09/03",
  title: {
    en: "Formulation of an optimal Eco-Industrial Park Model for the South Asian Region — identifying barriers, potentials and best practices.",
    si: "දකුණු ආසියාතික කලාපය සඳහා උපරිම පරිසර හිතකාමී කාර්මික උද්‍යාන (EIP) ආකෘතියක් සකස් කිරීම — බාධක, හැකියාවන් සහ හොඳම ක්‍රියාමාර්ග හඳුනාගැනීම.",
    ta: "தென் ஆசியப் பிராந்தியத்திற்கான உகந்த சுற்றுச்சூழல்-தொழில்துறை பூங்கா (EIP) மாதிரியை உருவாக்குதல்.",
  } satisfies LocalizedString,
  principalResearcher: "Dr. K.P.P Udaygee",
  principalContact: "udayagee@sjp.ac.lk · +94 70 5635 213",
  primaryResearcher: "H.G.T.P Samarawickrama (Ph.D Student)",
  primaryEmail: "1951MD2025007@fgs.sjp.ac.lk",
  institution: "University of Sri Jayewardenepura · Tel 0112 801 604 ext 8484",
};

/** 13-item consent block from the official form (1–7 + 13 mandatory; 8–12 omitted — they cover audio/video/photo). */
export const CONSENT_ITEMS: { id: string; label: LocalizedString; shortLabel?: LocalizedString; required?: boolean }[] = [
  {
    id: "c1",
    required: true,
    shortLabel: {
      en: "Information sheet read & understood",
      si: "තොරතුරු පත්‍රිකාව කියවා තේරුම් ගත්තා",
      ta: "தகவல் தாள் படித்து புரிந்து கொண்டேன்",
    },
    label: {
      en: "I confirm that I have read and understood the information sheet for the above study, had the opportunity to consider it, ask questions, and have had these answered satisfactorily.",
      si: "ඉහත අධ්‍යයනය සඳහා වන තොරතුරු පත්‍රිකාව මම කියවා තේරුම් ගත් බවත්, ප්‍රශ්න ඇසීමට අවස්ථාව ලැබුණු අතර ඒවාට ප්‍රමාණවත් පිළිතුරු ලැබුණු බවත් මම තහවුරු කරමි.",
      ta: "மேற்கூறிய ஆய்வுக்கான தகவல் தாளை நான் படித்து புரிந்து கொண்டுள்ளேன், கேள்விகள் கேட்கவும், திருப்திகரமாக பதில்களைப் பெறவும் வாய்ப்புக் கிடைத்தது என்பதை உறுதிப்படுத்துகிறேன்.",
    },
  },
  {
    id: "c2",
    required: true,
    shortLabel: {
      en: "Voluntary participation — can withdraw anytime",
      si: "ස්වේච්ඡා සහභාගීත්වය — ඕනෑම විට ඉවත් විය හැක",
      ta: "தன்னார்வ பங்கேற்பு — எப்போதும் விலகலாம்",
    },
    label: {
      en: "I understand that my participation is voluntary and that I am free to withdraw at any time, without giving any reason and without any adverse consequences.",
      si: "මගේ සහභාගීත්වය ස්වේච්ඡා බවත්, කිසිදු හේතුවක් නොදී, ප්‍රතිවිපාකයකින් තොරව ඕනෑම අවස්ථාවක ඉවත් විය හැකි බවත් මම තේරුම් ගනිමි.",
      ta: "எனது பங்கேற்பு தன்னார்வமானது என்பதையும், எந்த நேரத்திலும், காரணம் கூறாமல், எதிர்மறையான விளைவுகள் இல்லாமல் விலகலாம் என்பதையும் புரிந்துகொள்கிறேன்.",
    },
  },
  {
    id: "c3",
    required: true,
    shortLabel: {
      en: "Authorised people may access research data",
      si: "අනුමත පුද්ගලයින්ට දත්ත බැලීමට අවසර",
      ta: "அங்கீகரிக்கப்பட்டவர்கள் தரவை அணுகலாம்",
    },
    label: {
      en: "I understand that authorised people outside the research team may look at the research data, and I permit this.",
      si: "පර්යේෂණ කණ්ඩායමෙන් පිටත අනුමත පුද්ගලයින්ට මෙම දත්ත බැලීමට හැකි බවත්, ඒ සඳහා මම අවසර දෙන බවත් මම තේරුම් ගනිමි.",
      ta: "ஆராய்ச்சிக் குழுவிற்கு வெளியே அங்கீகரிக்கப்பட்ட நபர்கள் தரவைப் பார்க்க அனுமதிக்கிறேன்.",
    },
  },
  {
    id: "c4",
    required: true,
    shortLabel: {
      en: "Ethics clearance (ERC-HSS, USJ)",
      si: "සදාචාර අනුමැතිය (ERC-HSS, USJ)",
      ta: "ஒழுக்க அனுமதி (ERC-HSS, USJ)",
    },
    label: {
      en: "I understand that this project has received ethics clearance through the Ethics Review Committee for Research in Humanities and Social Sciences (ERC-HSS) of the University of Sri Jayewardenepura.",
      si: "ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලයේ මානව ශාස්ත්‍ර හා සමාජීය විද්‍යා පර්යේෂණ සඳහා වන සදාචාර සමාලෝචන කමිටුව (ERC-HSS) මඟින් මෙම ව්‍යාපෘතියට අනුමැතිය ලැබී ඇති බව මම තේරුම් ගනිමි.",
      ta: "ஸ்ரீ ஜெயவர்தனபுர பல்கலைக்கழகத்தின் ERC-HSS ஒழுக்க அனுமதி இந்த திட்டத்திற்கு கிடைத்துள்ளது என்பதை அறிவேன்.",
    },
  },
  {
    id: "c5",
    required: true,
    shortLabel: {
      en: "How my data is accessed, stored & retained",
      si: "මගේ දත්ත ප්‍රවේශය, ගබඩාව සහ රැකවරණය",
      ta: "எனது தரவின் அணுகல், சேமிப்பு & பராமரிப்பு",
    },
    label: {
      en: "I understand who will have access to my personal data, how it will be stored, and what will happen to it at the end of the project.",
      si: "මගේ පුද්ගලික දත්තවලට ප්‍රවේශ වන පුද්ගලයින්, ඒවා ගබඩා කරන ආකාරය සහ ව්‍යාපෘතිය අවසානයේ ඒවාට සිදුවන දේ මම තේරුම් ගනිමි.",
      ta: "எனது தனிப்பட்ட தரவுகளை யார் அணுகுவார்கள், எவ்வாறு சேமிக்கப்படும், திட்டம் முடிந்த பிறகு என்ன நடக்கும் என்பதை அறிவேன்.",
    },
  },
  {
    id: "c6",
    required: true,
    shortLabel: {
      en: "How findings will be written up & published",
      si: "ප්‍රතිඵල ලියා පළ කරන ආකාරය",
      ta: "முடிவுகள் எவ்வாறு எழுதப்பட்டு வெளியிடப்படும்",
    },
    label: {
      en: "I understand how this research will be written up and published.",
      si: "මෙම පර්යේෂණය ලියැවී ප්‍රකාශයට පත් කරන ආකාරය මම තේරුම් ගනිමි.",
      ta: "இந்த ஆராய்ச்சி எவ்வாறு எழுதப்பட்டு வெளியிடப்படும் என்பதை அறிவேன்.",
    },
  },
  {
    id: "c7",
    required: true,
    shortLabel: {
      en: "How to raise a concern or complaint",
      si: "අදහස් / පැමිණිලි ඉදිරිපත් කරන ආකාරය",
      ta: "கவலை / புகார் தெரிவிக்கும் முறை",
    },
    label: {
      en: "I understand how to raise a concern or make a complaint.",
      si: "අදහසක් හෝ පැමිණිල්ලක් ඉදිරිපත් කරන ආකාරය මම තේරුම් ගනිමි.",
      ta: "கவலை அல்லது புகார் தெரிவிக்கும் முறையை அறிவேன்.",
    },
  },
  {
    id: "c13",
    required: true,
    shortLabel: {
      en: "I agree to take part in this study",
      si: "මම මෙම අධ්‍යයනයට සහභාගී වීමට එකඟ වෙමි",
      ta: "இந்த ஆய்வில் பங்கேற்க ஒப்புக்கொள்கிறேன்",
    },
    label: {
      en: "I agree to take part in this study.",
      si: "මම මෙම අධ්‍යයනයට සහභාගී වීමට එකඟ වෙමි.",
      ta: "இந்த ஆய்வில் பங்கேற்க ஒப்புக்கொள்கிறேன்.",
    },
  },
  {
    id: "c_share",
    label: {
      en: "Optional: I agree that anonymized research data may be shared with researchers outside Sri Lanka for use in other research studies.",
      si: "විකල්ප: නාමයෙන් ඉවත් කළ දත්ත වෙනත් පර්යේෂණ සඳහා ශ්‍රී ලංකාවෙන් පිටත පර්යේෂකයන් සමඟ බෙදා ගැනීමට මම එකඟ වෙමි.",
      ta: "விருப்பம்: அநாமதேய தரவு ஆய்வுக்காக இலங்கைக்கு வெளியே பகிரப்படலாம் என்பதை ஏற்கிறேன்.",
    },
  },
  {
    id: "c_followup",
    label: {
      en: "Optional: I agree that my contact details may be retained securely so the researchers can contact me about future studies.",
      si: "විකල්ප: අනාගත අධ්‍යයන සඳහා මා සම්බන්ධ කරගැනීමට මගේ සම්බන්ධතා තොරතුරු ආරක්ෂිතව තබා ගැනීමට මම එකඟ වෙමි.",
      ta: "விருப்பம்: எதிர்கால ஆய்வுகளுக்காக எனது தொடர்பு விவரங்களை பாதுகாப்பாக வைத்திருக்கலாம்.",
    },
  },
];
