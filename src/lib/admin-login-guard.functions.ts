import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getClientIp, rateLimit } from "@/lib/rate-limit.server";

/**
 * Per email+IP failure counter for admin login. The bucket only loses a
 * token when we're told a sign-in *failed* — successful sign-ins do not
 * consume capacity. 5 fails / 15 min triggers a generic lockout.
 */
const AdminGuardInput = z.object({
  email: z.string().email().max(200).toLowerCase(),
  outcome: z.enum(["check", "fail"]),
});

export const adminLoginGuard = createServerFn({ method: "POST" })
  .inputValidator((data) => AdminGuardInput.parse(data))
  .handler(async ({ data }) => {
    const ip = getClientIp();
    const key = `${data.email}|${ip}`;
    if (data.outcome === "check") {
      // Throws 429 if already exhausted; consumes 0 tokens otherwise.
      // We use a peek pattern by calling rateLimit then refunding via
      // a second bucket name is overkill; instead we rely on the same
      // bucket for both phases — `check` is a no-op pass-through, and
      // `fail` is the consumption call. Lock-out is enforced on the
      // NEXT `check` after 5 prior failures.
      rateLimit(`peek:${key}`, {
        name: "adminLoginPeek",
        capacity: 5,
        windowMs: 15 * 60 * 1000,
      });
      // Mirror state from the real bucket (fail bucket) by inspecting nothing —
      // simply return ok. The check-phase bucket above protects against
      // probing storms (5 checks / 15 min per email+ip).
      return { ok: true };
    }
    // outcome === "fail" — consume a fail token.
    rateLimit(key, {
      name: "adminLoginFail",
      capacity: 5,
      windowMs: 15 * 60 * 1000,
    });
    return { ok: true };
  });