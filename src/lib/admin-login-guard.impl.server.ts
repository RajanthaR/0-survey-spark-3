import { createClient, type Session } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getClientIp, peekRateLimit, rateLimit } from "@/lib/rate-limit.server";

export type AdminGuardData = {
  email: string;
  outcome: "check" | "fail";
};

export type AdminSignInData = {
  email: string;
  password: string;
};

const ADMIN_LOGIN_LIMIT = {
  name: "adminLogin",
  capacity: 5,
  windowMs: 15 * 60 * 1000,
};

function lockoutResponse(retrySec: number) {
  return new Response("Too many sign-in attempts", {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, retrySec)) },
  });
}

export function adminLoginGuardImpl(data: AdminGuardData, ip = getClientIp()) {
  const key = `${data.email}|${ip}`;
  if (data.outcome === "check") {
    const snapshot = peekRateLimit(key, ADMIN_LOGIN_LIMIT);
    if (snapshot.tokens < 1) {
      throw lockoutResponse(snapshot.retrySec);
    }
    return { ok: true };
  }

  rateLimit(key, ADMIN_LOGIN_LIMIT);
  return { ok: true };
}

function createServerAuthClient() {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function adminPasswordSignInImpl(
  data: AdminSignInData,
  ip = getClientIp(),
): Promise<{
  session: Pick<Session, "access_token" | "refresh_token" | "expires_at" | "token_type">;
}> {
  adminLoginGuardImpl({ email: data.email, outcome: "check" }, ip);

  const auth = createServerAuthClient();
  const { data: result, error } = await auth.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error || !result.session) {
    try {
      adminLoginGuardImpl({ email: data.email, outcome: "fail" }, ip);
    } catch {
      throw lockoutResponse(ADMIN_LOGIN_LIMIT.windowMs / ADMIN_LOGIN_LIMIT.capacity / 1000);
    }
    throw new Error("Invalid email or password.");
  }

  return {
    session: {
      access_token: result.session.access_token,
      refresh_token: result.session.refresh_token,
      expires_at: result.session.expires_at,
      token_type: result.session.token_type,
    },
  };
}
