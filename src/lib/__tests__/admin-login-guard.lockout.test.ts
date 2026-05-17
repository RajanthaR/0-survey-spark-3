import { beforeEach, describe, expect, it } from "vitest";

import { adminLoginGuardImpl } from "@/lib/admin-login-guard.impl.server";
import { __resetRateLimitForTests } from "@/lib/rate-limit.server";

const email = "admin@example.com";
const ip = "203.0.113.10";

beforeEach(() => {
  __resetRateLimitForTests();
});

describe("adminLoginGuardImpl", () => {
  it("locks out checks after 5 failed sign-in reports for the same email and IP", async () => {
    for (let i = 0; i < 5; i += 1) {
      await expect(adminLoginGuardImpl({ email, outcome: "fail" }, ip)).resolves.toEqual({
        ok: true,
      });
    }

    await expect(adminLoginGuardImpl({ email, outcome: "check" }, ip)).rejects.toBeInstanceOf(
      Response,
    );
  });

  it("does not consume capacity when checking", async () => {
    for (let i = 0; i < 10; i += 1) {
      await expect(adminLoginGuardImpl({ email, outcome: "check" }, ip)).resolves.toEqual({
        ok: true,
      });
    }

    for (let i = 0; i < 5; i += 1) {
      await expect(adminLoginGuardImpl({ email, outcome: "fail" }, ip)).resolves.toEqual({
        ok: true,
      });
    }
    await expect(adminLoginGuardImpl({ email, outcome: "check" }, ip)).rejects.toBeInstanceOf(
      Response,
    );
  });

  it("tracks different IPs independently", async () => {
    for (let i = 0; i < 5; i += 1) {
      await adminLoginGuardImpl({ email, outcome: "fail" }, ip);
    }

    await expect(adminLoginGuardImpl({ email, outcome: "check" }, "203.0.113.11")).resolves.toEqual(
      { ok: true },
    );
  });
});
