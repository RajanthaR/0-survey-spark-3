# EIP Insight — Infographic Video Outline

**Audience:** Academic community, including PhD supervisors and examiners
**Hosted at:** "More info" section of the survey
**Format:** Short-form motion infographic (target 4–6 minutes)
**Voice:** First-person plural ("we"), measured, scholarly, accessible
**Goal:** Explain what the platform is, why it exists, how it works, and what safeguards underpin the data it collects — without requiring viewers to read any code or documentation.

---

## Storyboard Flow At A Glance

| #   | Scene      | Beat                              | Run-time    |
| --- | ---------- | --------------------------------- | ----------- |
| 1   | Hook       | The industrial question           | 0:00 – 0:25 |
| 2   | Why        | The case for Eco-Industrial Parks | 0:25 – 0:55 |
| 3   | What       | Introducing EIP Insight           | 0:55 – 1:20 |
| 4   | Who        | The two survey phases             | 1:20 – 1:55 |
| 5   | How (UX)   | A respondent's journey            | 1:55 – 2:35 |
| 6   | How (Tech) | Under the hood                    | 2:35 – 3:20 |
| 7   | Trust      | Privacy, ethics, anonymity        | 3:20 – 3:55 |
| 8   | Rigour     | Engineering quality posture       | 3:55 – 4:25 |
| 9   | Output     | From responses to findings        | 4:25 – 4:55 |
| 10  | Close      | Invitation and gratitude          | 4:55 – 5:20 |

---

## Scene 1 — Hook: The Industrial Question (0:00 – 0:25)

**Visual concept:**
Soft satellite-style fly-over of a stylised South Asian industrial zone. Smokestacks, lorries, water channels animate in as line-art. A single question pulses on screen.

**On-screen text:**

> _Can industrial growth in South Asia be designed to use less, share more, and pollute less — without slowing development?_

**Voiceover:**
"Industry powers the region's economies. It also strains its resources. The question we are asking is whether industrial growth can be re-shaped — coordinated rather than fragmented — so it costs the environment less."

**Transition:** The smokestacks rearrange into a tidy cluster of interconnected facilities — a visual seed of the Eco-Industrial Park idea.

---

## Scene 2 — Why: The Case For Eco-Industrial Parks (0:25 – 0:55)

**Visual concept:**
Three orbiting concept cards animate into view around the cluster:

- **Resource efficiency** — water droplet + arrow loop
- **Industrial symbiosis** — two factories sharing a pipe
- **Circular economy** — three-arrow refresh icon morphing into a closed loop

**Voiceover:**
"Eco-Industrial Parks — or EIPs — are planned industrial areas where firms share infrastructure, exchange by-products, and reduce waste together. They are a recognised model for cleaner production, but the evidence base for Sri Lanka and the wider South Asian context is still thin. That gap is what motivates this work."

**Lower-third caption:**
_A University of Sri Jayewardenepura research programme._

---

## Scene 3 — What: Introducing EIP Insight (0:55 – 1:20)

**Visual concept:**
The cluster collapses into a single browser frame. The home page of the platform fades in. The browser then splits into three identical frames labelled **English / සිංහල / தமிழ்** to dramatise trilingual delivery.

**On-screen pillars (animate in one by one):**

- Trilingual by design
- Save-and-resume responses
- Privacy-preserving aggregation
- Open methodology, auditable engineering

**Voiceover:**
"EIP Insight is the research platform we built to gather that evidence. It runs structured questionnaires in English, Sinhala, and Tamil, so participants can respond in the language they think in — not the one that is most convenient for the research team."

---

## Scene 4 — Who: The Two Survey Phases (1:20 – 1:55)

**Visual concept:**
A horizontal timeline with two large nodes. Each node expands to reveal the topics covered.

**Phase 1 — Industry Profile**

- Sector, scale, location
- Resource and energy use baseline
- Existing environmental practices

**Phase 3 — Detailed EIP Readiness**

- Renewable energy adoption
- Circular economy practices
- Industrial symbiosis opportunities
- Stakeholder views and perceived barriers

**Voiceover:**
"The instrument has two phases. Phase 1 captures who participants are and what they currently do. Phase 3 then probes the deeper questions about renewable energy, circular practices, symbiosis between firms, and stakeholder appetite. Together they map both the present state and the readiness to change."

**Footnote on screen:**
_Most respondents complete a phase in 12–18 minutes._

---

## Scene 5 — How (UX): A Respondent's Journey (1:55 – 2:35)

**Visual concept:**
Mock device frame on the left, animated flow diagram on the right. The flow lights up step-by-step as a stylised cursor moves through the device.

**Five-step animation:**

1. **Land** — Choose language; read plain-language consent.
2. **Consent** — Tick required acknowledgements; optional contact field stays blank by default.
3. **Respond** — Adaptive questions; progress bar; inline validation.
4. **Pause** — A resume link is generated and emailed/copied; valid for 30 days.
5. **Submit** — Confirmation screen; response joins the aggregate.

**Voiceover:**
"Real respondents — managers, engineers, regulators — rarely have a free half-hour. So the survey is built around interruption: you can pause, leave, and come back within thirty days from any device. Consent is explicit, plain-language, and revocable."

---

## Scene 6 — How (Tech): Under The Hood (2:35 – 3:20)

