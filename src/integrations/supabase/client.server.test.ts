import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetAdminClientAuditForTests,
  createAdminClient,
} from "@/integrations/supabase/client.server";

const ORIGINAL_URL = process.env.SUPABASE_URL;
const ORIGINAL_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  process.env.SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  __resetAdminClientAuditForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
  __resetAdminClientAuditForTests();
  if (ORIGINAL_URL === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = ORIGINAL_URL;
  if (ORIGINAL_SERVICE_ROLE === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_SERVICE_ROLE;
});

describe("createAdminClient audit logging", () => {
  it("requires an explicit reason and logs each reason once", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(() => createAdminClient(" ")).toThrow(/reason/);
    createAdminClient("responses.startResponse");
    createAdminClient("responses.startResponse");
    createAdminClient("admin.stats");

    expect(logSpy).toHaveBeenCalledTimes(2);
    const payloads = logSpy.mock.calls.map(
      ([line]) => JSON.parse(String(line)) as Record<string, unknown>,
    );
    expect(payloads.map((payload) => payload.reason)).toEqual([
      "responses.startResponse",
      "admin.stats",
    ]);
    expect(payloads[0]).toMatchObject({ kind: "audit.supabaseAdmin" });
    expect(payloads[0]).toHaveProperty("file");
  });
});
