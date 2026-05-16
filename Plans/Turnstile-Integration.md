# Cloudflare Turnstile on the Consent Screen

Guide for wiring Turnstile bot-protection on the survey consent step and
verifying the token server-side in `startResponse` before any row is written
to `responses`.

## 1. Provision keys in Cloudflare

1. Cloudflare Dashboard → **Turnstile** → **Add site**.
2. Hostnames: add the preview, staging, production, and custom domains.
3. Widget mode: **Managed** (recommended). Pre-clearance off.
4. Copy the two values:
   - **Site Key** → public, ships in client bundle.
   - **Secret Key** → server-only, never shipped.

## 2. Configure secrets

| Name                      | Where                         | Scope                                         |
| ------------------------- | ----------------------------- | --------------------------------------------- |
| `VITE_TURNSTILE_SITE_KEY` | Workspace → **Build Secrets** | Build-time, embedded in client bundle by Vite |
| `TURNSTILE_SECRET`        | Deployment provider secrets   | Runtime, server functions only                |

The site key MUST use the `VITE_` prefix or it will be `undefined` in the
browser. The secret MUST NOT use `VITE_` or it will leak into the client bundle.

## 3. Client: render the widget on the consent screen

Install the official React wrapper:

```bash
bun add @marsidev/react-turnstile
```

In `src/components/survey/OptionalConsentPanel.tsx` (or the consent step
container, wherever the user clicks "Start"):

```tsx
import { Turnstile } from "@marsidev/react-turnstile";

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
const [tsToken, setTsToken] = useState<string | null>(null);

{
  siteKey && (
    <Turnstile
      siteKey={siteKey}
      options={{ theme: "auto", action: "start-survey" }}
      onSuccess={setTsToken}
      onExpire={() => setTsToken(null)}
      onError={() => setTsToken(null)}
    />
  );
}

<Button disabled={!!siteKey && !tsToken} onClick={() => onStart({ turnstileToken: tsToken })}>
  {t("survey.start")}
</Button>;
```

Notes:

- Gate the **Start** button on `tsToken` only when `siteKey` is configured,
  so local/dev environments without a key still work.
- The token is single-use and expires after ~5 minutes — request it on the
  consent screen, consume it immediately in `startResponse`.
- Rotate the token on `onExpire` so users who linger don't submit a stale one.

## 4. Server: verify in `startResponse` before insert

Edit `src/lib/responses.functions.ts`:

```ts
const StartInput = z.object({
  surveySlug: z.string().min(1).max(64),
  language: z.enum(["en", "si", "ta"]).default("en"),
  consent: z.record(z.string().max(64), z.boolean()).default({}),
  userAgent: z.string().max(500).optional(),
  turnstileToken: z.string().min(10).max(2048).optional(),
});

async function verifyTurnstile(token: string | undefined, ip: string) {
  const secret = process.env.TURNSTILE_SECRET;
  if (!secret) return; // not configured → skip (dev/preview)
  if (!token) throw new Error("Captcha required");

  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
  });
  const json = (await res.json()) as {
    success: boolean;
    "error-codes"?: string[];
    action?: string;
    hostname?: string;
  };
  if (!json.success) {
    throw new Error(`Captcha failed: ${(json["error-codes"] ?? ["unknown"]).join(",")}`);
  }
  // Optional defence-in-depth:
  // if (json.action !== "start-survey") throw new Error("Captcha action mismatch");
}

export const startResponse = createServerFn({ method: "POST" })
  .inputValidator((data) => StartInput.parse(data))
  .handler(async ({ data }) => {
    const ip = getClientIp();
    rateLimit(ip, { name: "startResponse", capacity: 30, windowMs: 10 * 60 * 1000 });
    await verifyTurnstile(data.turnstileToken, ip); // BEFORE insert

    const { data: row, error } = await supabaseAdmin
      .from("responses")
      .insert({
        survey_slug: data.surveySlug,
        language: data.language,
        consent: data.consent,
        user_agent: data.userAgent ?? null,
      })
      .select("id, resume_token")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Failed to start");
    return { id: row.id, resumeToken: row.resume_token };
  });
```

Critical order: **rate-limit → verify Turnstile → insert**. Verifying after
the insert defeats the purpose; verifying before the rate-limit lets bots
burn your Turnstile quota.

`saveAnswers` and `submitResponse` do NOT need re-verification — they are
already gated by possession of the unguessable `resume_token` issued by
`startResponse`.

## 5. Wire the token through the call site

In `SurveyRunner.tsx` where `startResponse` is invoked, pass the token from
the consent panel through:

```ts
await startResponseFn({
  data: {
    surveySlug,
    language,
    consent,
    userAgent: navigator.userAgent,
    turnstileToken,
  },
});
```

## 6. Tests

Add to `src/lib/__tests__/responses.turnstile.test.ts`:

- With `TURNSTILE_SECRET` unset → `startResponse` succeeds without a token (dev path).
- With secret set + missing token → throws `"Captcha required"`.
- With secret set + `fetch` mocked to `{ success: false, "error-codes": ["invalid-input-response"] }` → throws `"Captcha failed: invalid-input-response"`.
- With secret set + `{ success: true }` → row is inserted; siteverify called with `secret`, `response`, `remoteip` form fields.
- Verify siteverify is called **before** any `supabaseAdmin.from("responses").insert`.

## 7. Rollout checklist

- [ ] Site key added to Workspace Build Secrets as `VITE_TURNSTILE_SITE_KEY`.
- [ ] Secret added to the deployment provider as `TURNSTILE_SECRET`.
- [ ] Cloudflare site allowlist includes preview + published hostnames.
- [ ] Consent screen renders widget; Start button disabled until solved.
- [ ] `startResponse` verifies token before insert; rejects on failure.
- [ ] Tests cover unset-secret, missing-token, invalid-token, valid-token paths.
- [ ] `Changelog.md` entry: "A2 Turnstile wired on consent + server-verified".

## 8. Operational notes

- **Failure mode**: if Cloudflare siteverify is down, every `startResponse`
  fails. Acceptable trade-off; the alternative (fail-open) lets bots through
  during outages. If you want fail-open, log loudly and gate behind a
  `TURNSTILE_FAIL_OPEN=1` env flag.
- **Token reuse**: Cloudflare rejects a token used twice. The single
  `startResponse` call consumes it; do not store or retry with the same token.
- **Privacy**: Turnstile is privacy-preserving (no cookies, no fingerprinting
  in Managed mode). Safe to enable without a consent banner update.
- **i18n**: the widget auto-detects locale; pass `options={{ language: lang }}`
  to force `en` / `si` / `ta` (Sinhala/Tamil fall back to English in the
  widget UI but the surrounding labels are yours).
