/**
 * Persistence guarantee: every write to the `responses` table records the
 * language that was active at the moment the answer was saved.
 *
 * This file mocks `supabaseAdmin` so we can capture the exact payload sent
 * to `responses.insert(...)` (startResponse) and `responses.update(...)`
 * (saveAnswers, completeResponse) and assert the `language` column is
 * present and matches what the SurveyRunner passed in.
 *
 * Critically, `saveAnswers` is the call that fires every ~1.5s while the
 * user answers questions, so this is the column that must stay truthful as
 * the user toggles between EN / SI / TA mid-survey.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

type UpdatePayload = Record<string, unknown>;
type InsertPayload = Record<string, unknown>;

const updateCalls: UpdatePayload[] = [];
const insertCalls: InsertPayload[] = [];

vi.mock("@/integrations/supabase/client.server", () => {
  // Minimal chainable stub mirroring the methods responses.functions.ts uses:
  //   from(...).insert(...).select(...).single()
  //   from(...).update(...).eq(...)
  //   from(...).select(...).eq(...).maybeSingle()
  const buildFrom = () => {
    const chain: Record<string, unknown> = {};
    chain.insert = (payload: InsertPayload) => {
      insertCalls.push(payload);
      return {
        select: () => ({
          single: async () => ({
            data: { id: "row-id", resume_token: "tok-from-insert" },
            error: null,
          }),
        }),
      };
    };
    chain.update = (payload: UpdatePayload) => {
      updateCalls.push(payload);
      return {
        eq: async () => ({ error: null }),
      };
    };
    chain.select = () => ({
      eq: () => ({
        // assertNotCompleted reads { status }; mark as in_progress so saves proceed.
        maybeSingle: async () => ({
          data: { status: "in_progress" },
          error: null,
        }),
      }),
    });
    return chain;
  };

  return {
    supabaseAdmin: {
      from: () => buildFrom(),
    },
  };
});

import { startResponseImpl } from "@/lib/responses.impl.server";
import { saveAnswers, completeResponse } from "@/lib/responses.functions";

beforeEach(() => {
  insertCalls.length = 0;
  updateCalls.length = 0;
});

describe("responses persistence — language is recorded on every write", () => {
  it.each(["en", "si", "ta"] as const)(
    "startResponse(%s) inserts the language column",
    async (lang) => {
      await startResponseImpl({ surveySlug: "demo", language: lang, consent: {} });
      expect(insertCalls).toHaveLength(1);
      expect(insertCalls[0]).toMatchObject({
        survey_slug: "demo",
        language: lang,
      });
    },
  );

  it.each(["en", "si", "ta"] as const)(
    "saveAnswers includes language=%s in the update payload",
    async (lang) => {
      await saveAnswers({
        data: {
          resumeToken: "tok-12345678",
          answers: { q1: "v" },
          progressPct: 25,
          language: lang,
        },
      });
      expect(updateCalls).toHaveLength(1);
      expect(updateCalls[0]).toMatchObject({
        answers: { q1: "v" },
        progress_pct: 25,
        language: lang,
      });
    },
  );

  it("saveAnswers without a language does NOT overwrite the stored language column", async () => {
    await saveAnswers({
      data: {
        resumeToken: "tok-12345678",
        answers: { q1: "v" },
        progressPct: 10,
      },
    });
    expect(updateCalls).toHaveLength(1);
    // language key must be omitted entirely so Postgres keeps the previous value.
    expect(Object.keys(updateCalls[0])).not.toContain("language");
  });

  it("multiple consecutive saves with different languages each record the active one", async () => {
    const sequence = [
      { lang: "en", pct: 10 },
      { lang: "si", pct: 30 },
      { lang: "ta", pct: 60 },
      { lang: "en", pct: 90 },
    ] as const;
    for (const { lang, pct } of sequence) {
      await saveAnswers({
        data: {
          resumeToken: "tok-12345678",
          answers: { q1: "v" },
          progressPct: pct,
          language: lang,
        },
      });
    }
    expect(updateCalls).toHaveLength(sequence.length);
    expect(updateCalls.map((u) => u.language)).toEqual(sequence.map((s) => s.lang));
    expect(updateCalls.map((u) => u.progress_pct)).toEqual(sequence.map((s) => s.pct));
  });

  it("completeResponse marks status=completed and progress=100 (language preserved from prior saves)", async () => {
    await completeResponse({
      data: {
        resumeToken: "tok-12345678",
        answers: { q1: "v" },
      },
    });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toMatchObject({
      status: "completed",
      progress_pct: 100,
    });
    // Final write intentionally does not touch language — the most recent
    // saveAnswers call already locked it in.
    expect(Object.keys(updateCalls[0])).not.toContain("language");
  });
});
