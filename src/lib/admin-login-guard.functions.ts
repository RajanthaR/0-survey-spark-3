import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Per email+IP failure counter for admin login. The bucket only loses a
 * token when we're told a sign-in *failed* — successful sign-ins do not
 * consume capacity. 5 fails / 15 min triggers a generic lockout.
 */
const AdminGuardInput = z.object({
  email: z.string().email().max(200).toLowerCase(),
  outcome: z.enum(["check", "fail"]),
});

const AdminSignInInput = z.object({
  email: z.string().email().max(200).toLowerCase(),
  password: z.string().min(1).max(500),
});

export const adminLoginGuard = createServerFn({ method: "POST" })
  .inputValidator((data) => AdminGuardInput.parse(data))
  .handler(async ({ data }) => {
    const { adminLoginGuardImpl } = await import("@/lib/admin-login-guard.impl.server");
    return adminLoginGuardImpl(data);
  });

export const adminPasswordSignIn = createServerFn({ method: "POST" })
  .inputValidator((data) => AdminSignInInput.parse(data))
  .handler(async ({ data }) => {
    const { adminPasswordSignInImpl } = await import("@/lib/admin-login-guard.impl.server");
    return adminPasswordSignInImpl(data);
  });
