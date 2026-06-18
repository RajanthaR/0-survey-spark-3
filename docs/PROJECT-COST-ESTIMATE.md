# EIP Insight — Platform Value, Terms & Capability Overview

**Prepared for:** University of Sri Jayewardenepura — Eco-Industrial Park (EIP) PhD research team
**Subject:** Platform value estimate, engagement terms, and a capability overview of the EIP Insight survey platform
**Status:** Draft v1 (for review)

---

## 1. Content Policy

### 1.1 Confidentiality

All study content that is not explicitly designated for public release — including questionnaire design, internal materials, configuration, analytics, and any data collected through the platform — is treated as **confidential** and is bound by a **mutual non-disclosure agreement** between the platform and the study team. Neither party will disclose the other's confidential information to third parties without written consent.

Material that is intentionally published as part of the study (for example, the public "About this research" pages and any results the research team chooses to release) is exempt from this clause.

### 1.2 Analytics & output customisation

The analytics, dashboards, exports, and reporting outputs are not fixed. The study team may **request adjustments and fine-tuning** of these outputs so they align with the study's specific goals, hypotheses, and analysis plan. Such requests are scoped and scheduled with the platform team.

---

## 2. Platform Value Estimation

### 2.1 Purpose of this estimate

The figures in this section exist to give the research team **clarity on the monetary value of the platform engine** — what an equivalent system would cost to commission on the open market. They are a **replacement / market value**, _not_ the amount being invoiced for this study. The actual commercial terms for this engagement are set out in **Section 3**.

### 2.2 What the platform actually is

This is a production-grade, full-stack web application — not a templated form builder. Measured scope:

- **~29,500 lines** of application code
- **~19,000 lines** of automated tests across **132 test files**
- **15** database migration / security-policy files
- **5** continuous-integration / deployment pipelines
- Trilingual content (English, Sinhala, Tamil) throughout

### 2.3 Full feature list

**Respondent-facing survey experience**

- Multi-phase questionnaire engine (Phase 1: 39 questions; Phase 3: 51 questions)
- Trilingual interface (English / Sinhala / Tamil) with **live, in-place language switching** that never loses the respondent's place or input
- One-question-per-screen flow optimised for focus and completion
- **Conditional logic** — questions appear/hide based on previous answers
- Specialised question types: single-choice, multi-choice (with min/max selection), Likert-5 with icons, yes/no, short/long text, email, telephone, number range, geographic input, "Other" free-text, and a purpose-built **AHP / Saaty pairwise comparison** (Multi-Criteria Decision Making) question
- **Auto-advance** after a tapped answer on simple questions
- **Swipe navigation** between questions on touch devices
- **Auto-save** with debounced writes and a **resume-by-link token** so respondents can leave and return
- Inline validation with clear, localised error messaging
- Progress indicator, "skipped" awareness, and a final **review-and-edit** screen before submission
- Consent capture (required and optional permissions) aligned to research ethics approval

**Accessibility & quality**

- WCAG-oriented accessibility: full keyboard navigation, focus management, screen-reader announcements, ARIA roles on every interactive element
- `prefers-reduced-motion` support across all animation
- Automated accessibility scans (axe) and performance budgets (Lighthouse: LCP, TTI, CLS thresholds) enforced in CI

**Researcher / admin platform**

- Authenticated admin dashboard
- Response analytics and reporting
- **Drop-off analysis** with per-question drill-down
- Alerting / anomaly detection panel
- Data exports: **CSV** (localised), **XLSX**, and an auto-generated **codebook** for analysis tools
- Bot/spam protection and abuse rate-limiting on submissions

**Public credibility surfaces**

- An "About this research" explorer (Study, Research, Engineering, Presentation lanes)
- Shared visual identity ("Living Landscape") across all public pages

**Backend, infrastructure & operations**

