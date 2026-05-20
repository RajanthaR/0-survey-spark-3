# UX Patterns

## Error Rendering Policy

Use one rendering pattern per severity:

- Validation errors: persistent in-page banners with `role="alert"`. Keep the message close to the field or step that needs correction, and move focus to the next useful control when possible.
- Retryable network or persistence errors: toast notifications. These include manual save, final submit, export, copy, and transient server failures where the user can retry without losing context.
- Irrecoverable route or SSR failures: full-page error states. These should preserve the active language, include a retry action when useful, and provide a path home.

Do not use a toast as the only signal for validation. Do not use an inline banner for routine background or retryable network failures unless the user must read it before continuing.

## Language And Accessibility

- Public respondent routes must render from localized `UI` or survey dictionaries.
- Route-level pages should expose a stable `#main` target for the global skip link.
- Icon-only controls need an accessible name; when space allows at `sm:` and above, show visible text as well.
- Choice controls should announce both the value and the localized label.

## Translator Review

Best-effort Sinhala and Tamil copy may ship behind automated completeness checks, but any copy introduced without human translator review should be captured in the Phase 5 accessibility or translation review notes.
