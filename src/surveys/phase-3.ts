import { CONSENT_ITEMS } from "./consent";
import { DOC_OPTIONS, DOC_SHARING_OPTIONS, LIKERT_5, MONTHS_12, type Survey } from "./types";

/**
 * Phase 3 — Detailed RE / CE / IS / TBL survey.
 * Mirrors `Phase_3_Questionnaire_අදියර_3-Industries-PhD.md` 1:1.
 * EN drafted from the Sinhala source · SI verbatim from source · Tamil strings populated;
 * independent reviewer attribution pending.
 */
const sec = {
  resp: { en: "Respondent information", si: "ප්‍රතිචාරක තොරතුරු", ta: "பதிலளிப்பவர் தகவல்" },
  a: {
    en: "A. General & geographical data",
    si: "කොටස A – සාමාන්‍ය හා භූගෝලීය දත්ත",
    ta: "A. பொது & புவியியல்",
  },
  b: {
    en: "B. Renewable energy (RE)",
    si: "කොටස B – නවීකරණශීලී බලශක්ති (RE) භාවිතය",
    ta: "B. புதுப்பிக்கத்தக்க ஆற்றல்",
  },
  c: {
    en: "C. Circular economy (CE)",
    si: "කොටස C – චක්‍රීය ආර්ථිකය (CE)",
    ta: "C. வட்டப் பொருளாதாரம்",
  },
  d: {
    en: "D. Industrial symbiosis (IS)",
    si: "කොටස D – කාර්මික සම්බන්ධතා (IS)",
    ta: "D. தொழில் கூட்டுயிர்வாழ்வு",
  },
  e: {
    en: "E. Triple bottom line (TBL)",
    si: "කොටස E – ත්‍රිත්ව පහළ රේඛාව (TBL)",
    ta: "E. முப்பரிமாண தாக்கம்",
  },
  f: { en: "F. Enablers & support", si: "කොටස F – සක්‍රීයකාරක සහ සහාය", ta: "F. ஆதரவு" },
  g: {
    en: "G. Data sharing & follow-ups",
    si: "කොටස G – දත්ත බෙදාගැනීම සහ පසු විමසුම්",
    ta: "G. தரவு பகிர்வு",
  },
  h: {
    en: "H. Documents, contact & authorization",
    si: "කොටස H: අමතර තොරතුරු, ලේඛන සහ එකඟතාවය",
    ta: "H. ஆவணங்கள் & ஒப்புதல்",
  },
};

