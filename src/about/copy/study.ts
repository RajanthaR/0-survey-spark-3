import type { LocalizedString } from "@/lib/i18n";

type CompleteLocalizedString = Required<LocalizedString>;

export const ABOUT_STUDY_COPY_KEYS = [
  "pageTitle",
  "pageSubtitle",
  "pageDescription",
  "whatItIsHeading",
  "whatItIsBody",
  "eligibilityHeading",
  "eligibilityBody",
  "tasksHeading",
  "tasksBody",
  "privacyHeading",
  "privacyBody",
  "privacyConsentLink",
  "contactHeading",
  "contactBody",
  "contactName",
  "contactEmail",
  "footerTakeSurvey",
  "footerForResearchers",
  "footerForEngineers",
  "footerEnglishOnlyNote",
  "consentHeading",
  "consentIntro",
  "requiredLabel",
  "optionalLabel",
] as const;

export type AboutStudyCopyKey = (typeof ABOUT_STUDY_COPY_KEYS)[number];

// SI/TA strings are AI-drafted for implementation; human review is required before merge.
export const ABOUT_STUDY = {
  pageTitle: {
    en: "About this research",
    si: "මෙම පර්යේෂණය ගැන",
    ta: "இந்த ஆராய்ச்சி பற்றி",
  },
  pageSubtitle: {
    en: "A University of Sri Jayewardenepura research survey about Eco-Industrial Park development in Sri Lanka and South Asia.",
    si: "ශ්‍රී ජයවර්ධනපුර විශ්වවිද්‍යාලයේ, ශ්‍රී ලංකාව සහ දකුණු ආසියාවේ පරිසර හිතකාමී කාර්මික උද්‍යාන සංවර්ධනය පිළිබඳ පර්යේෂණ සමීක්ෂණයකි.",
    ta: "இலங்கை மற்றும் தென் ஆசியாவில் சூழல் நட்பு தொழில் பூங்கா வளர்ச்சியைப் பற்றிய ஸ்ரீ ஜயவர்த்தனபுர பல்கலைக்கழக ஆராய்ச்சி கணக்கெடுப்பு.",
  },
  pageDescription: {
    en: "Learn what the EIP Insight study asks, who can participate, how privacy is handled, and how to contact the research team.",
    si: "EIP Insight අධ්‍යයනයේ අරමුණ, සහභාගී විය හැක්කේ කවුද, පෞද්ගලිකත්වය සුරකින ආකාරය සහ සම්බන්ධ විය හැකි ආකාරය දැනගන්න.",
    ta: "EIP Insight ஆய்வு என்ன கேட்கிறது, யார் பங்கேற்கலாம், தனியுரிமை எப்படி காக்கப்படுகிறது, ஆராய்ச்சி குழுவை எவ்வாறு தொடர்பு கொள்வது என்பதை அறியுங்கள்.",
  },
  whatItIsHeading: {
    en: "What this study is",
    si: "මෙම අධ්‍යයනය කුමක්ද",
    ta: "இந்த ஆய்வு என்ன",
  },
  whatItIsBody: {
    en: "This study gathers practical evidence for an Eco-Industrial Park model for Sri Lanka and the wider South Asian region. The current surveys include Phase 1, which asks about industry profiles, and Phase 3, which asks about renewable energy, circular economy, industrial symbiosis, and stakeholder views.",
    si: "මෙම අධ්‍යයනය ශ්‍රී ලංකාව සහ දකුණු ආසියාව සඳහා පරිසර හිතකාමී කාර්මික උද්‍යාන ආකෘතියක් සැකසීමට ප්‍රායෝගික සාක්ෂි රැස් කරයි. වත්මන් සමීක්ෂණවලට කර්මාන්ත පැතිකඩ ගැන අසන පළමු අදියර සහ පුනර්ජනනීය බලශක්තිය, චක්‍රීය ආර්ථිකය, කාර්මික සහජීවනය සහ පාර්ශ්වකරුවන්ගේ අදහස් ගැන අසන තෙවන අදියර ඇතුළත් වේ.",
    ta: "இந்த ஆய்வு இலங்கை மற்றும் தென் ஆசியாவுக்கான சூழல் நட்பு தொழில் பூங்கா மாதிரிக்குத் தேவையான நடைமுறை ஆதாரங்களை சேகரிக்கிறது. தற்போது உள்ள கணக்கெடுப்புகளில் தொழில் சுயவிவரத்தை கேட்கும் கட்டம் 1 மற்றும் புதுப்பிக்கத்தக்க ஆற்றல், சுற்றுச்சூழல் பொருளாதாரம், தொழில் கூட்டுச் செயல்பாடு, பங்குதாரர் கருத்துகள் ஆகியவற்றைக் கேட்கும் கட்டம் 3 அடங்கும்.",
  },
  eligibilityHeading: {
    en: "Who can take part",
    si: "සහභාගී විය හැක්කේ කවුද",
    ta: "யார் பங்கேற்கலாம்",
  },
  eligibilityBody: {
    en: "People from relevant industries, agencies, and stakeholder groups can take part if the questions match their work or knowledge. Participation is voluntary, and you may stop at any time.",
    si: "අදාළ කර්මාන්ත, ආයතන සහ පාර්ශ්වකරු කණ්ඩායම්වල පුද්ගලයන්ට, ප්‍රශ්න ඔවුන්ගේ වැඩ හෝ දැනුමට අදාළ නම්, සහභාගී විය හැක. සහභාගී වීම ස්වේච්ඡා වන අතර ඔබට ඕනෑම වේලාවක නතර විය හැක.",
    ta: "கேள்விகள் உங்கள் வேலை அல்லது அறிவுடன் தொடர்புடையதாக இருந்தால், பொருத்தமான தொழில்கள், நிறுவனங்கள் மற்றும் பங்குதாரர் குழுக்களிலிருந்து வரும் நபர்கள் பங்கேற்கலாம். பங்கேற்பது விருப்பமானது; எந்த நேரத்திலும் நிறுத்தலாம்.",
  },
  tasksHeading: {
    en: "What you'll be asked",
    si: "ඔබගෙන් අසනු ලබන්නේ කුමක්ද",
    ta: "உங்களிடம் என்ன கேட்கப்படும்",
  },
  tasksBody: {
    en: "You will answer questions about your organisation, resource use, environmental practices, and views on Eco-Industrial Park opportunities. Most people spend about 12 to 18 minutes on a phase, depending on the survey selected.",
    si: "ඔබගේ ආයතනය, සම්පත් භාවිතය, පාරිසරික ක්‍රියාමාර්ග සහ පරිසර හිතකාමී කාර්මික උද්‍යාන අවස්ථා පිළිබඳ අදහස් ගැන ඔබගෙන් ප්‍රශ්න අසනු ලැබේ. තෝරාගත් සමීක්ෂණය අනුව බොහෝ දෙනා අදියරකට මිනිත්තු 12 සිට 18ක් පමණ ගත කරයි.",
    ta: "உங்கள் நிறுவனம், வள பயன்பாடு, சுற்றுச்சூழல் நடைமுறைகள் மற்றும் சூழல் நட்பு தொழில் பூங்கா வாய்ப்புகள் பற்றிய கருத்துகள் குறித்து கேள்விகள் கேட்கப்படும். தேர்ந்தெடுக்கப்பட்ட கணக்கெடுப்பைப் பொறுத்து, ஒரு கட்டத்திற்கு பெரும்பாலோர் சுமார் 12 முதல் 18 நிமிடங்கள் செலவிடுகிறார்கள்.",
  },
  privacyHeading: {
    en: "Privacy",
    si: "පෞද්ගලිකත්වය",
    ta: "தனியுரிமை",
  },
  privacyBody: {
    en: "Your survey response is anonymous unless you choose to leave contact details. Responses are stored securely in the project database and used for research reporting. Resume links work for up to 30 days; after that, unfinished responses expire. The consent text below gives the full terms.",
    si: "ඔබ සම්බන්ධතා විස්තර තබා යාමට තෝරා නොගන්නේ නම් ඔබගේ සමීක්ෂණ ප්‍රතිචාරය නාමරහිත වේ. ප්‍රතිචාර ව්‍යාපෘති දත්තගබඩාවේ ආරක්ෂිතව ගබඩා කර පර්යේෂණ වාර්තාකරණය සඳහා භාවිතා කරයි. නැවත ආරම්භ කිරීමේ සබැඳි දින 30ක් දක්වා ක්‍රියා කරයි; ඉන් පසු අවසන් නොකළ ප්‍රතිචාර කල් ඉකුත් වේ. පහත එකඟතා පෙළ සම්පූර්ණ කොන්දේසි ලබා දෙයි.",
    ta: "நீங்கள் தொடர்பு விவரங்களை விடத் தேர்வு செய்யாவிட்டால், உங்கள் கணக்கெடுப்பு பதில் பெயரில்லாததாக இருக்கும். பதில்கள் திட்ட தரவுத்தளத்தில் பாதுகாப்பாக சேமிக்கப்பட்டு ஆராய்ச்சி அறிக்கைகளுக்குப் பயன்படுத்தப்படும். மீண்டும் தொடங்கும் இணைப்புகள் 30 நாட்கள் வரை செயல்படும்; அதன் பிறகு முடிக்கப்படாத பதில்கள் காலாவதியாகும். கீழே உள்ள ஒப்புதல் உரை முழு விதிமுறைகளைக் கூறுகிறது.",
  },
  privacyConsentLink: {
    en: "Read the consent text",
    si: "එකඟතා පෙළ කියවන්න",
    ta: "ஒப்புதல் உரையைப் படிக்கவும்",
  },
  contactHeading: {
    en: "Contact",
    si: "සම්බන්ධ වන්න",
    ta: "தொடர்பு",
  },
  contactBody: {
    en: "Questions about the website or this respondent guide can be sent to:",
    si: "වෙබ් අඩවිය හෝ මෙම සහභාගී වන්නන් සඳහා මඟපෙන්වීම පිළිබඳ ප්‍රශ්න යැවිය හැක්කේ:",
    ta: "இந்த இணையதளம் அல்லது பங்கேற்பாளர் வழிகாட்டி பற்றிய கேள்விகளை இங்கே அனுப்பலாம்:",
  },
  contactName: {
    en: "Rajantha R Ambegala",
    si: "Rajantha R Ambegala",
    ta: "Rajantha R Ambegala",
  },
  contactEmail: {
    en: "rajantha.rc@gmail.com",
    si: "rajantha.rc@gmail.com",
    ta: "rajantha.rc@gmail.com",
  },
  footerTakeSurvey: {
    en: "Take the survey",
    si: "සමීක්ෂණයට යන්න",
    ta: "கணக்கெடுப்பை தொடங்கவும்",
  },
  footerForResearchers: {
    en: "For researchers",
    si: "For researchers",
    ta: "For researchers",
  },
  footerForEngineers: {
    en: "For engineers",
    si: "For engineers",
    ta: "For engineers",
  },
  footerEnglishOnlyNote: {
    en: "English only",
    si: "ඉංග්‍රීසි පමණි",
    ta: "ஆங்கிலம் மட்டும்",
  },
  consentHeading: {
    en: "Consent text",
    si: "එකඟතා පෙළ",
    ta: "ஒப்புதல் உரை",
  },
  consentIntro: {
    en: "This section is rendered from the same consent items used before the survey begins, so the wording stays aligned with the canonical consent source.",
    si: "මෙම කොටස සමීක්ෂණය ආරම්භ වීමට පෙර භාවිතා කරන එකම එකඟතා අයිතමවලින් පෙන්වයි. එබැවින් වචන canonical එකඟතා මූලාශ්‍රයට ගැළපේ.",
    ta: "இந்த பகுதி கணக்கெடுப்பு தொடங்கும் முன் பயன்படுத்தப்படும் அதே ஒப்புதல் உருப்படிகளிலிருந்து காட்டப்படுகிறது. எனவே சொற்கள் canonical ஒப்புதல் மூலத்துடன் பொருந்தும்.",
  },
  requiredLabel: {
    en: "Required",
    si: "අනිවාර්යයි",
    ta: "கட்டாயம்",
  },
  optionalLabel: {
    en: "Optional",
    si: "විකල්ප",
    ta: "விருப்பம்",
  },
} satisfies Record<AboutStudyCopyKey, CompleteLocalizedString>;
