import { beforeEach, describe, expect, it } from "vitest";

import { adminLoginGuardImpl } from "@/lib/admin-login-guard.impl.server";
import { __resetRateLimitForTests } from "@/lib/rate-limit.server";

const email = "admin@example.com";
const ip = "203.0.113.10";

beforeEach(() => {
  __resetRateLimitForTests();
});

describe("adminLoginGuardImpl", () => {
  it("locks out checks after 5 failed sign-in reports for the same email and IP", () => {
    for (let i = 0; i < 5; i += 1) {
      expect(adminLoginGuardImpl({ email, outcome: "fail" }, ip)).toEqual({ ok: true });
    }

    expect(() => adminLoginGuardImpl({ email, outcome: "check" }, ip)).toThrow(Response);
  });

  it("does not consume capacity when checking", () => {
    for (let i = 0; i < 10; i += 1) {
      expect(adminLoginGuardImpl({ email, outcome: "check" }, ip)).toEqual({ ok: true });
    }

    for (let i = 0; i < 5; i += 1) {
      expect(adminLoginGuardImpl({ email, outcome: "fail" }, ip)).toEqual({ ok: true });
    }
    expect(() => adminLoginGuardImpl({ email, outcome: "check" }, ip)).toThrow(Response);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 5; i += 1) {
      adminLoginGuardImpl({ email, outcome: "fail" }, ip);
    }

    expect(adminLoginGuardImpl({ email, outcome: "check" }, "203.0.113.11")).toEqual({
      ok: true,
    });
  });
});
