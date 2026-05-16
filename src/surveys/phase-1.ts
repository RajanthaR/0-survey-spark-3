import { CONSENT_ITEMS } from "./consent";
import { DOC_OPTIONS, DOC_SHARING_OPTIONS, type Survey } from "./types";

/**
 * Phase 1 — Industry Profile.
 * Mirrors `පළමු_අදියර-Industries-Sinhala_Version.md` 1:1.
 * EN drafted from the Sinhala source · SI verbatim from source · TA = TODO (falls back to EN in UI).
 */
const sec = {
  a: { en: "A. Industry profile", si: "කොටස A: කර්මාන්ත ආයතන පැතිකඩ", ta: "A. தொழில் சுயவிவரம்" },
  b: { en: "B. Socio-economic", si: "කොටස B: සමාජ-ආර්ථික අංශ", ta: "B. சமூக-பொருளாதாரம்" },
  c: { en: "C. Environmental", si: "කොටස C: පාරිසරික අංශ", ta: "C. சுற்றுச்சூழல்" },
  d: { en: "D. Industrial background", si: "කොටස D: කාර්මික පසුබිම", ta: "D. தொழில் பின்னணி" },
  e: { en: "E. Material flow analysis", si: "කොටස E: ද්‍රව්‍ය ප්‍රවාහ විශ්ලේෂණය (MFA)", ta: "E. பொருள் ஓட்ட பகுப்பாய்வு" },
  f: { en: "F. Priority comparisons (AHP, Saaty 1–9)", si: "කොටස F: බහු-නිර්ණායක තීරණ ගැනීම (Saaty 1–9)", ta: "F. முன்னுரிமை ஒப்பீடுகள் (AHP)" },
  g: { en: "G. Supporting documents", si: "කොටස G: අමතර තොරතුරු සහ ලේඛන", ta: "G. ஆதரவு ஆவணங்கள்" },
  h: { en: "H. Contact & authorization", si: "කොටස H: එකඟතාවය සහ අවසරය", ta: "H. தொடர்பு & அங்கீகாரம்" },
};

