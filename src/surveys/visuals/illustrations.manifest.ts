/**
 * Manifest for AI-generated option illustrations.
 *
 * Each entry is consumed by `scripts/generate-option-illustrations.ts` to
 * produce a `src/assets/options/<slug>.webp`. Once generated, statically
 * import the asset in the survey question definition:
 *
 *     import sectorAgri from "@/assets/options/sector-agriculture.webp";
 *     visual: { kind: "image", src: sectorAgri, alt: { en: "Agriculture", … } }
 *
 * Style is locked by `STYLE_PROMPT` so every shipped illustration matches.
 * Keep prompts subject-only ("a single ripe paddy stalk") — the style
 * suffix is appended automatically.
 *
 * Bundle budget: ≤25 KB per asset, cap ~40 entries total across surveys.
 */

/** Style suffix appended to every prompt to keep illustrations consistent. */
export const STYLE_PROMPT =
  "flat vector illustration, 2-tone using primary green #2f9d6c and warm sand #d6a85a, " +
  "soft long shadow, isometric 3/4 perspective, subject centered, no text, no logo, " +
  "no human faces, transparent background, ~512px square, clean edges, suitable as a " +
  "small option icon at 40×40";

export interface IllustrationSpec {
  /** Becomes the file name: `src/assets/options/<slug>.webp`. */
  slug: string;
  /** Subject-only prompt. The shared `STYLE_PROMPT` is appended at gen time. */
  prompt: string;
  /**
   * Free-form note about which question/option this targets — keeps the
   * manifest greppable when an option is renamed and the asset goes stale.
   */
  note?: string;
}

/**
 * Phase-3 manifest. The survey covers sectors, project types, and
 * stakeholder categories where a single lucide glyph reads poorly — the
 * exact case the plan calls out for illustrations.
 */
export const PHASE_3_ILLUSTRATIONS: IllustrationSpec[] = [
  // Sectors — recognisable real-world subjects
  {
    slug: "sector-agriculture",
    prompt: "a single ripe paddy stalk with two leaves",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-fisheries",
    prompt: "a stylised fish leaping from a wave",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-tourism",
    prompt: "a coastal palm with a small luggage tag",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-manufacturing",
    prompt: "a small factory silhouette with two stacks emitting clean steam",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-construction",
    prompt: "a hard hat resting on a stack of bricks",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-energy",
    prompt: "a wind turbine next to a single solar panel",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-transport",
    prompt: "a cargo lorry seen from a 3/4 angle",
    note: "phase-3 sector picker",
  },
  {
    slug: "sector-services",
    prompt: "a laptop with a headset on top",
    note: "phase-3 sector picker",
  },

  // Project / programme types
  {
    slug: "project-water",
    prompt: "a water droplet falling into a small reservoir",
    note: "phase-3 project type",
  },
  {
    slug: "project-waste",
    prompt: "a recycling bin with three arrows around it",
    note: "phase-3 project type",
  },
  {
    slug: "project-reforestation",
    prompt: "a sapling sprouting from cupped hands",
    note: "phase-3 project type",
  },
  {
    slug: "project-biodiversity",
    prompt: "a leaf with a butterfly resting on it",
    note: "phase-3 project type",
  },
  {
    slug: "project-air-quality",
    prompt: "a city skyline with a clean breeze swirl above",
    note: "phase-3 project type",
  },
  {
    slug: "project-coastal",
    prompt: "a mangrove tree at the waterline",
    note: "phase-3 project type",
  },

  // Stakeholder categories
  {
    slug: "stakeholder-government",
    prompt: "a small classical government building with three columns",
    note: "phase-3 stakeholder",
  },
  {
    slug: "stakeholder-community",
    prompt: "three abstract human figures standing together",
    note: "phase-3 stakeholder",
  },
  {
    slug: "stakeholder-academia",
    prompt: "a graduation cap on top of an open book",
    note: "phase-3 stakeholder",
  },
  {
    slug: "stakeholder-ngo",
    prompt: "two hands forming a heart shape",
    note: "phase-3 stakeholder",
  },
  {
    slug: "stakeholder-private",
    prompt: "an office building with a small briefcase",
    note: "phase-3 stakeholder",
  },
  {
    slug: "stakeholder-media",
    prompt: "a microphone with sound waves",
    note: "phase-3 stakeholder",
  },
];

export const ALL_ILLUSTRATIONS: IllustrationSpec[] = [...PHASE_3_ILLUSTRATIONS];