- Supabase (PostgreSQL + authentication) with row-level security policies
- Server-side rendering (SSR) for fast first paint and SEO
- Redis-backed rate limiting (with safe in-memory fallback)
- Cloudflare Turnstile bot protection
- Deployed as a Node.js service on Railway with reproducible build pipeline
- 5 CI/CD workflows: type-checking, linting, formatting, unit/integration tests, accessibility, performance, security checks, build, and a deploy-gate smoke test
- Security review, deployment runbooks, and migration documentation

### 2.4 Equivalent professional effort

Rebuilding this to the same standard — including the test suite, accessibility, security hardening, and CI/CD — represents roughly:

> **700–1,000 hours (~4.5–6.5 person-months)** of skilled full-stack work.

### 2.5 Market cost comparison

| Market tier                        | Freelancer                                                 | Agency                                                               |
| ---------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- |
| **Local (Sri Lanka / South Asia)** | **$10,000 – $28,000**<br/>1 senior dev @ $15–35/hr         | **$25,000 – $60,000**<br/>team + PM/QA overhead                      |
| **Global marketplace** (mid-tier)  | **$25,000 – $55,000**<br/>@ $35–70/hr                      | **$50,000 – $120,000**<br/>India / E. Europe shop, blended $40–80/hr |
| **Premium / Western**              | **$65,000 – $120,000**<br/>senior independent @ $90–150/hr | **$150,000 – $400,000+**<br/>US/UK/EU boutique, blended $120–250/hr  |

### 2.6 Why the agency–freelancer gap exists

**An agency typically costs 2–3× a freelancer for the same scope** because the price includes a business and a team, not just code: a project manager, a separate QA function, design, account management, contracts, a support/warranty SLA, and company margin. In return you get lower delivery risk, redundancy if a person leaves, and formal accountability.

**A freelancer is cheaper but concentrates risk:** a single point of failure and highly variable engineering discipline. The depth visible here — comprehensive automated testing, accessibility compliance, security hardening, and CI/CD — is **not** typical of budget freelancers. That level of polish usually comes only from a senior independent (top of the freelancer range) or an agency.

---

## 3. Commercial Model for This Engagement

The market values in Section 2 are **not** what this study is being charged. The actual terms are deliberately favourable, because this is the **first study launched on the platform**:

