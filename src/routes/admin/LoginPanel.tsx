import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { adminPasswordSignIn } from "@/lib/admin-login-guard.functions";

import { CenteredCard } from "./primitives";

/**
 * Admin sign-in / sign-up / forgot-password panel. Extracted from
 * admin.tsx (D19) so the route file stops growing past the Dashboard
 * orchestrator. Password sign-in runs through a server function so the
 * app path cannot skip the per-email+IP lockout guard.
 */
export function LoginPanel() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const signInFn = useServerFn(adminPasswordSignIn);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { session } = await signInFn({ data: { email, password: pw } });
        const { error } = await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
        if (error) {
          throw error;
        }
      } else if (mode === "up") {
        const { error } = await supabase.auth.signUp({
          email,
          password: pw,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to confirm before signing in.");
        setMode("in");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If an account exists, a password reset email has been sent.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const isForgot = mode === "forgot";
  return (
    <CenteredCard>
      <h1 className="text-xl font-semibold">{isForgot ? "Reset password" : "Admin access"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {isForgot ? (
          "Enter your email — we'll send a reset link."
        ) : (
          <>
            Sign in with the email configured as{" "}
            <code className="rounded bg-muted px-1">ADMIN_BOOTSTRAP_EMAIL</code>.
          </>
        )}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <Label>Email</Label>
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {!isForgot && (
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>
        )}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : mode === "in" ? (
            "Sign in"
          ) : mode === "up" ? (
            "Create account"
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>
      <div className="mt-3 flex flex-col gap-1 text-center text-xs text-muted-foreground">
        {mode !== "in" && (
          <button type="button" onClick={() => setMode("in")} className="underline">
            Back to sign in
          </button>
        )}
        {mode === "in" && (
          <>
            <button type="button" onClick={() => setMode("up")} className="underline">
              Need to create the admin account?
            </button>
            <button type="button" onClick={() => setMode("forgot")} className="underline">
              Forgot password?
            </button>
          </>
        )}
      </div>
    </CenteredCard>
  );
}