**Visual concept:**
Architecture diagram blooms outward from the device. Components light up as they are named. Keep the diagram clean — five labelled blocks, not thirty.

**Blocks shown:**

- **Web app** — TanStack Start + React 19, server-rendered for speed and accessibility
- **API layer** — Validated request handlers, rate-limited
- **Database** — Supabase Postgres with row-level security
- **Rate limiter** — Redis, cross-replica safe
- **Hosting** — Node.js 24 on Railway

**Voiceover:**
"Under the surface, the platform is a modern, server-rendered web application. Questionnaires, translations, and analytics share a single Postgres database with row-level security policies that determine who can read what. A Redis-backed rate limiter sits in front of submissions to discourage automated abuse without ever blocking a legitimate respondent."

**Caption flash:**
_Built with TanStack Start · React 19 · Supabase · Redis · Railway_

---

## Scene 7 — Trust: Privacy, Ethics, And Anonymity (3:20 – 3:55)

**Visual concept:**
A shield icon forms from four converging lines, each labelled with a safeguard. As each line meets the centre, a tick appears.

**Four safeguards:**

- **Anonymous by default** — No contact details are required.
- **Small-cell masking** — Counts under ten are hidden in public dashboards.
- **Voluntary participation** — Respondents may withdraw at any point.
- **Secure storage** — Encrypted at rest; access governed by role.

**Voiceover:**
"Ethics is not a footer on this project — it is a design constraint. Responses are anonymous unless a participant chooses otherwise. In public-facing dashboards, any group smaller than ten is masked so individual organisations cannot be inferred. Participation is voluntary and revocable, and the consent text is available in all three languages before any question is answered."

---

## Scene 8 — Rigour: Engineering Quality Posture (3:55 – 4:25)

**Visual concept:**
A scoreboard-style grid lights up: green checks marching across categories. Brief, no jargon dump.

**Categories shown:**

- Automated tests (unit, integration, end-to-end)
- Accessibility sweeps (WCAG-aligned)
- Trilingual content checks
- Security review of authentication and data paths
- Continuous integration on every change

**Voiceover:**
"Research data is only as trustworthy as the system that carries it. So every change to this platform passes through automated tests, accessibility checks across all three languages, and a security review of authentication and data paths. The audit log is open to the research team and to supervisors at any time."

---

## Scene 9 — Output: From Responses To Findings (4:25 – 4:55)

**Visual concept:**
A funnel: thousands of small response dots flow downwards, recombine into clean chart shapes — a bar chart, a Sankey-style flow, a regional map — and finally into a stylised thesis chapter icon.

**Voiceover:**
"Every submitted response becomes a row in the project database. From there, we generate codebooks, exportable CSV and Excel datasets, and live dashboards for the research team. The same underlying numbers feed the analytics that supervisors review and the chapters that become the thesis itself — one chain of custody, from respondent to finding."

**Caption:**
_Codebooks · CSV / XLSX exports · Researcher dashboards · Thesis-ready analytics_

---

## Scene 10 — Close: Invitation And Gratitude (4:55 – 5:20)

**Visual concept:**
Return to the trilingual home-page frame. Three call-to-action chips fade in beneath it.

**On-screen chips:**

- _Take the survey_
- _Read the consent text_
- _Contact the research team_

**Voiceover:**
"If you work in industry, in policy, or alongside the firms that will shape the region's next industrial decade, your perspective is the missing piece. Thank you for the time, the candour, and the supervision that make this work possible."

**Final card:**

> **EIP Insight**
> A research platform for Eco-Industrial Park development in Sri Lanka and South Asia.
> University of Sri Jayewardenepura · 2026

---

## Production Notes

### Visual language

- **Palette:** Earth-green, slate, and a single warm accent. Avoid stock "eco" clichés (leaves, globes).
- **Typography:** One humanist sans for body; a single serif for pull-quotes only.
- **Motion:** Calm, deliberate easing. No bouncy springs — this is research, not advertising.
- **Iconography:** Line-art, two-weight system, consistent corner radius.

### Narration

- Single narrator, neutral South Asian English accent preferred for primary cut.
- Provide Sinhala and Tamil dubs of the same script as alternate tracks once the English cut is locked.
- Pace: ~140 words per minute; leave breathing room between scenes.

### Accessibility

- Burned-in captions in all three languages, selectable.
- All on-screen text meets WCAG AA contrast against its background.
- Audio description track for visually-impaired viewers describes the key diagrams in Scenes 5, 6, and 9.
- Provide a transcript file alongside the video on the "More info" page.

### Assets to reuse from the platform

- Architecture diagram (`src/about/diagrams/architecture-overview.mmd`)
- Survey write-path diagram (`src/about/diagrams/survey-write-path.mmd`)
- Trilingual content pipeline (`src/about/diagrams/i18n-pipeline.mmd`)
- Sample flow diagram component (participant pathway)
- Phase timeline content (Phase 1 and Phase 3 instruments)

Rendering these as motion graphics — rather than re-drawing — keeps the video honest to the system it describes.

### What to omit

- Personal names of individual researchers (the consent page and contact form already carry these).
- Funding, institutional crests, or branding not yet approved for public use.
- Preliminary findings — the video describes the _instrument_, not its _results_.

---

_End of outline._