export const phase1: Survey = {
  slug: "phase-1",
  title: {
    en: "Phase 1 — Industry Profile",
    si: "ප්‍රශ්නාවලිය: පළමු අදියර — කර්මාන්ත පැතිකඩ",
    ta: "கட்டம் 1 — தொழில் சுயவிவரம்",
  },
  subtitle: {
    en: "Data collection on socio-economic, environmental and industrial background of industries in South Asia.",
    si: "දකුණු ආසියාතික රටවල සමාජ-ආර්ථික, පාරිසරික හා කාර්මික පසුබිම පිළිබඳ කර්මාන්ත ආයතනවලින් දත්ත රැස් කිරීම.",
    ta: "தென் ஆசியாவில் தொழில்களின் சமூக-பொருளாதார, சுற்றுச்சூழல் மற்றும் தொழில் பின்னணி பற்றிய தரவு.",
  },
  estimatedMinutes: 12,
  consent: CONSENT_ITEMS,
  questions: [
    // ─── A. Industry profile (Q1–6) ───
    {
      id: "p1_q1_sector", type: "single_choice", section: sec.a, required: true, allowOther: true,
      label: { en: "Industry sector", si: "කර්මාන්ත අංශය", ta: "தொழில் துறை" },
      options: [
        { value: "food", label: { en: "Food processing", si: "ආහාර සැකසුම්", ta: "உணவு பதப்படுத்துதல்" }, visual: { kind: "icon", name: "utensils" } },
        { value: "textile", label: { en: "Textile", si: "රෙදිපිළි", ta: "ஜவுளி" }, visual: { kind: "icon", name: "shirt" } },
        { value: "plastic", label: { en: "Plastics", si: "ප්ලාස්ටික්", ta: "பிளாஸ்டிக்" }, visual: { kind: "icon", name: "package" } },
        { value: "chemical", label: { en: "Chemicals", si: "රසායනික", ta: "இரசாயனம்" }, visual: { kind: "icon", name: "flask" } },
      ],
    },
    {
      id: "p1_q2_ownership", type: "single_choice", section: sec.a, required: true,
      label: { en: "Ownership type", si: "අයිතිකාරීත්ව වර්ගය", ta: "உரிமை வகை" },
      options: [
        { value: "sme", label: { en: "Small / medium enterprise (SME)", si: "සුළු/මධ්‍ය පරිමාණ ව්‍යාපාර (SME)", ta: "சிறு/நடுத்தர நிறுவனம்" }, visual: { kind: "icon", name: "store" } },
        { value: "large_local", label: { en: "Large local company", si: "විශාල දේශීය සමාගම", ta: "பெரிய உள்ளூர் நிறுவனம்" }, visual: { kind: "icon", name: "building-2" } },
        { value: "multinational", label: { en: "Multinational", si: "බහුජාතික සමාගම", ta: "பன்னாட்டு" }, visual: { kind: "icon", name: "globe" } },
        { value: "joint", label: { en: "Joint venture", si: "ඒකාබද්ධ ව්‍යාපාර", ta: "கூட்டு முயற்சி" }, visual: { kind: "icon", name: "handshake" } },
        { value: "fdi", label: { en: "Foreign investment", si: "විදේශ ආයෝජන", ta: "வெளிநாட்டு முதலீடு" }, visual: { kind: "icon", name: "banknote" } },
      ],
    },
    {
      id: "p1_q3_employees", type: "single_choice", section: sec.a, required: true,
      label: { en: "Number of employees", si: "සේවක සංඛ්‍යාව", ta: "ஊழியர் எண்ணிக்கை" },
      options: [
        { value: "<50", label: { en: "Less than 50", si: "50 ට අඩු", ta: "50க்கும் குறைவு" } },
        { value: "51-200", label: { en: "51 – 200", si: "51–200", ta: "51–200" } },
        { value: "201-500", label: { en: "201 – 500", si: "201–500", ta: "201–500" } },
        { value: ">500", label: { en: "More than 500", si: "500 ට වැඩි", ta: "500க்கு மேல்" } },
      ],
    },
    {
      id: "p1_q4_local_jobs", type: "single_choice", section: sec.a,
      label: { en: "Contribution to local employment", si: "ප්‍රදේශීය රැකියා සඳහා දායකත්වය", ta: "உள்ளூர் வேலைவாய்ப்பு பங்களிப்பு" },
      options: [
        { value: "<5", label: { en: "Less than 5%", si: "5% ට අඩු", ta: "5%க்கும் குறைவு" } },
        { value: "5-10", label: { en: "5 – 10%", si: "5–10%", ta: "5–10%" } },
        { value: "11-20", label: { en: "11 – 20%", si: "11–20%", ta: "11–20%" } },
        { value: ">20", label: { en: "More than 20%", si: "20% ට වැඩි", ta: "20%க்கு மேல்" } },
      ],
    },
    {
      id: "p1_q5_export", type: "single_choice", section: sec.a,
      label: { en: "Export orientation", si: "අපනයන දිශානතිය", ta: "ஏற்றுமதி நோக்குநிலை" },
      options: [
        { value: "local", label: { en: "Mainly local market", si: "ප්‍රධාන වශයෙන් දේශීය වෙළඳපොළ", ta: "முக்கியமாக உள்ளூர்" }, visual: { kind: "icon", name: "house" } },
        { value: "balanced", label: { en: "Local / export balanced", si: "දේශීය/අපනයන සමබර", ta: "சமநிலை" }, visual: { kind: "icon", name: "scale" } },
        { value: "export", label: { en: "Mainly export", si: "ප්‍රධාන වශයෙන් අපනයන", ta: "முக்கியமாக ஏற்றுமதி" }, visual: { kind: "icon", name: "ship" } },
      ],
    },
    {
      id: "p1_q6_country", type: "single_choice", section: sec.a, required: true,
      label: { en: "Country", si: "රට", ta: "நாடு" },
      options: [
        { value: "lk", label: { en: "Sri Lanka", si: "ශ්‍රී ලංකාව", ta: "இலங்கை" } },
        { value: "in", label: { en: "India", si: "ඉන්දියාව", ta: "இந்தியா" } },
        { value: "bd", label: { en: "Bangladesh", si: "බංග්ලාදේශය", ta: "வங்காளதேசம்" } },
        { value: "pk", label: { en: "Pakistan", si: "පාකිස්තානය", ta: "பாக்கிஸ்தான்" } },
        { value: "np", label: { en: "Nepal", si: "නේපාලය", ta: "நேபாளம்" } },
        { value: "bt", label: { en: "Bhutan", si: "භූතානය", ta: "பூட்டான்" } },
        { value: "mv", label: { en: "Maldives", si: "මාලදිවයින", ta: "மாலத்தீவு" } },
      ],
    },

    // ─── B. Socio-economic (Q7–10) ───
    {
      id: "p1_q7_employment_trend", type: "single_choice", section: sec.b,
      label: { en: "Employment trend over the past 5 years", si: "පසුගිය වසර 5 තුළ රැකියා ප්‍රවණතාවය", ta: "கடந்த 5 ஆண்டுகளில் வேலைவாய்ப்பு போக்கு" },
      options: [
        { value: "decreasing", label: { en: "Decreasing", si: "අඩුවීම", ta: "குறைவு" }, visual: { kind: "icon", name: "trending-down", tone: "negative" } },
        { value: "stable", label: { en: "Stable", si: "ස්ථාවර", ta: "நிலையானது" }, visual: { kind: "icon", name: "minus" } },
        { value: "moderate", label: { en: "Moderate growth", si: "මධ්‍යස්ථ වර්ධනය", ta: "மிதமான வளர்ச்சி" }, visual: { kind: "icon", name: "trending-up", tone: "positive" } },
        { value: "rapid", label: { en: "Rapid growth", si: "වේගවත් වර්ධනය", ta: "வேகமான வளர்ச்சி" }, visual: { kind: "icon", name: "rocket", tone: "positive" } },
      ],
    },
    {
      id: "p1_q8_training", type: "single_choice", section: sec.b,
      label: { en: "Skills and training opportunities provided to staff", si: "සේවකයන්ට ලබාදෙන කුසලතා හා පුහුණු අවස්ථා", ta: "ஊழியர்களுக்கு வழங்கப்படும் பயிற்சி" },
      options: [
        { value: "none", label: { en: "None", si: "නොමැත", ta: "இல்லை" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "limited", label: { en: "Limited", si: "සීමිත", ta: "வரம்பு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "moderate", label: { en: "Moderate", si: "මධ්‍යස්ථ", ta: "மிதமான" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "extensive", label: { en: "Extensive", si: "විශාල වශයෙන්", ta: "விரிவான" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },
    {
      id: "p1_q9_community", type: "single_choice", section: sec.b,
      label: { en: "Community engagement (CSR, awareness, local partnerships)", si: "ප්‍රජා සම්බන්ධතා කටයුතු (CSR, දැනුවත් කිරීම, දේශීය හවුල්කාරීත්වය)", ta: "சமூக ஈடுபாடு (CSR)" },
      options: [
        { value: "none", label: { en: "None", si: "නොමැත", ta: "இல்லை" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "low", label: { en: "Low", si: "අඩු", ta: "குறைவு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "moderate", label: { en: "Moderate", si: "මධ්‍යස්ථ", ta: "மிதமான" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "high", label: { en: "High", si: "ඉහළ", ta: "உயர்வு" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },
    {
      id: "p1_q10_community_support", type: "single_choice", section: sec.b,
      label: { en: "Community support for your industry", si: "ඔබගේ කර්මාන්තය සඳහා ප්‍රජා සහයෝගය", ta: "உங்கள் தொழிலுக்கு சமூக ஆதரவு" },
      options: [
        { value: "very_low", label: { en: "Very low", si: "ඉතා අඩු", ta: "மிகக் குறைவு" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "low", label: { en: "Low", si: "අඩු", ta: "குறைவு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "moderate", label: { en: "Moderate", si: "මධ්‍යස්ථ", ta: "மிதமான" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "high", label: { en: "High", si: "ඉහළ", ta: "உயர்வு" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },

    // ─── C. Environmental (Q11–15) ───
    {
      id: "p1_q11_certs", type: "multi_choice", section: sec.c, allowOther: true,
      label: { en: "Environmental certifications", si: "පාරිසරික සහතික", ta: "சுற்றுச்சூழல் சான்றிதழ்கள்" },
      options: [
        { value: "iso14001", label: { en: "ISO 14001", si: "ISO 14001", ta: "ISO 14001" }, visual: { kind: "icon", name: "award", tone: "positive" } },
        { value: "none", label: { en: "None", si: "නොමැත", ta: "இல்லை" }, visual: { kind: "icon", name: "ban" } },
      ],
    },
    {
      id: "p1_q12_practices", type: "multi_choice", section: sec.c,
      label: { en: "Sustainability practices currently in place (select all that apply)", si: "දැනට ක්‍රියාත්මක තිරසාර ක්‍රියාමාර්ග (අදාළ සියල්ල සලකුණු කරන්න)", ta: "தற்போதைய நிலையான நடைமுறைகள்" },
      options: [
        { value: "cleaner", label: { en: "Cleaner production", si: "Cleaner Production", ta: "தூய்மையான உற்பத்தி" }, visual: { kind: "icon", name: "sparkles" } },
        { value: "energy_eff", label: { en: "Energy efficiency", si: "බලශක්ති කාර්යක්ෂමතාව", ta: "ஆற்றல் திறன்" }, visual: { kind: "icon", name: "zap" } },
        { value: "wastewater", label: { en: "Wastewater treatment / reuse", si: "අපජල පිරිපහදු/නැවත භාවිතය", ta: "கழிவு நீர் சுத்திகரிப்பு" }, visual: { kind: "icon", name: "droplets" } },
        { value: "renewables", label: { en: "Renewable energy use", si: "නවීකරණශීලී බලශක්ති භාවිතය", ta: "புதுப்பிக்கத்தக்க ஆற்றல்" }, visual: { kind: "icon", name: "sun" } },
        { value: "circular", label: { en: "Circular-economy practices", si: "චක්‍රීය ආර්ථික ක්‍රමවේද", ta: "வட்டப் பொருளாதாரம்" }, visual: { kind: "icon", name: "recycle" } },
      ],
    },
    {
      id: "p1_q13_air", type: "single_choice", section: sec.c,
      label: { en: "Air emissions vs regulatory limits", si: "වායු විමෝචන නියාමන සීමාවන්ට සාපේක්ෂව", ta: "காற்று உமிழ்வுகள் vs வரம்புகள்" },
      options: [
        { value: "below", label: { en: "Below the limit", si: "සීමාවට පහළ", ta: "வரம்புக்குக் கீழே" }, visual: { kind: "icon", name: "shield-check", tone: "positive" } },
        { value: "near", label: { en: "Close to the limit", si: "සීමාවට ආසන්න", ta: "வரம்புக்கு அருகில்" }, visual: { kind: "icon", name: "shield-alert" } },
        { value: "exceed", label: { en: "Exceeds the limit", si: "සීමාව ඉක්මවා ඇත", ta: "வரம்பை மீறுகிறது" }, visual: { kind: "icon", name: "shield-x", tone: "negative" } },
      ],
    },
    {
      id: "p1_q14_wastewater", type: "single_choice", section: sec.c,
      label: { en: "Wastewater discharge compliance", si: "අපජල මුදාහැරීමේ අනුකූලතාව", ta: "கழிவு நீர் இணக்கம்" },
      options: [
        { value: "full", label: { en: "Fully compliant", si: "සම්පූර්ණයෙන් අනුකූල", ta: "முழுமையாக இணக்கம்" }, visual: { kind: "icon", name: "shield-check", tone: "positive" } },
        { value: "partial", label: { en: "Partially compliant", si: "අර්ධ වශයෙන් අනුකූල", ta: "பகுதி இணக்கம்" }, visual: { kind: "icon", name: "shield-alert" } },
        { value: "none", label: { en: "Non-compliant", si: "අනුකූල නොවේ", ta: "இணக்கமற்றது" }, visual: { kind: "icon", name: "shield-x", tone: "negative" } },
      ],
    },
    {
      id: "p1_q15_challenges", type: "multi_choice", section: sec.c,
      label: { en: "Main environmental challenges", si: "ප්‍රධාන පාරිසරික අභියෝග", ta: "முக்கிய சுற்றுச்சூழல் சவால்கள்" },
      options: [
        { value: "air", label: { en: "Air pollution", si: "වායු දූෂණය", ta: "காற்று மாசு" }, visual: { kind: "icon", name: "wind" } },
        { value: "water", label: { en: "Water pollution", si: "ජල දූෂණය", ta: "நீர் மாசு" }, visual: { kind: "icon", name: "droplets" } },
        { value: "solid", label: { en: "Solid waste", si: "ඝන අපද්‍රව්‍ය", ta: "திட கழிவு" }, visual: { kind: "icon", name: "trash" } },
        { value: "energy", label: { en: "Energy inefficiency", si: "බලශක්ති අකාර්යක්ෂමතාව", ta: "ஆற்றல் திறனின்மை" }, visual: { kind: "icon", name: "battery-low" } },
      ],
    },

    // ─── D. Industrial background (Q16–19) ───
    {
      id: "p1_q16_proximity", type: "single_choice", section: sec.d,
      label: { en: "Proximity to other industries in your field", si: "ඔබේ ක්ෂේත්‍රයේ අනෙකුත් කර්මාන්ත වලට ආසන්නතාවය", ta: "மற்ற தொழில்களின் அருகாமை" },
      options: [
        { value: "isolated", label: { en: "Isolated", si: "හුදකලා", ta: "தனிமை" } },
        { value: "few", label: { en: "A few nearby", si: "කිහිපයක්", ta: "சில" } },
        { value: "medium", label: { en: "Medium cluster", si: "මධ්‍යම කණ්ඩායම", ta: "நடுத்தர கொத்து" } },
        { value: "dense", label: { en: "Dense cluster", si: "ඝන කණ්ඩායම", ta: "அடர்த்தியான கொத்து" } },
      ],
    },
    {
      id: "p1_q17_collab", type: "single_choice", section: sec.d,
      label: { en: "Level of cooperation with neighbouring industries", si: "අසල්වැසි කර්මාන්ත සමඟ සහයෝගීතාව මට්ටම", ta: "அண்டை தொழில்களுடன் ஒத்துழைப்பு" },
      options: [
        { value: "none", label: { en: "None", si: "නොමැත", ta: "இல்லை" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "limited", label: { en: "Limited", si: "සීමිත", ta: "வரம்பு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "moderate", label: { en: "Moderate", si: "මධ්‍යස්ථ", ta: "மிதமான" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "high", label: { en: "High", si: "ඉහළ", ta: "உயர்வு" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },
    {
      id: "p1_q18_shared_infra", type: "single_choice", section: sec.d,
      label: { en: "Access to shared infrastructure", si: "හවුල් යටිතල පහසුකම් වෙත ප්‍රවේශය", ta: "பகிரப்பட்ட உள்கட்டமைப்பு" },
      options: [
        { value: "none", label: { en: "None", si: "නොමැත", ta: "இல்லை" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "limited", label: { en: "Limited", si: "සීමිත", ta: "வரம்பு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "adequate", label: { en: "Adequate", si: "ප්‍රමාණවත්", ta: "போதுமான" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "strong", label: { en: "Strong", si: "ශක්තිමත්", ta: "வலுவான" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },
    {
      id: "p1_q19_innovation", type: "single_choice", section: sec.d,
      label: { en: "Innovation and technology adoption", si: "නවෝත්පාදන හා තාක්ෂණ භාවිතය", ta: "கண்டுபிடிப்பு & தொழில்நுட்பம்" },
      options: [
        { value: "very_low", label: { en: "Very low", si: "ඉතා අඩු", ta: "மிகக் குறைவு" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "low", label: { en: "Low", si: "අඩු", ta: "குறைவு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "moderate", label: { en: "Moderate", si: "මධ්‍යස්ථ", ta: "மிதமான" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "high", label: { en: "High", si: "ඉහළ", ta: "உயர்வு" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },

    // ─── E. MFA (Q20–27) ───
    {
      id: "p1_q20_raw_input", type: "single_choice", section: sec.e,
      label: { en: "Raw material inputs (tons / year)", si: "අමුද්‍රව්‍ය ආදාන (ටොන්/වසර)", ta: "மூலப்பொருள் (டன்/ஆண்டு)" },
      options: [
        { value: "<100", label: { en: "< 100", si: "< 100", ta: "< 100" } },
        { value: "100-500", label: { en: "100 – 500", si: "100–500", ta: "100–500" } },
        { value: "501-1000", label: { en: "501 – 1,000", si: "501–1000", ta: "501–1000" } },
        { value: ">1000", label: { en: "> 1,000", si: "> 1000", ta: "> 1000" } },
      ],
    },
    {
      id: "p1_q21_raw_source", type: "single_choice", section: sec.e,
      label: { en: "Raw material source", si: "අමුද්‍රව්‍ය මූලාශ්‍රය", ta: "மூலப்பொருள் மூலம்" },
      options: [
        { value: "local", label: { en: "Mainly local", si: "Mainly Local", ta: "முக்கியமாக உள்ளூர்" }, visual: { kind: "icon", name: "house" } },
        { value: "imported", label: { en: "Mainly imported", si: "Mainly Imported", ta: "முக்கியமாக இறக்குமதி" }, visual: { kind: "icon", name: "ship" } },
        { value: "balanced", label: { en: "Balanced (local + imported)", si: "Balanced (Local + Imported)", ta: "சமநிலை" }, visual: { kind: "icon", name: "scale" } },
      ],
    },
    {
      id: "p1_q22_energy", type: "single_choice", section: sec.e,
      label: { en: "Energy consumption (kWh / year)", si: "බලශක්ති පරිභෝජනය (Kwh/year)", ta: "ஆற்றல் நுகர்வு (kWh/ஆண்டு)" },
      options: [
        { value: "<100mwh", label: { en: "< 100 MWh", si: "< 100 MWh", ta: "< 100 MWh" } },
        { value: "100-500mwh", label: { en: "100 – 500 MWh", si: "100–500 MWh", ta: "100–500 MWh" } },
        { value: "501-1000mwh", label: { en: "501 – 1,000 MWh", si: "501–1000 MWh", ta: "501–1000 MWh" } },
        { value: ">1000mwh", label: { en: "> 1,000 MWh", si: "> 1000 MWh", ta: "> 1000 MWh" } },
      ],
    },
    {
      id: "p1_q23_re_share", type: "single_choice", section: sec.e,
      label: { en: "Renewable energy share", si: "නවීකරණශීලී බලශක්ති ප්‍රමාණය", ta: "புதுப்பிக்கத்தக்க ஆற்றல் பங்கு" },
      options: [
        { value: "0", label: { en: "0%", si: "0%", ta: "0%" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "<25", label: { en: "< 25%", si: "< 25%", ta: "< 25%" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "25-50", label: { en: "25 – 50%", si: "25–50%", ta: "25–50%" }, visual: { kind: "icon", name: "signal-2" } },
        { value: ">50", label: { en: "> 50%", si: "> 50%", ta: "> 50%" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },
    {
      id: "p1_q24_water", type: "single_choice", section: sec.e,
      label: { en: "Water consumption (m³ / year)", si: "ජල පරිභෝජනය (m³/year)", ta: "நீர் நுகர்வு (m³/ஆண்டு)" },
      options: [
        { value: "<1000", label: { en: "< 1,000", si: "< 1,000", ta: "< 1,000" } },
        { value: "1000-10000", label: { en: "1,000 – 10,000", si: "1,000–10,000", ta: "1,000–10,000" } },
        { value: "10001-50000", label: { en: "10,001 – 50,000", si: "10,001–50,000", ta: "10,001–50,000" } },
        { value: ">50000", label: { en: "> 50,000", si: "> 50,000", ta: "> 50,000" } },
      ],
    },
    {
      id: "p1_q25_water_recycle", type: "single_choice", section: sec.e,
      label: { en: "Water recycling rate", si: "ජල ප්‍රතිචක්‍රීකරණය", ta: "நீர் மறுசுழற்சி" },
      options: [
        { value: "none", label: { en: "None", si: "None", ta: "இல்லை" }, visual: { kind: "icon", name: "signal-0" } },
        { value: "<25", label: { en: "< 25%", si: "< 25%", ta: "< 25%" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "25-50", label: { en: "25 – 50%", si: "25–50%", ta: "25–50%" }, visual: { kind: "icon", name: "signal-2" } },
        { value: ">50", label: { en: "> 50%", si: "> 50%", ta: "> 50%" }, visual: { kind: "icon", name: "signal-3" } },
      ],
    },
    {
      id: "p1_q26_waste", type: "single_choice", section: sec.e,
      label: { en: "Waste / by-products (tons / year)", si: "අපද්‍රව්‍ය/අතුරු නිෂ්පාදන (ටොන්/වසර)", ta: "கழிவு / துணை-தயாரிப்பு (டன்/ஆண்டு)" },
      options: [
        { value: "<100", label: { en: "< 100", si: "< 100", ta: "< 100" } },
        { value: "100-500", label: { en: "100 – 500", si: "100–500", ta: "100–500" } },
        { value: "501-1000", label: { en: "501 – 1,000", si: "501–1000", ta: "501–1000" } },
        { value: ">1000", label: { en: "> 1,000", si: "> 1000", ta: "> 1000" } },
      ],
    },
    {
      id: "p1_q27_reuse", type: "single_choice", section: sec.e,
      label: { en: "Reuse potential of waste / by-products by other industries", si: "අපද්‍රව්‍ය/අතුරු නිෂ්පාදන වෙනත් කර්මාන්ත සඳහා නැවත භාවිත හැකියාව", ta: "மறுபயன்பாட்டு திறன்" },
      options: [
        { value: "high", label: { en: "High", si: "High", ta: "உயர்" }, visual: { kind: "icon", name: "signal-3" } },
        { value: "medium", label: { en: "Medium", si: "Medium", ta: "நடுத்தர" }, visual: { kind: "icon", name: "signal-2" } },
        { value: "low", label: { en: "Low", si: "Low", ta: "குறைவு" }, visual: { kind: "icon", name: "signal-1" } },
        { value: "none", label: { en: "None", si: "None", ta: "இல்லை" }, visual: { kind: "icon", name: "signal-0" } },
      ],
    },

    // ─── F. AHP (Saaty 1–9) ───
    {
      id: "p1_q28_ahp", type: "pairwise_saaty", section: sec.f,
      label: {
        en: "For each pair, choose the more important factor and rate the strength (1 = equal, 3 = moderate, 5 = strong, 7 = very strong, 9 = extreme).",
        si: "සෑම යුගලයක් සඳහාම වඩා වැදගත් සාධකය තෝරා ලකුණු දෙන්න (1 = සමාන, 9 = අතිශය වැඩි).",
        ta: "ஒவ்வொரு ஜோடிக்கும் முக்கியமான காரணியைத் தேர்ந்தெடுத்து மதிப்பிடுங்கள் (1 = சமம், 9 = மிக அதிகம்).",
      },
      criteria: [
        { key: "A", label: { en: "Raw-material availability", si: "අමුද්‍රව්‍ය ලැබීමේ හැකියාව", ta: "மூலப்பொருள் கிடைப்பு" } },
        { key: "B", label: { en: "Waste generation & reuse potential", si: "අපද්‍රව්‍ය ජනනය සහ නැවත භාවිත හැකියාව", ta: "கழிவு உருவாக்கம் & மறுபயன்பாடு" } },
        { key: "C", label: { en: "Infrastructure readiness", si: "යටිතල පහසුකම් සූදානම", ta: "உள்கட்டமைப்பு" } },
        { key: "D", label: { en: "Market proximity", si: "වෙළඳපොළට ආසන්නතාවය", ta: "சந்தை அருகாமை" } },
        { key: "E", label: { en: "Policy & regulatory support", si: "ප්‍රතිපත්ති සහ නියාමන සහාය", ta: "கொள்கை ஆதரவு" } },
        { key: "F", label: { en: "Site environmental sensitivity", si: "භූමියේ පාරිසරික සංවේදීතාවය", ta: "சுற்றுச்சூழல் உணர்திறன்" } },
        { key: "G", label: { en: "Socio-economic contribution", si: "සමාජ-ආර්ථික දායකත්වය", ta: "சமூக-பொருளாதார பங்களிப்பு" } },
      ],
    },

    // ─── G. Documents ───
    {
      id: "p1_g_docs", type: "multi_choice", section: sec.g, allowOther: true,
      label: { en: "Supporting documents you can share", si: "ඔබට ලබාදිය හැකි අමතර ලේඛන", ta: "பகிரக்கூடிய ஆவணங்கள்" },
      options: DOC_OPTIONS,
    },
    {
      id: "p1_g_doc_sharing", type: "single_choice", section: sec.g,
      label: { en: "Are you willing to provide copies of relevant documents?", si: "අදාල ලේඛන පිටපත් ලබාදීමට ඔබ කැමතිද?", ta: "ஆவணங்களின் நகல்களை வழங்க தயாரா?" },
      options: DOC_SHARING_OPTIONS,
    },

    // ─── H. Contact + authorization ───
    { id: "p1_h_contact_primary_name", type: "text", section: sec.h, label: { en: "Primary contact — name", si: "ප්‍රධාන සම්බන්ධීකරණ පුද්ගලයා — නම", ta: "முதன்மை தொடர்பு — பெயர்" } },
    { id: "p1_h_contact_primary_role", type: "text", section: sec.h, label: { en: "Primary contact — title / role", si: "ප්‍රධාන සම්බන්ධීකරණ පුද්ගලයා — තනතුර", ta: "பதவி" } },
    { id: "p1_h_contact_primary_email", type: "email", section: sec.h, label: { en: "Primary contact — email", si: "ප්‍රධාන සම්බන්ධීකරණ පුද්ගලයා — විද්‍යුත් තැපෑල", ta: "மின்னஞ்சல்" } },
    { id: "p1_h_contact_primary_phone", type: "tel", section: sec.h, label: { en: "Primary contact — phone", si: "ප්‍රධාන සම්බන්ධීකරණ පුද්ගලයා — දුරකථන", ta: "தொலைபேசி" } },
    { id: "p1_h_contact_primary_linkedin", type: "text", section: sec.h, label: { en: "Primary contact — LinkedIn (optional)", si: "ප්‍රධාන සම්බන්ධීකරණ පුද්ගලයා — LinkedIn", ta: "LinkedIn" } },
    { id: "p1_h_contact_alt_name", type: "text", section: sec.h, label: { en: "Alternate contact — name (optional)", si: "විකල්ප සම්බන්ධීකරණ පුද්ගලයා — නම", ta: "மாற்று தொடர்பு — பெயர்" } },
    { id: "p1_h_contact_alt_email", type: "email", section: sec.h, label: { en: "Alternate contact — email (optional)", si: "විකල්ප සම්බන්ධීකරණ පුද්ගලයා — විද්‍යුත් තැපෑල", ta: "மாற்று மின்னஞ்சல்" } },
    {
      id: "p1_h_data_use", type: "multi_choice", section: sec.h,
      label: { en: "I agree to the following uses of the data", si: "දත්ත භාවිතය සඳහා එකඟතාවය", ta: "தரவு பயன்பாட்டு ஒப்புதல்" },
      options: [
        { value: "research", label: { en: "Use of this information for research purposes", si: "මෙම තොරතුරු අධ්‍යයන කටයුතු සඳහා භාවිතා කිරීමට", ta: "ஆராய்ச்சிக்கு பயன்படுத்த" }, visual: { kind: "icon", name: "microscope" } },
        { value: "publish_named", label: { en: "Publish aggregated results (organisation may be named)", si: "එකතු කළ ප්‍රතිඵල ප්‍රකාශයට පත් කිරීමට (ආයතන නාමය සඳහන් කළ හැක)", ta: "பெயருடன் வெளியிடுதல்" }, visual: { kind: "icon", name: "megaphone" } },
        { value: "publish_anon", label: { en: "Publish aggregated results (organisation kept confidential)", si: "එකතු කළ ප්‍රතිඵල ප්‍රකාශයට පත් කිරීමට (ආයතන නාමය රහස්‍යව තබා)", ta: "பெயரிடாது வெளியிடுதல்" }, visual: { kind: "icon", name: "eye-off" } },
        { value: "followup", label: { en: "Follow-up / clarification contacts if needed", si: "අවශ්‍ය නම් පසු විමසීම් / පැහැදිලි කිරීම් සඳහා", ta: "தொடர் தொடர்பு" }, visual: { kind: "icon", name: "phone-call" } },
        { value: "share_results", label: { en: "Share research results with our organisation", si: "අපගේ ආයතනය සමඟ පර්යේෂණ ප්‍රතිඵල බෙදා ගැනීමට", ta: "முடிவுகளைப் பகிர்தல்" }, visual: { kind: "icon", name: "share" } },
      ],
    },
    {
      id: "p1_h_authorization", type: "yes_no", section: sec.h, required: true,
      label: {
        en: "I confirm that I am authorised to provide this information on behalf of my organisation, that the information is accurate to the best of my knowledge, and that it will be used for academic research.",
        si: "මෙම තොරතුරු මගේ ආයතනය වෙනුවෙන් ලබාදීමට මට අවසර ඇති බවත්, ලබාදුන් තොරතුරු නිවැරදි බවත්, ඒවා අධ්‍යයන කටයුතු සඳහා භාවිතා වන බවත් මම තහවුරු කරමි.",
        ta: "எனது நிறுவனத்தின் சார்பாக இந்த தகவலை வழங்க அங்கீகாரம் பெற்றுள்ளேன் என்பதை உறுதிப்படுத்துகிறேன்.",
      },
    },
  ],
};