export const phase3: Survey = {
  slug: "phase-3",
  title: {
    en: "Phase 3 — Detailed Eco-Industrial Park Survey",
    si: "ප්‍රශ්නාවලිය: අදියර 3 — සවිස්තර සමීක්ෂණය",
    ta: "கட்டம் 3 — விரிவான ஆய்வு",
  },
  subtitle: {
    en: "Survey on renewable energy, circular economy and industrial symbiosis opportunities for South Asian eco-industrial parks.",
    si: "දකුණු ආසියාවේ පරිසර හිතකාමී කාර්මික උද්‍යාන සඳහා නවීකරණශීලී බලශක්ති, චක්‍රීය ආර්ථිකය සහ කාර්මික සම්බන්ධතා අවස්ථා පිළිබඳ සමීක්ෂණය.",
    ta: "புதுப்பிக்கத்தக்க ஆற்றல், வட்டப் பொருளாதாரம் மற்றும் தொழில் கூட்டுயிர்வாழ்வு வாய்ப்புகள் பற்றிய ஆய்வு.",
  },
  estimatedMinutes: 18,
  consent: CONSENT_ITEMS,
  questions: [
    // ─── Respondent info ───
    {
      id: "p3_r_org_name",
      type: "text",
      section: sec.resp,
      label: { en: "Organisation name", si: "ආයතනයේ නම", ta: "நிறுவனத்தின் பெயர்" },
    },
    {
      id: "p3_r_org_type",
      type: "single_choice",
      section: sec.resp,
      required: true,
      allowOther: true,
      label: { en: "Organisation type", si: "ආයතන වර්ගය", ta: "நிறுவன வகை" },
      options: [
        {
          value: "sme",
          label: {
            en: "Small / medium enterprise",
            si: "සුළු හා මධ්‍ය පරිමාණ සමාගම",
            ta: "சிறு/நடுத்தர நிறுவனம்",
          },
          visual: { kind: "icon", name: "store" },
        },
        {
          value: "large_local",
          label: { en: "Large local company", si: "විශාල දේශීය සමාගම", ta: "பெரிய உள்ளூர்" },
          visual: { kind: "icon", name: "building-2" },
        },
        {
          value: "fdi",
          label: {
            en: "Foreign direct investment",
            si: "විදේශ සෘජු ආයෝජන සමාගම",
            ta: "வெளிநாட்டு முதலீடு",
          },
          visual: { kind: "icon", name: "banknote" },
        },
        {
          value: "ppp",
          label: {
            en: "Public-private partnership",
            si: "රාජ්‍ය-පෞද්ගලික හවුල්කාරී ආයතනය",
            ta: "பொது-தனியார் கூட்டாண்மை",
          },
          visual: { kind: "icon", name: "handshake" },
        },
      ],
    },

    // ─── A. General & geo (Q1–5) ───
    {
      id: "p3_q1_sector",
      type: "single_choice",
      section: sec.a,
      required: true,
      allowOther: true,
      label: { en: "Industry sector", si: "කර්මාන්ත අංශය", ta: "தொழில் துறை" },
      options: [
        {
          value: "textile",
          label: { en: "Textile", si: "රෙදිපිළි", ta: "ஜவுளி" },
          visual: { kind: "icon", name: "shirt" },
        },
        {
          value: "food",
          label: { en: "Food processing", si: "ආහාර සැකසුම්", ta: "உணவு பதப்படுத்துதல்" },
          visual: { kind: "icon", name: "utensils" },
        },
        {
          value: "plastic",
          label: { en: "Plastics", si: "ප්ලාස්ටික්", ta: "பிளாஸ்டிக்" },
          visual: { kind: "icon", name: "package" },
        },
        {
          value: "chemical",
          label: { en: "Chemicals", si: "රසායනික", ta: "இரசாயனம்" },
          visual: { kind: "icon", name: "flask" },
        },
      ],
    },
    {
      id: "p3_q2_district",
      type: "text",
      section: sec.a,
      label: { en: "District", si: "දිස්ත්‍රික්කය", ta: "மாவட்டம்" },
    },
    {
      id: "p3_q2_province",
      type: "text",
      section: sec.a,
      label: { en: "Province / state", si: "පළාත / ප්‍රාන්තය", ta: "மாகாணம்" },
    },
    {
      id: "p3_q2_country",
      type: "text",
      section: sec.a,
      label: { en: "Country", si: "රට", ta: "நாடு" },
    },
    {
      id: "p3_q3_lat",
      type: "text",
      section: sec.a,
      label: { en: "Latitude (decimal, optional)", si: "අක්ෂාංශය", ta: "அட்சரேகை" },
    },
    {
      id: "p3_q3_lng",
      type: "text",
      section: sec.a,
      label: { en: "Longitude (decimal, optional)", si: "දේශාංශය", ta: "தீர்க்கரேகை" },
    },
    {
      id: "p3_q4_size",
      type: "single_choice",
      section: sec.a,
      required: true,
      label: { en: "Company size", si: "සමාගමේ ප්‍රමාණය", ta: "நிறுவன அளவு" },
      options: [
        {
          value: "small",
          label: { en: "Small (< 50 employees)", si: "කුඩා (සේවකයින් 50 ට අඩු)", ta: "சிறிய" },
          visual: { kind: "icon", name: "store" },
        },
        {
          value: "medium",
          label: { en: "Medium (50 – 250)", si: "මධ්‍යම (50–250)", ta: "நடுத்தர" },
          visual: { kind: "icon", name: "building-2" },
        },
        {
          value: "large",
          label: { en: "Large (> 250)", si: "විශාල (250 ට වැඩි)", ta: "பெரிய" },
          visual: { kind: "icon", name: "globe" },
        },
      ],
    },
    {
      id: "p3_q5_seasonal",
      type: "single_choice",
      section: sec.a,
      label: {
        en: "Seasonal variation in operations",
        si: "මෙහෙයුම්වල කාලානුරූප වෙනස්වීම්",
        ta: "பருவகால மாறுபாடு",
      },
      options: [
        {
          value: "none",
          label: { en: "No seasonal variation", si: "කාලානුරූප වෙනස්වීමක් නොමැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "minus" },
        },
        {
          value: "high_some",
          label: {
            en: "Higher in specific months",
            si: "විශේෂිත මාසවල ඉහළ වේ",
            ta: "சில மாதங்களில் அதிகம்",
          },
          visual: { kind: "icon", name: "trending-up" },
        },
      ],
    },
    {
      id: "p3_q5_months",
      type: "multi_choice",
      section: sec.a,
      showIf: { questionId: "p3_q5_seasonal", equals: "high_some" },
      label: { en: "Peak months", si: "උපරිම මාස", ta: "உச்ச மாதங்கள்" },
      options: MONTHS_12,
    },

    // ─── B. RE (Q6–12) ───
    {
      id: "p3_q6_elec",
      type: "single_choice",
      section: sec.b,
      required: true,
      label: {
        en: "Annual electricity consumption",
        si: "වාර්ෂික විදුලි බල භාවිතය",
        ta: "ஆண்டு மின் நுகர்வு",
      },
      options: [
        {
          value: "<500k",
          label: { en: "< 500,000 kWh", si: "< 500,000 kWh", ta: "< 500,000 kWh" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "500k-1m",
          label: { en: "500,000 – 1,000,000 kWh", si: "500,000–1,000,000 kWh", ta: "500k–1M kWh" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "1-5m",
          label: { en: "1 – 5 million kWh", si: "මිලියන 1–5 kWh", ta: "1–5M kWh" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">5m",
          label: { en: "> 5 million kWh", si: "> 5 මිලියන kWh", ta: "> 5M kWh" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },
    {
      id: "p3_q7_peak",
      type: "single_choice",
      section: sec.b,
      label: { en: "Peak demand", si: "උපරිම ඉල්ලුම (Peak Demand)", ta: "உச்ச தேவை" },
      options: [
        {
          value: "<500",
          label: { en: "< 500 kW", si: "< 500 kW", ta: "< 500 kW" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "500-1000",
          label: { en: "500 – 1,000 kW", si: "500–1,000 kW", ta: "500–1,000 kW" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "1000-5000",
          label: { en: "1,000 – 5,000 kW", si: "1,000–5,000 kW", ta: "1,000–5,000 kW" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">5000",
          label: { en: "> 5,000 kW", si: "> 5,000 kW", ta: "> 5,000 kW" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },
    {
      id: "p3_q8_grid",
      type: "single_choice",
      section: sec.b,
      label: {
        en: "Energy mix — share from grid",
        si: "බලශක්ති මිශ්‍රණය — Grid",
        ta: "மின் கட்டப் பங்கு",
      },
      options: [
        {
          value: "20",
          label: { en: "≈ 20%", si: "20%", ta: "20%" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "20-50",
          label: { en: "20 – 50%", si: "20–50%", ta: "20–50%" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "50-80",
          label: { en: "50 – 80%", si: "50–80%", ta: "50–80%" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">80",
          label: { en: "> 80%", si: "> 80%", ta: "> 80%" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },
    {
      id: "p3_q8_fossil",
      type: "single_choice",
      section: sec.b,
      label: {
        en: "Energy mix — diesel / fossil fuels",
        si: "බලශක්ති මිශ්‍රණය — ඩීසල් / ෆොසිල",
        ta: "டீசல்/புதைபடிவ பங்கு",
      },
      options: [
        {
          value: "<20",
          label: { en: "< 20%", si: "< 20%", ta: "< 20%" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "20-50",
          label: { en: "20 – 50%", si: "20–50%", ta: "20–50%" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "50-80",
          label: { en: "50 – 80%", si: "50–80%", ta: "50–80%" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">80",
          label: { en: "> 80%", si: "> 80%", ta: "> 80%" },
          visual: { kind: "icon", name: "signal-3" },
        },
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
      ],
    },
    {
      id: "p3_q8_re",
      type: "single_choice",
      section: sec.b,
      label: {
        en: "Energy mix — solar / biofuel / wind / waste-to-energy",
        si: "බලශක්ති මිශ්‍රණය — සූර්ය / ජෛව / සුළං / WtE",
        ta: "புதுப்பிக்கத்தக்க பங்கு",
      },
      options: [
        {
          value: "<20",
          label: { en: "< 20%", si: "< 20%", ta: "< 20%" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "20-50",
          label: { en: "20 – 50%", si: "20–50%", ta: "20–50%" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "50-80",
          label: { en: "50 – 80%", si: "50–80%", ta: "50–80%" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">80",
          label: { en: "> 80%", si: "> 80%", ta: "> 80%" },
          visual: { kind: "icon", name: "signal-3" },
        },
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
      ],
    },
    {
      id: "p3_q9_solar_area",
      type: "single_choice",
      section: sec.b,
      label: {
        en: "Roof / land area available for solar PV",
        si: "සූර්ය PV සඳහා ලබාගත හැකි වහල / භූමි ප්‍රමාණය",
        ta: "சூரிய PVக்கான பகுதி",
      },
      options: [
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
        {
          value: "<500",
          label: { en: "< 500 m²", si: "< 500 m²", ta: "< 500 m²" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "500-2000",
          label: { en: "500 – 2,000 m²", si: "500–2,000 m²", ta: "500–2,000 m²" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">2000",
          label: { en: "> 2,000 m²", si: "> 2,000 m²", ta: "> 2,000 m²" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },
    {
      id: "p3_q10_biofuel",
      type: "single_choice",
      section: sec.b,
      label: {
        en: "Available biofuel residues",
        si: "ජෛව ඉන්ධන අවශේෂ ලබාගත හැකි ප්‍රමාණය",
        ta: "உயிர் எரிபொருள் எச்சங்கள்",
      },
      options: [
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
        {
          value: "<500",
          label: { en: "< 500 t/yr", si: "< 500 ටොන්/වසර", ta: "< 500 டன்/ஆண்டு" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "500-2000",
          label: { en: "500 – 2,000 t/yr", si: "500–2,000 ටොන්/වසර", ta: "500–2,000" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">2000",
          label: { en: "> 2,000 t/yr", si: "> 2,000 ටොන්/වසර", ta: "> 2,000" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },
    {
      id: "p3_q11_re_willingness",
      type: "likert_5",
      section: sec.b,
      label: {
        en: "Willingness to increase renewable energy use (1 = not willing, 5 = very willing).",
        si: "නවීකරණශීලී බලශක්ති භාවිතය වැඩි කිරීමට කැමැත්ත (1 = කැමැත්ත නැත, 5 = ඉතා කැමැත්ත).",
        ta: "புதுப்பிக்கத்தக்க ஆற்றல் பயன்பாட்டை அதிகரிக்க விருப்பம்.",
      },
      options: LIKERT_5,
    },
    {
      id: "p3_q12_re_barriers",
      type: "multi_choice",
      section: sec.b,
      allowOther: true,
      maxSelect: 3,
      label: {
        en: "Top 3 barriers to RE adoption",
        si: "RE භාවිතය සඳහා ප්‍රධාන බාධක (ඉහළම තුන තෝරන්න)",
        ta: "RE தடைகள் — மேல் 3",
      },
      options: [
        {
          value: "cost",
          label: { en: "High initial cost", si: "ආරම්භක පිරිවැය ඉහළය", ta: "ஆரம்ப செலவு" },
          visual: { kind: "icon", name: "banknote" },
        },
        {
          value: "policy",
          label: {
            en: "Lack of policy / regulation",
            si: "ප්‍රතිපත්ති / නියාමන හිඟය",
            ta: "கொள்கை இடைவெளி",
          },
          visual: { kind: "icon", name: "shield" },
        },
        {
          value: "knowhow",
          label: {
            en: "Lack of technical know-how",
            si: "තාක්ෂණික දැනුම නොමැතිවීම",
            ta: "தொழில்நுட்ப அறிவு",
          },
          visual: { kind: "icon", name: "graduation-cap" },
        },
        {
          value: "grid",
          label: { en: "Grid connection issues", si: "Grid සම්බන්ධතා ගැටලු", ta: "கட்ட இணைப்பு" },
          visual: { kind: "icon", name: "zap" },
        },
        {
          value: "space",
          label: { en: "Limited space", si: "සීමිත ඉඩකඩ", ta: "வரம்புக்குட்பட்ட இடம்" },
          visual: { kind: "icon", name: "house" },
        },
        {
          value: "maintenance",
          label: { en: "Maintenance challenges", si: "නඩත්තු ගැටලු", ta: "பராமரிப்பு" },
          visual: { kind: "icon", name: "gauge" },
        },
      ],
    },

    // ─── C. CE (Q13–17) ───
    {
      id: "p3_q13_waste_streams",
      type: "multi_choice",
      section: sec.c,
      allowOther: true,
      label: {
        en: "Main waste streams (select all that apply)",
        si: "ප්‍රධාන අපද්‍රව්‍ය ප්‍රවාහ",
        ta: "முக்கிய கழிவுகள்",
      },
      options: [
        {
          value: "organic",
          label: { en: "Bio / organic waste", si: "ජෛව / කාබනික අපද්‍රව්‍ය", ta: "கரிம" },
          visual: { kind: "icon", name: "leaf" },
        },
        {
          value: "plastic",
          label: { en: "Plastic", si: "ප්ලාස්ටික්", ta: "பிளாஸ்டிக்" },
          visual: { kind: "icon", name: "package" },
        },
        {
          value: "paper",
          label: { en: "Paper", si: "කඩදාසි", ta: "காகிதம்" },
          visual: { kind: "icon", name: "file-text" },
        },
        {
          value: "metal",
          label: { en: "Metal", si: "ලෝහ", ta: "உலோகம்" },
          visual: { kind: "icon", name: "award" },
        },
        {
          value: "sludge",
          label: { en: "Sludge", si: "Sludge", ta: "சேறு" },
          visual: { kind: "icon", name: "trash" },
        },
        {
          value: "wastewater",
          label: { en: "Wastewater", si: "අපජලය", ta: "கழிவு நீர்" },
          visual: { kind: "icon", name: "droplets" },
        },
      ],
    },
    {
      id: "p3_q14_waste_qty",
      type: "single_choice",
      section: sec.c,
      label: { en: "Approximate waste generation", si: "ආසන්න අපද්‍රව්‍ය ජනනය", ta: "மொத்த கழிவு" },
      options: [
        {
          value: "<50",
          label: { en: "< 50 t/yr", si: "< 50 ටොන්/වසර", ta: "< 50" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "50-200",
          label: { en: "50 – 200 t/yr", si: "50–200 ටොන්/වසර", ta: "50–200" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "200-500",
          label: { en: "200 – 500 t/yr", si: "200–500 ටොන්/වසර", ta: "200–500" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">500",
          label: { en: "> 500 t/yr", si: "> 500 ටොන්/වසර", ta: "> 500" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },
    {
      id: "p3_q15_ce_practices",
      type: "multi_choice",
      section: sec.c,
      label: {
        en: "Current circular-economy practices",
        si: "දැනට පවතින CE ක්‍රියාමාර්ග",
        ta: "தற்போதைய CE நடைமுறைகள்",
      },
      options: [
        {
          value: "internal_recycle",
          label: {
            en: "Internal recycling / reuse",
            si: "අභ්‍යන්තර ප්‍රතිචක්‍රීකරණය / නැවත භාවිතය",
            ta: "உள் மறுசுழற்சி",
          },
          visual: { kind: "icon", name: "recycle" },
        },
        {
          value: "external_recycle",
          label: {
            en: "External recycling",
            si: "පිටස්තර ප්‍රතිචක්‍රීකරණය",
            ta: "வெளிப்புற மறுசுழற்சி",
          },
          visual: { kind: "icon", name: "share" },
        },
        {
          value: "process_eff",
          label: {
            en: "Process redesign for resource efficiency",
            si: "සම්පත් කාර්යක්ෂමතාව සඳහා ක්‍රියාවලි සංවර්ධනය",
            ta: "செயல்முறை திறன்",
          },
          visual: { kind: "icon", name: "sparkles" },
        },
        {
          value: "wte",
          label: { en: "Waste-to-energy", si: "Waste-to-Energy", ta: "கழிவிலிருந்து ஆற்றல்" },
          visual: { kind: "icon", name: "zap" },
        },
        {
          value: "lifespan",
          label: {
            en: "Product life-extension / remanufacture",
            si: "නිෂ්පාදන ආයු කාලය දිගු කිරීම / නැවත නිෂ්පාදනය",
            ta: "ஆயுள் நீட்டிப்பு",
          },
          visual: { kind: "icon", name: "rocket" },
        },
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
      ],
    },
    {
      id: "p3_q16_valorization",
      type: "multi_choice",
      section: sec.c,
      allowOther: true,
      maxSelect: 2,
      label: {
        en: "Top 2 waste valorization opportunities",
        si: "අපද්‍රව්‍ය වටිනාකරණ හැකියාව (ඉහළම දෙක තෝරන්න)",
        ta: "மேல் 2 மதிப்புயர்வு வாய்ப்புகள்",
      },
      options: [
        {
          value: "organic",
          label: { en: "Organic waste", si: "කාබනික අපද්‍රව්‍ය", ta: "கரிம கழிவு" },
          visual: { kind: "icon", name: "leaf" },
        },
        {
          value: "plastic",
          label: { en: "Plastic", si: "ප්ලාස්ටික්", ta: "பிளாஸ்டிக்" },
          visual: { kind: "icon", name: "package" },
        },
        {
          value: "sludge",
          label: { en: "Sludge", si: "Sludge", ta: "சேறு" },
          visual: { kind: "icon", name: "trash" },
        },
        {
          value: "wastewater",
          label: { en: "Wastewater", si: "අපජලය", ta: "கழிவு நீர்" },
          visual: { kind: "icon", name: "droplets" },
        },
      ],
    },
    {
      id: "p3_q17_ce_support",
      type: "multi_choice",
      section: sec.c,
      label: {
        en: "Support needed to implement CE",
        si: "CE ක්‍රියාත්මක කිරීමට අවශ්‍ය සහාය",
        ta: "CE அமலாக்கத்திற்கு ஆதரவு",
      },
      options: [
        {
          value: "tech_transfer",
          label: { en: "Technology transfer", si: "තාක්ෂණ හුවමාරුව", ta: "தொழில்நுட்ப பரிமாற்றம்" },
          visual: { kind: "icon", name: "microscope" },
        },
        {
          value: "incentives",
          label: { en: "Financial incentives", si: "මූල්‍ය දිරිගැන්වීම්", ta: "நிதி ஊக்கங்கள்" },
          visual: { kind: "icon", name: "banknote" },
        },
        {
          value: "market",
          label: { en: "Market linkages", si: "වෙළඳපොළ සම්බන්ධතා", ta: "சந்தை இணைப்புகள்" },
          visual: { kind: "icon", name: "network" },
        },
        {
          value: "training",
          label: {
            en: "Training / capacity building",
            si: "පුහුණුව / හැකියාව වර්ධනය",
            ta: "பயிற்சி",
          },
          visual: { kind: "icon", name: "graduation-cap" },
        },
        {
          value: "policy",
          label: { en: "Policy support", si: "ප්‍රතිපත්ති සහාය", ta: "கொள்கை ஆதரவு" },
          visual: { kind: "icon", name: "shield" },
        },
      ],
    },

    // ─── D. IS (Q18–23) ───
    {
      id: "p3_q18_exchanges",
      type: "single_choice",
      section: sec.d,
      label: {
        en: "Existing resource exchanges",
        si: "දැනට පවතින සම්පත් හුවමාරු",
        ta: "தற்போதைய பரிமாற்றங்கள்",
      },
      options: [
        {
          value: "same",
          label: {
            en: "Yes — within the same industrial zone",
            si: "ඔව් (එකම කාර්මික කලාපය තුළ)",
            ta: "ஆம் — அதே மண்டலம்",
          },
          visual: { kind: "icon", name: "house" },
        },
        {
          value: "other",
          label: {
            en: "Yes — with other zones",
            si: "ඔව් (වෙනත් කලාප සමඟ)",
            ta: "ஆம் — வேறு மண்டலங்கள்",
          },
          visual: { kind: "icon", name: "globe" },
        },
        {
          value: "no",
          label: { en: "No", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
      ],
    },
    {
      id: "p3_q19_exchange_type",
      type: "multi_choice",
      section: sec.d,
      allowOther: true,
      showIf: { questionId: "p3_q18_exchanges", equals: ["same", "other"] },
      label: { en: "Type of exchange (if yes)", si: "හුවමාරු වර්ගය (ඔව් නම්)", ta: "பரிமாற்ற வகை" },
      options: [
        {
          value: "heat",
          label: { en: "Waste heat", si: "අපද්‍රව්‍ය උෂ්ණත්වය", ta: "கழிவு வெப்பம்" },
          visual: { kind: "icon", name: "sun" },
        },
        {
          value: "water",
          label: { en: "Water", si: "ජලය", ta: "நீர்" },
          visual: { kind: "icon", name: "droplets" },
        },
        {
          value: "byproduct",
          label: { en: "By-products", si: "අතුරු නිෂ්පාදන", ta: "துணை-தயாரிப்பு" },
          visual: { kind: "icon", name: "package" },
        },
        {
          value: "packaging",
          label: { en: "Packaging materials", si: "ඇසුරුම් ද්‍රව්‍ය", ta: "பேக்கேஜிங்" },
          visual: { kind: "icon", name: "box" },
        },
        {
          value: "logistics",
          label: { en: "Logistics services", si: "ලොජිස්ටික් සේවා", ta: "தளவாடம்" },
          visual: { kind: "icon", name: "truck" },
        },
      ],
    },
    {
      id: "p3_q20_supply",
      type: "multi_choice",
      section: sec.d,
      allowOther: true,
      label: {
        en: "Resources you could supply to other industries",
        si: "වෙනත් කර්මාන්ත සඳහා සැපයිය හැකි සම්පත්",
        ta: "வழங்கக்கூடிய வளங்கள்",
      },
      options: [
        {
          value: "organic",
          label: { en: "Organic waste", si: "කාබනික අපද්‍රව්‍ය", ta: "கரிம கழிவு" },
          visual: { kind: "icon", name: "leaf" },
        },
        {
          value: "plastic",
          label: { en: "Plastic", si: "ප්ලාස්ටික්", ta: "பிளாஸ்டிக்" },
          visual: { kind: "icon", name: "package" },
        },
        {
          value: "heat",
          label: { en: "Heat / steam", si: "උෂ්ණත්වය / වාෂ්පය", ta: "வெப்பம்/ஆவி" },
          visual: { kind: "icon", name: "sun" },
        },
        {
          value: "sludge",
          label: { en: "Sludge", si: "Sludge", ta: "சேறு" },
          visual: { kind: "icon", name: "trash" },
        },
        {
          value: "water",
          label: { en: "Water", si: "ජලය", ta: "நீர்" },
          visual: { kind: "icon", name: "droplets" },
        },
      ],
    },
    {
      id: "p3_q21_inputs",
      type: "multi_choice",
      section: sec.d,
      allowOther: true,
      label: {
        en: "Inputs you could receive from the same or other zones",
        si: "එකම කාර්මික කලාපය තුළ හෝ වෙනත් කලාපවලින් ලබාගත හැකි ආදාන",
        ta: "பெறக்கூடிய உள்ளீடுகள்",
      },
      options: [
        {
          value: "raw",
          label: { en: "Raw materials", si: "අමුද්‍රව්‍ය", ta: "மூலப்பொருள்" },
          visual: { kind: "icon", name: "flask" },
        },
        {
          value: "byproduct",
          label: { en: "By-products", si: "අතුරු නිෂ්පාදන", ta: "துணை-தயாரிப்பு" },
          visual: { kind: "icon", name: "package" },
        },
        {
          value: "heat",
          label: { en: "Heat / steam", si: "උෂ්ණත්වය / වාෂ්පය", ta: "வெப்பம்" },
          visual: { kind: "icon", name: "sun" },
        },
        {
          value: "water",
          label: { en: "Water", si: "ජලය", ta: "நீர்" },
          visual: { kind: "icon", name: "droplets" },
        },
        {
          value: "packaging",
          label: { en: "Packaging", si: "ඇසුරුම්", ta: "பேக்கேஜிங்" },
          visual: { kind: "icon", name: "box" },
        },
      ],
    },
    {
      id: "p3_q22_collab_mode",
      type: "multi_choice",
      section: sec.d,
      label: {
        en: "Preferred collaboration mode",
        si: "කැමති සහයෝගීතා ක්‍රමය",
        ta: "விருப்பமான ஒத்துழைப்பு",
      },
      options: [
        {
          value: "shared_facilities",
          label: { en: "Shared facilities", si: "හවුල් පහසුකම්", ta: "பகிர்ந்த வசதிகள்" },
          visual: { kind: "icon", name: "handshake" },
        },
        {
          value: "byproduct",
          label: {
            en: "By-product exchange",
            si: "අතුරු නිෂ්පාදන හුවමාරුව",
            ta: "துணை பரிமாற்றம்",
          },
          visual: { kind: "icon", name: "recycle" },
        },
        {
          value: "logistics",
          label: { en: "Shared logistics", si: "ලොජිස්ටික් බෙදාගැනීම", ta: "தளவாடப் பகிர்வு" },
          visual: { kind: "icon", name: "truck" },
        },
        {
          value: "treatment",
          label: {
            en: "Common treatment facility",
            si: "පොදු ප්‍රතිකාර පහසුකම්",
            ta: "பொது சுத்திகரிப்பு",
          },
          visual: { kind: "icon", name: "shield" },
        },
        {
          value: "microgrid",
          label: {
            en: "Park-wide RE micro-grid (solar)",
            si: "කාර්මික උද්‍යානය පුරා RE micro-grid (Solar)",
            ta: "RE மைக்ரோ-கிரிட்",
          },
          visual: { kind: "icon", name: "zap" },
        },
      ],
    },
    {
      id: "p3_q23_distance",
      type: "single_choice",
      section: sec.d,
      label: {
        en: "Maximum acceptable transport distance for exchanges",
        si: "හුවමාරු සඳහා උපරිම පිළිගත හැකි ප්‍රවාහන දුර",
        ta: "அதிகபட்ச போக்குவரத்து தூரம்",
      },
      options: [
        {
          value: "<5",
          label: { en: "< 5 km", si: "< 5 km", ta: "< 5 km" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "5-15",
          label: { en: "5 – 15 km", si: "5–15 km", ta: "5–15 km" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "15-30",
          label: { en: "15 – 30 km", si: "15–30 km", ta: "15–30 km" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">30",
          label: { en: "> 30 km", si: "> 30 km", ta: "> 30 km" },
          visual: { kind: "icon", name: "signal-3" },
        },
      ],
    },

    // ─── E. TBL (Q24–27) ───
    {
      id: "p3_q24_savings",
      type: "single_choice",
      section: sec.e,
      label: {
        en: "Expected cost savings from RE / CE / IS",
        si: "RE / CE / IS ක්‍රියාත්මක කිරීමෙන් බලාපොරොත්තු වන පිරිවැය ඉතිරිකිරීම්",
        ta: "எதிர்பார்க்கப்படும் சேமிப்பு",
      },
      options: [
        {
          value: "<5",
          label: { en: "< 5%", si: "< 5%", ta: "< 5%" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "5-15",
          label: { en: "5 – 15%", si: "5–15%", ta: "5–15%" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "15-30",
          label: { en: "15 – 30%", si: "15–30%", ta: "15–30%" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">30",
          label: { en: "> 30%", si: "> 30%", ta: "> 30%" },
          visual: { kind: "icon", name: "signal-3" },
        },
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
      ],
    },
    {
      id: "p3_q25_invest",
      type: "single_choice",
      section: sec.e,
      label: {
        en: "Willing share of annual revenue to invest in RE / CE / IS",
        si: "RE / CE / IS සඳහා වාර්ෂික ආදායමෙන් ආයෝජනය කිරීමට කැමැත්ත",
        ta: "முதலீட்டு விருப்பம்",
      },
      options: [
        {
          value: "<1",
          label: { en: "< 1%", si: "< 1%", ta: "< 1%" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "1-5",
          label: { en: "1 – 5%", si: "1–5%", ta: "1–5%" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: "5-10",
          label: { en: "5 – 10%", si: "5–10%", ta: "5–10%" },
          visual: { kind: "icon", name: "signal-2" },
        },
        {
          value: ">10",
          label: { en: "> 10%", si: "> 10%", ta: "> 10%" },
          visual: { kind: "icon", name: "signal-3" },
        },
        {
          value: "none",
          label: { en: "None", si: "නැත", ta: "இல்லை" },
          visual: { kind: "icon", name: "ban" },
        },
      ],
    },
    {
      id: "p3_q26_env_impact",
      type: "multi_choice",
      section: sec.e,
      label: {
        en: "Expected environmental impacts (select all that apply)",
        si: "බලාපොරොත්තු වන පාරිසරික බලපෑම්",
        ta: "எதிர்பார்க்கப்படும் சுற்றுச்சூழல் தாக்கம்",
      },
      options: [
        {
          value: "ghg<5",
          label: { en: "GHG reduction < 5%", si: "GHG අඩුකිරීම < 5%", ta: "GHG < 5%" },
          visual: { kind: "icon", name: "wind" },
        },
        {
          value: "ghg5-15",
          label: { en: "GHG reduction 5 – 15%", si: "GHG අඩුකිරීම 5–15%", ta: "GHG 5–15%" },
          visual: { kind: "icon", name: "wind" },
        },
        {
          value: "ghg>15",
          label: { en: "GHG reduction > 15%", si: "GHG අඩුකිරීම > 15%", ta: "GHG > 15%" },
          visual: { kind: "icon", name: "wind" },
        },
        {
          value: "waste<10",
          label: {
            en: "Waste reduction < 10%",
            si: "අපද්‍රව්‍ය අඩුකිරීම < 10%",
            ta: "கழிவு < 10%",
          },
          visual: { kind: "icon", name: "trash" },
        },
        {
          value: "waste10-30",
          label: {
            en: "Waste reduction 10 – 30%",
            si: "අපද්‍රව්‍ය අඩුකිරීම 10–30%",
            ta: "கழிவு 10–30%",
          },
          visual: { kind: "icon", name: "trash" },
        },
        {
          value: "waste>30",
          label: {
            en: "Waste reduction > 30%",
            si: "අපද්‍රව්‍ය අඩුකිරීම > 30%",
            ta: "கழிவு > 30%",
          },
          visual: { kind: "icon", name: "trash" },
        },
        {
          value: "water<10",
          label: { en: "Water reduction < 10%", si: "ජල භාවිතය අඩුකිරීම < 10%", ta: "நீர் < 10%" },
          visual: { kind: "icon", name: "droplets" },
        },
        {
          value: "water10-30",
          label: {
            en: "Water reduction 10 – 30%",
            si: "ජල භාවිතය අඩුකිරීම 10–30%",
            ta: "நீர் 10–30%",
          },
          visual: { kind: "icon", name: "droplets" },
        },
        {
          value: "water>30",
          label: { en: "Water reduction > 30%", si: "ජල භාවිතය අඩුකිරීම > 30%", ta: "நீர் > 30%" },
          visual: { kind: "icon", name: "droplets" },
        },
      ],
    },
    {
      id: "p3_q27_jobs",
      type: "single_choice",
      section: sec.e,
      label: { en: "Expected new jobs created", si: "රැකියා නිර්මාණය", ta: "புதிய வேலைகள்" },
      options: [
        {
          value: "0-5",
          label: { en: "0 – 5", si: "0–5", ta: "0–5" },
          visual: { kind: "icon", name: "signal-0" },
        },
        {
          value: "5-20",
          label: { en: "5 – 20", si: "5–20", ta: "5–20" },
          visual: { kind: "icon", name: "signal-1" },
        },
        {
          value: ">20",
          label: { en: "> 20", si: "> 20", ta: "> 20" },
          visual: { kind: "icon", name: "signal-2" },
        },
      ],
    },
    {
      id: "p3_q27_safety",
      type: "yes_no",
      section: sec.e,
      label: {
        en: "Improved worker safety expected?",
        si: "සේවක ආරක්ෂාව වැඩිදියුණු වීම",
        ta: "பாதுகாப்பு மேம்படுத்தல்",
      },
    },
    {
      id: "p3_q27_community",
      type: "yes_no",
      section: sec.e,
      label: { en: "Community benefits expected?", si: "ප්‍රජා ප්‍රතිලාභ", ta: "சமூக நன்மைகள்" },
    },

    // ─── F. Enablers (Q28) ───
    {
      id: "p3_q28_enablers",
      type: "multi_choice",
      section: sec.f,
      maxSelect: 3,
      label: {
        en: "Top 3 enablers needed",
        si: "අවශ්‍ය ප්‍රධාන සක්‍රීයකාරක (ඉහළම තුන තෝරන්න)",
        ta: "தேவையான ஆதரவு — மேல் 3",
      },
      options: [
        {
          value: "incentives",
          label: { en: "Financial incentives", si: "මූල්‍ය දිරිගැන්වීම්", ta: "நிதி ஊக்கங்கள்" },
          visual: { kind: "icon", name: "banknote" },
        },
        {
          value: "policy",
          label: {
            en: "Policy / regulatory support",
            si: "ප්‍රතිපත්ති / නියාමන සහාය",
            ta: "கொள்கை ஆதரவு",
          },
          visual: { kind: "icon", name: "shield" },
        },
        {
          value: "training",
          label: { en: "Training / expertise", si: "පුහුණුව / විශේෂඥතාව", ta: "பயிற்சி" },
          visual: { kind: "icon", name: "graduation-cap" },
        },
        {
          value: "tech",
          label: { en: "Technology access", si: "තාක්ෂණ ප්‍රවේශය", ta: "தொழில்நுட்பம்" },
          visual: { kind: "icon", name: "microscope" },
        },
        {
          value: "market",
          label: { en: "Market linkages", si: "වෙළඳපොළ සම්බන්ධතා", ta: "சந்தை இணைப்புகள்" },
          visual: { kind: "icon", name: "network" },
        },
      ],
    },

    // ─── G. Data sharing (Q29–30) ───
    {
      id: "p3_q29_nda",
      type: "yes_no",
      section: sec.g,
      label: {
        en: "Willing to share supporting data (bills, plans) under an NDA?",
        si: "NDA යටතේ සහායක දත්ත (බිල්පත්, සැලසුම්) බෙදාගැනීමට කැමතිද?",
        ta: "NDA இன் கீழ் தரவு பகிர விருப்பம்?",
      },
    },
    {
      id: "p3_q30_future",
      type: "yes_no",
      section: sec.g,
      label: {
        en: "Willing to participate in future feasibility studies?",
        si: "අනාගත හැකියාව අධ්‍යයන සඳහා සහභාගී වීමට කැමතිද?",
        ta: "எதிர்கால ஆய்வுகளில் பங்கேற்க?",
      },
    },

    // ─── H. Documents + contacts + authorization ───
    {
      id: "p3_h_docs",
      type: "multi_choice",
      section: sec.h,
      allowOther: true,
      label: {
        en: "Supporting documents you can share",
        si: "ඔබට ලබාදිය හැකි අමතර ලේඛන",
        ta: "பகிரக்கூடிய ஆவணங்கள்",
      },
      options: DOC_OPTIONS,
    },
    {
      id: "p3_h_doc_sharing",
      type: "single_choice",
      section: sec.h,
      label: {
        en: "Are you willing to provide copies of relevant documents?",
        si: "අදාල ලේඛන පිටපත් ලබාදීමට ඔබ කැමතිද?",
        ta: "ஆவண நகல்கள் வழங்க தயாரா?",
      },
      options: DOC_SHARING_OPTIONS,
    },
    {
      id: "p3_h_contact_primary_name",
      type: "text",
      section: sec.h,
      label: {
        en: "Primary contact — name",
        si: "ප්‍රධාන සම්බන්ධීකරණ පුද්ගලයා — නම",
        ta: "முதன்மை தொடர்பு",
      },
    },
    {
      id: "p3_h_contact_primary_role",
      type: "text",
      section: sec.h,
      label: { en: "Primary contact — title", si: "තනතුර", ta: "பதவி" },
    },
    {
      id: "p3_h_contact_primary_email",
      type: "email",
      section: sec.h,
      label: { en: "Primary contact — email", si: "විද්‍යුත් තැපෑල", ta: "மின்னஞ்சல்" },
    },
    {
      id: "p3_h_contact_primary_phone",
      type: "tel",
      section: sec.h,
      label: { en: "Primary contact — phone", si: "දුරකථන", ta: "தொலைபேசி" },
    },
    {
      id: "p3_h_contact_primary_linkedin",
      type: "text",
      section: sec.h,
      label: { en: "Primary contact — LinkedIn (optional)", si: "LinkedIn", ta: "LinkedIn" },
    },
    {
      id: "p3_h_contact_alt_name",
      type: "text",
      section: sec.h,
      label: {
        en: "Alternate contact — name (optional)",
        si: "විකල්ප සම්බන්ධීකරණ පුද්ගලයා — නම",
        ta: "மாற்று தொடர்பு",
      },
    },
    {
      id: "p3_h_contact_alt_email",
      type: "email",
      section: sec.h,
      label: {
        en: "Alternate contact — email (optional)",
        si: "විද්‍යුත් තැපෑල",
        ta: "மாற்று மின்னஞ்சல்",
      },
    },
    {
      id: "p3_h_data_use",
      type: "multi_choice",
      section: sec.h,
      label: {
        en: "I agree to the following uses of the data",
        si: "දත්ත භාවිතය සඳහා එකඟතාවය",
        ta: "தரவு பயன்பாட்டு ஒப்புதல்",
      },
      options: [
        {
          value: "research",
          label: {
            en: "Use for research purposes",
            si: "අධ්‍යයන කටයුතු සඳහා",
            ta: "ஆராய்ச்சிக்கு",
          },
          visual: { kind: "icon", name: "microscope" },
        },
        {
          value: "publish_named",
          label: {
            en: "Publish aggregated results (organisation may be named)",
            si: "ආයතන නාමය සඳහන් කළ හැක",
            ta: "பெயருடன்",
          },
          visual: { kind: "icon", name: "megaphone" },
        },
        {
          value: "publish_anon",
          label: {
            en: "Publish aggregated results (organisation kept confidential)",
            si: "ආයතන නාමය රහස්‍යව තබා",
            ta: "பெயரிடாது",
          },
          visual: { kind: "icon", name: "eye-off" },
        },
        {
          value: "followup",
          label: { en: "Follow-up / clarification contacts", si: "පසු විමසීම්", ta: "தொடர்பு" },
          visual: { kind: "icon", name: "phone-call" },
        },
        {
          value: "share_results",
          label: {
            en: "Share results with our organisation",
            si: "පර්යේෂණ ප්‍රතිඵල බෙදා ගැනීමට",
            ta: "முடிவுகள் பகிர்தல்",
          },
          visual: { kind: "icon", name: "share" },
        },
      ],
    },
    {
      id: "p3_h_authorization",
      type: "yes_no",
      section: sec.h,
      required: true,
      label: {
        en: "I confirm I am authorised to provide this information on behalf of my organisation, that it is accurate to the best of my knowledge, and that it will be used for academic research.",
        si: "මෙම තොරතුරු මගේ ආයතනය වෙනුවෙන් ලබාදීමට මට අවසර ඇති බවත්, නිවැරදි බවත්, අධ්‍යයන කටයුතු සඳහා භාවිතා වන බවත් මම තහවුරු කරමි.",
        ta: "எனது நிறுவனத்தின் சார்பாக இதை வழங்க அங்கீகாரம் பெற்றுள்ளேன் என்பதை உறுதிப்படுத்துகிறேன்.",
      },
    },
  ],
};
