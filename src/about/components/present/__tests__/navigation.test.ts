import { describe, expect, it } from "vitest";

import {
  clampSlideIndex,
  moveSlideIndex,
  parseSlideHash,
  slideHash,
} from "@/about/components/present/navigation";

describe("presentation slide navigation", () => {
  it("clamps indexes to deck bounds", () => {
    expect(clampSlideIndex(-2, 5)).toBe(0);
    expect(clampSlideIndex(2, 5)).toBe(2);
    expect(clampSlideIndex(8, 5)).toBe(4);
    expect(clampSlideIndex(1, 0)).toBe(0);
  });

  it("moves between slides without crossing bounds", () => {
    expect(moveSlideIndex(0, 3, "prev")).toBe(0);
    expect(moveSlideIndex(0, 3, "next")).toBe(1);
    expect(moveSlideIndex(2, 3, "next")).toBe(2);
    expect(moveSlideIndex(2, 3, "first")).toBe(0);
    expect(moveSlideIndex(0, 3, "last")).toBe(2);
  });

  it("serializes and parses one-based slide hashes", () => {
    expect(slideHash(0)).toBe("#slide-1");
    expect(slideHash(12)).toBe("#slide-13");
    expect(parseSlideHash("#slide-3", 13)).toBe(2);
    expect(parseSlideHash("#slide-99", 13)).toBe(12);
    expect(parseSlideHash("#not-a-slide", 13)).toBe(0);
  });
});
