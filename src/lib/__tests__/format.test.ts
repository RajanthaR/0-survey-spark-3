import { describe, expect, it } from "vitest";
import { formatQuestionCount, formatQuestionPosition } from "@/lib/format";

describe("formatQuestionCount", () => {
  it("English: number then noun", () => {
    expect(formatQuestionCount(39, "en")).toBe("39 questions");
    expect(formatQuestionCount(1, "en")).toBe("1 questions");
  });

  it("Sinhala: noun then number (ප්‍රශ්න)", () => {
    expect(formatQuestionCount(39, "si")).toBe("ප්‍රශ්න 39");
    expect(formatQuestionCount(1, "si")).toBe("ප්‍රශ්න 1");
    // explicit guard against the old "39 ප්‍රශ්නය" ordering
    expect(formatQuestionCount(39, "si").startsWith("ප්‍රශ්න")).toBe(true);
    expect(formatQuestionCount(39, "si")).not.toContain("ප්‍රශ්නය");
  });

  it("Tamil: noun then number (கேள்விகள்)", () => {
    expect(formatQuestionCount(39, "ta")).toBe("கேள்விகள் 39");
    expect(formatQuestionCount(1, "ta")).toBe("கேள்விகள் 1");
    expect(formatQuestionCount(39, "ta").startsWith("கேள்விகள்")).toBe(true);
  });
});

describe("formatQuestionPosition", () => {
  it("English: 'Question N of M'", () => {
    expect(formatQuestionPosition(3, 39, "en")).toBe("Question 3 of 39");
  });

  it("Sinhala: noun-first 'ප්‍රශ්න N / M'", () => {
    expect(formatQuestionPosition(3, 39, "si")).toBe("ප්‍රශ්න 3 / 39");
    expect(formatQuestionPosition(3, 39, "si").startsWith("ප්‍රශ්න")).toBe(true);
  });

  it("Tamil: noun-first 'கேள்விகள் N / M'", () => {
    expect(formatQuestionPosition(3, 39, "ta")).toBe("கேள்விகள் 3 / 39");
    expect(formatQuestionPosition(3, 39, "ta").startsWith("கேள்விகள்")).toBe(true);
  });
});
