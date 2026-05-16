/**
 * Admin auth server functions. Extracted from admin.functions.ts (D21).
 * Helpers (assertAdmin) live in admin.shared.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const adminBootstrap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (existing) return { isAdmin: true, bootstrapped: false };

    const allowedEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? "").trim().toLowerCase();
    const userEmail = (context.claims?.email as string | undefined)?.trim().toLowerCase();
    if (!allowedEmail || !userEmail || userEmail !== allowedEmail) {
      return { isAdmin: false, bootstrapped: false };
    }

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) return { isAdmin: false, bootstrapped: false };

    await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "admin" });
    return { isAdmin: true, bootstrapped: true };
  });
