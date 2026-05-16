import {
  Award,
  Ban,
  Banknote,
  BarChart3,
  BatteryLow,
  BookOpen,
  Box,
  Building2,
  Calendar,
  Check,
  CheckCheck,
  CircleDot,
  ClipboardCheck,
  Droplets,
  EyeOff,
  FileText,
  FlaskConical,
  Frown,
  Gauge,
  Globe,
  GraduationCap,
  Handshake,
  House,
  Laugh,
  Leaf,
  Lock,
  Mail,
  Map as MapIcon,
  Megaphone,
  Microscope,
  Meh,
  Minus,
  Network,
  Package,
  PhoneCall,
  Recycle,
  Rocket,
  Scale,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Ship,
  Shirt,
  SignalHigh,
  SignalLow,
  SignalMedium,
  SignalZero,
  Smile,
  Sparkles,
  Store,
  Sun,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingDown,
  TrendingUp,
  Truck,
  UtensilsCrossed,
  Wallet,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Curated allowlist of icons that survey options may reference.
 *
 * Keeping this map closed-world means:
 *   1. lucide tree-shaking stays effective (we import only what we use).
 *   2. typos in `visual: { kind: "icon", name: "..." }` fail at typecheck
 *      because `OptionIconName` is `keyof typeof OPTION_ICONS`.
 *   3. designers know exactly which glyphs are "in vocabulary" without
 *      browsing the entire lucide library.
 */
export const OPTION_ICONS = {
  // Yes / No
  "thumbs-up": ThumbsUp,
  "thumbs-down": ThumbsDown,

  // Likert faces (5)
  frown: Frown,
  meh: Meh,
  "circle-dot": CircleDot,
  smile: Smile,
  laugh: Laugh,

  // Document kinds (Phase 1 G / Phase 3 H)
  "file-text": FileText,
  map: MapIcon,
  "book-open": BookOpen,
  "bar-chart": BarChart3,
  leaf: Leaf,
  "clipboard-check": ClipboardCheck,
  "graduation-cap": GraduationCap,
  network: Network,
  wallet: Wallet,
  gauge: Gauge,

  // Doc-sharing
  "check-check": CheckCheck,
  check: Check,
  lock: Lock,
  mail: Mail,

  // Months / time
  calendar: Calendar,

  // Sectors (Phase-1 industry types)
  utensils: UtensilsCrossed,
  shirt: Shirt,
  package: Package,
  flask: FlaskConical,

  // Ownership / scale-of-business
  store: Store,
  "building-2": Building2,
  globe: Globe,
  handshake: Handshake,
  banknote: Banknote,

  // Geography / market orientation
  house: House,
  scale: Scale,
  ship: Ship,

  // Trend / growth
  "trending-down": TrendingDown,
  minus: Minus,
  "trending-up": TrendingUp,
  rocket: Rocket,

  // Certifications
  award: Award,
  ban: Ban,

  // Sustainability practices
  sparkles: Sparkles,
  zap: Zap,
  droplets: Droplets,
  sun: Sun,
  recycle: Recycle,

  // Compliance
  "shield-check": ShieldCheck,
  "shield-alert": ShieldAlert,
  "shield-x": ShieldX,
  shield: Shield,

  // Pollution / environmental challenges
  wind: Wind,
  trash: Trash2,
  "battery-low": BatteryLow,

  // Logistics / packaging
  box: Box,
  truck: Truck,

  // Data-use consent
  microscope: Microscope,
  megaphone: Megaphone,
  "eye-off": EyeOff,
  "phone-call": PhoneCall,
  share: Share2,

  // 4-step intensity scales (none → low → moderate → high)
  "signal-0": SignalZero,
  "signal-1": SignalLow,
  "signal-2": SignalMedium,
  "signal-3": SignalHigh,
} satisfies Record<string, LucideIcon>;

export type OptionIconName = keyof typeof OPTION_ICONS;