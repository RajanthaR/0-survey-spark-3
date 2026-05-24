import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const navigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: unknown) => config,
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("lucide-react", () => ({
  Loader2: () => <span data-testid="loader" />,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "u1" } } } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { ResetPasswordPage } from "@/routes/reset-password";

describe("reset password form labels", () => {
  it("associates password inputs with explicit labels", async () => {
    render(<ResetPasswordPage />);

    const newPassword = (await screen.findByLabelText("New password")) as HTMLInputElement;
    const confirmPassword = screen.getByLabelText("Confirm password") as HTMLInputElement;

    expect(newPassword.id).toBe("new-password");
    expect(confirmPassword.id).toBe("confirm-password");
    expect(newPassword.type).toBe("password");
    expect(confirmPassword.type).toBe("password");
  });
});
