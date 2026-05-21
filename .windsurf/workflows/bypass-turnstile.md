---
description: Temporarily bypass Cloudflare Turnstile for non-production testing
---

# Bypass Turnstile For Testing

Use this workflow only for local, preview, or staging-style testing when Cloudflare Turnstile blocks manual QA. Do **not** enable the bypass on production.

The app has two relevant server-side behaviors:

- If `TURNSTILE_SECRET` is unset, `verifyTurnstile` fail-opens for development/preview use.
- If `ALLOW_TURNSTILE_BYPASS=true`, the server honours the client preview bypass request.
- If `APP_ENV=production` or `NODE_ENV=production`, `assertProductionSecurityConfig` rejects `ALLOW_TURNSTILE_BYPASS=true` and requires `TURNSTILE_SECRET`.

## Disable Turnstile Locally

1. Open your local `.env` file.
2. Temporarily unset or comment out the real secret:

```env
# TURNSTILE_SECRET=
```

3. Optionally enable the explicit preview bypass path:

```env
ALLOW_TURNSTILE_BYPASS=true
```

4. Keep local environment non-production:

```env
APP_ENV=development
NODE_ENV=development
```

5. Start the app:

```bash
bun run dev
```

6. Test the survey flow. If the UI shows the preview-only bypass button after a verification failure, use it only for QA.

## Disable Turnstile On A Railway Preview/Test Service

Only do this on a non-production Railway environment or a temporary test service.

1. Confirm the target service is not production traffic.
2. Set environment to staging or preview, not production:

```bash
railway variable set --service <service-name> APP_ENV=staging NODE_ENV=staging
```

3. Enable the bypass:

```bash
railway variable set --service <service-name> ALLOW_TURNSTILE_BYPASS=true
```

4. Either leave `TURNSTILE_SECRET` set to exercise the explicit bypass path, or remove it to test fail-open behavior in non-production only.

5. Redeploy the test service:

```bash
railway up --service <service-name>
```

6. Run the browser QA flow and confirm any test rows are marked as preview bypass where applicable.

## Re-enable Turnstile Locally

1. Restore the real secret:

```env
TURNSTILE_SECRET=<real-secret>
```

2. Disable bypass:

```env
ALLOW_TURNSTILE_BYPASS=false
```

3. Restart the local server.

4. Verify the survey requires and accepts a real Turnstile token.

## Re-enable Turnstile On Railway

1. Restore production-like environment values:

```bash
railway variable set --service <service-name> ALLOW_TURNSTILE_BYPASS=false
railway variable set --service <service-name> TURNSTILE_SECRET=<real-secret>
```

2. For production, ensure these are set:

```bash
railway variable set --service <service-name> APP_ENV=production NODE_ENV=production
```

3. Redeploy:

```bash
railway up --service <service-name>
```

4. Run the deploy preflight where the required environment variables are available:

```bash
bun run deploy:preflight
```

5. Browser-test `/s/phase-1` and confirm:

- The Turnstile widget appears.
- The challenge completes on the active hostname.
- The survey starts without `missing-input-response`, `invalid-input-response`, or CSP errors.
- `ALLOW_TURNSTILE_BYPASS` is not `true` in production.

## Safety Checklist

Before shipping or sending public traffic, verify:

- `ALLOW_TURNSTILE_BYPASS=false`
- `TURNSTILE_SECRET` is set
- `VITE_TURNSTILE_SITE_KEY` is set
- Turnstile allowed hostnames include the deployed domains
- `APP_ENV=production` and `NODE_ENV=production` for production
- `bun run deploy:preflight` passes