- **No charge for developer time, and no markup is added.** The study is not billed for engineering labour or profit margin.
- This study pays only a **portion of the platform's development cost.** The total USD outlay spent building the platform engine is **shared across the first five studies** that launch on it — this study carries one share, not the whole cost.
- The platform engine will be **refined using feedback from those first five studies.** Early studies therefore both benefit from and contribute to the platform's maturity, which is reflected in the reduced cost.
- Study-specific work (white-labelling, database design for the study's requirements, and any requested analytics customisation) is in addition to the shared platform-cost portion, and is likewise provided without a labour markup for this engagement.

In short: the research team receives a platform with a market value in the tens of thousands of dollars, while contributing only a fair share of its real development cost.

---

## 4. Platform & Study Separation, Data Ownership and Responsibility

### 4.1 The platform engine and each study are completely separate

The **platform engine** is the reusable system described in this document. Each **study** is an independent deployment built on top of it. The two are kept strictly separate.

### 4.2 Data isolation and ownership

- **No study data is stored within the platform engine.** All data collected by a study is stored in a **Supabase database provisioned uniquely for that study.**
- The platform is **white-labelled** to fit each study's identity, and the database schema is **designed around that study's specific requirements.**
- The study's data belongs to the study. It lives in the study's own database, isolated from the platform and from every other study.

### 4.3 Database access

- The **lead researcher is granted admin access** to the study's database, with full **read / write / edit** privileges.
- Because the database schema is tightly coupled to the front end, **any structural database change must be coordinated with the platform developers** — the developers can and will intervene to make required changes safely, so that the survey interface is not broken by an unmanaged schema edit.

### 4.4 Credential responsibility

- The lead researcher **must not share the database admin credentials** with others.
- The admin credentials carry full write/edit/delete power. **Data loss or corruption resulting from mishandling of the admin credentials is the responsibility of the credential holder, not the platform.**

### 4.5 Optional: read-only dashboard with managed backups

- For an **additional cost**, the study's data can be exposed through a **read-only dashboard**, giving the team safe visibility into the data without risk of accidental modification.
- Under this option, the data is **periodically backed up** and can be **restored in the event of data loss** — providing a recovery safety net that the admin-credential-only arrangement does not include.

---

## 5. Tech Stack Decisions

| Layer                    | Choice                                                               | Why it was chosen                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Language**             | TypeScript                                                           | Type safety across a large codebase reduces runtime bugs and makes the survey/question models self-documenting.                                                          |
| **UI framework**         | React + TanStack Start (SSR) + TanStack Router                       | Server-side rendering gives fast first paint on low-end mobile devices and slow networks — critical for field respondents. Type-safe routing keeps the app maintainable. |
| **Styling / components** | Tailwind CSS + shadcn/ui (Radix primitives)                          | Accessible-by-default component primitives and a utility system that makes a consistent, mobile-first design fast to build and easy to keep uniform.                     |
| **Animation**            | Framer Motion (with reduced-motion support)                          | Smooth, purposeful transitions that respect accessibility preferences.                                                                                                   |
| **Backend / data**       | Supabase (PostgreSQL + Auth)                                         | Managed Postgres with row-level security and built-in auth — enterprise-grade data integrity without standing up bespoke infrastructure.                                 |
| **Bot protection**       | Cloudflare Turnstile                                                 | Protects research data quality from automated/spam submissions without harming the respondent experience (no puzzle CAPTCHAs).                                           |
| **Rate limiting**        | Redis (token bucket) with in-memory fallback                         | Prevents abuse of the public submission endpoint while degrading gracefully in local/test environments.                                                                  |
| **Hosting**              | Railway (Node.js service)                                            | Simple, reproducible deployments with environment isolation for staging vs. production.                                                                                  |
| **Tooling**              | Vite + Bun                                                           | Fast builds and installs, keeping the development feedback loop tight.                                                                                                   |
| **Quality gates**        | Vitest, Testing Library, Playwright, axe, Lighthouse, GitHub Actions | Automated correctness, accessibility, and performance checks on every change — the difference between a prototype and a research instrument that can be trusted.         |

The overarching principle: **choose managed, well-supported, accessible-by-default tools** so engineering effort goes into the research-specific experience rather than reinventing infrastructure.

---

## 6. Reasoning Behind the Features

Every major feature traces back to a research objective — chiefly **maximising response rate, completion rate, and data quality** among a hard-to-reach audience: technical officers at industrial sites across South Asia.

- **Trilingual, live-switchable content** — respondents span Sinhala-, Tamil-, and English-speaking regions. Letting them switch language mid-survey without losing progress removes a major barrier to participation and reduces language-driven misinterpretation of questions.
- **One question per screen + conditional logic** — reduces cognitive load and skips irrelevant questions, shortening the _perceived_ length of the survey and lowering abandonment.
- **Auto-save + resume link** — field respondents are interrupted. Persisting progress and allowing return-by-link prevents lost responses, the single biggest source of wasted recruitment effort.
- **The AHP / Saaty pairwise question** — the research uses Multi-Criteria Decision Making (MCDM). A faithful, forced-choice pairwise comparison with a strength rating is methodologically required; a generic survey tool cannot produce analytically valid AHP data.
- **Drop-off analytics + alerting** — tells the research team _where_ respondents quit, so the instrument can be improved during the study rather than after it.
- **Structured exports + codebook** — data lands in the exact shape statistical tools expect, saving the researcher substantial manual data-cleaning time.
- **Bot protection + rate limiting** — protect the integrity of the dataset, which is the entire point of the exercise.

---

## 7. Mobile-Friendly / Thumb-Friendly Approach and Its Impact

The platform is designed **mobile-first and thumb-first**, on the assumption that most respondents complete it on a phone, often one-handed, in a noisy industrial environment.

**Design choices**

- **Large tap targets** — primary answer options and controls use generously sized touch areas (well above the minimum recommended), reducing mis-taps.
- **Bottom-anchored, sticky navigation** — the primary "Next", "Back", and "Save & Exit" controls sit at the bottom of the screen, **within natural thumb reach**, instead of at the top where they'd require a hand reposition.
- **Swipe navigation** — respondents can swipe between questions, matching the gesture vocabulary people already use on their phones.
- **One question per screen** — no pinch-zoom or horizontal scrolling; each step fits the viewport.
- **Auto-advance** (see Section 8) — removes an entire tap from the most common question types.

**Impact**

- **Fewer taps and less hand movement per question** → faster completion and less fatigue.
- **Lower mis-tap and error rates** → cleaner data and fewer corrections.
- **Lower abandonment**, especially on long instruments (39–51 questions), because the survey _feels_ effortless on the device respondents actually use.

In short, thumb-friendliness is not cosmetic — for a long field survey it directly protects completion rate and therefore the size and quality of the dataset.

---

## 8. Auto-Advance After Answers

For the most common question types (single-choice and yes/no), selecting an answer **automatically advances** to the next question after a brief, deliberate delay (half a second).

**How it works and why it's careful**

- It triggers **only on a tap/pointer selection** of single-answer questions — never on keyboard input. This preserves full keyboard and screen-reader accessibility, where the user remains in control of navigation.
- The short delay lets the respondent **see their selection register** before the screen moves, avoiding a jarring or accidental jump.
- It does **not** apply to questions where the respondent might add more (multi-select, text, the pairwise rating step), so it never rushes them past an incomplete answer.

**Impact**

- Removes one full interaction (the "Next" tap) from the majority of questions, which compounds meaningfully across a 39–51 question survey.
- Keeps **momentum** — the experience feels quick and responsive, which is strongly associated with higher completion rates.
- Balances speed with control: it accelerates the easy questions without ever overriding the respondent's intent on the complex ones.

---

## 9. The "About the Research" Section

The platform includes a dedicated **"About this research"** area — an explorer organised into focused lanes.

> **Access control:** This section is **protected behind a 4-digit access code.** Opening it presents a public summary of what the area contains alongside a code-entry screen with an **on-screen numerical keypad**. The full lane content is revealed only after the correct code is entered. This keeps internal context (engineering notes, research method detail) available to invited stakeholders without exposing it to anonymous survey respondents.

The lanes are:

- **Study** — what the research is about and what participation involves.
- **Research** — the academic framework, sampling approach, and ethics basis.
- **Engineering** — how the platform itself was built (architecture and decisions).
- **Presentation** — a stakeholder-facing summary deck.

**Why it matters**

- **Trust and transparency** — industrial respondents are more willing to share data when they can see who is behind the research, its purpose, and how their data will be handled.
- **Ethics and credibility** — it surfaces the confidentiality commitments and ethics approval, reinforcing the consent step.
- **Stakeholder communication** — gives supervisors, funders, and partner institutions a single, professional reference point for the project.

It shares the same polished visual identity as the rest of the platform, signalling that this is a serious, well-run study — which itself improves participation.

---

## 10. Recent Platform Updates

The five most recent engineering updates to the platform (documentation-only changes excluded):

| Date (committed) | Update                                      | Description                                                                        |
| ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-06-16 15:14 | Address pairwise map review feedback        | Refined the AHP pairwise comparison question following review feedback.            |
| 2026-06-16 11:19 | Move pairwise comparisons into main flow    | Integrated the pairwise (AHP) comparisons directly into the main survey flow.      |
| 2026-06-16 09:19 | Respect optional pairwise footer navigation | Made the survey footer navigation behave correctly for the optional pairwise step. |
| 2026-06-16 09:06 | Refine pairwise navigation UX               | Improved the navigation experience within the pairwise question.                   |
| 2026-06-13 11:34 | Address Q28 review feedback                 | Addressed review feedback on the Q28 paired selection-and-rating question.         |

---

_Draft for review. Market-value figures are estimates as of 2026 and will vary with provider, region, and exact scope; they represent replacement value and are not the amount charged for this study (see Section 3)._
