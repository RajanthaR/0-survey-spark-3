import { describe, it, expect } from "vitest";
import { formatRate, formatEta } from "../progress-format";

describe("formatRate", () => {
  it("returns '0' for non-positive or non-finite input", () => {
    expect(formatRate(0)).toBe("0");
    expect(formatRate(-5)).toBe("0");
    expect(formatRate(Number.NaN)).toBe("0");
    expect(formatRate(Number.POSITIVE_INFINITY)).toBe("0");
    expect(formatRate(Number.NEGATIVE_INFINITY)).toBe("0");
  });

  it("formats sub-100 rates with one decimal", () => {
    expect(formatRate(0.1)).toBe("0.1");
    expect(formatRate(1)).toBe("1.0");
    expect(formatRate(12.34)).toBe("12.3");
    expect(formatRate(99.94)).toBe("99.9");
  });

  it("rounds rates between 100 and 999 to whole numbers", () => {
    expect(formatRate(100)).toBe("100");
    expect(formatRate(250.4)).toBe("250");
    expect(formatRate(250.6)).toBe("251");
    expect(formatRate(999.4)).toBe("999");
  });

  it("formats >=1000 with k suffix and one decimal", () => {
    expect(formatRate(1000)).toBe("1.0k");
    expect(formatRate(1234)).toBe("1.2k");
    expect(formatRate(9876)).toBe("9.9k");
    expect(formatRate(1_000_000)).toBe("1000.0k");
  });

  it("produces stable output for identical input", () => {
    expect(formatRate(1500)).toBe(formatRate(1500));
    expect(formatRate(42.7)).toBe(formatRate(42.7));
  });
});

describe("formatEta", () => {
  it("returns em-dash for non-finite or negative seconds", () => {
    expect(formatEta(Number.NaN)).toBe("—");
    expect(formatEta(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatEta(-1)).toBe("—");
    expect(formatEta(-0.5)).toBe("—");
  });

  it("returns '<1s' for sub-second positive durations", () => {
    expect(formatEta(0)).toBe("<1s");
    expect(formatEta(0.4)).toBe("<1s");
    expect(formatEta(0.999)).toBe("<1s");
  });

  it("formats sub-minute durations as rounded seconds", () => {
    expect(formatEta(1)).toBe("1s");
    expect(formatEta(12.4)).toBe("12s");
    expect(formatEta(12.6)).toBe("13s");
    expect(formatEta(59)).toBe("59s");
    expect(formatEta(59.4)).toBe("59s");
  });

  it("formats minute durations with optional seconds", () => {
    expect(formatEta(60)).toBe("1m");
    expect(formatEta(61)).toBe("1m 1s");
    expect(formatEta(200)).toBe("3m 20s");
    expect(formatEta(3599)).toBe("59m 59s");
  });

  it("formats hour durations with optional minutes", () => {
    expect(formatEta(3600)).toBe("1h");
    expect(formatEta(3660)).toBe("1h 1m");
    expect(formatEta(60 * 74)).toBe("1h 14m");
    expect(formatEta(60 * 60 * 5)).toBe("5h");
  });

  it("rounds the trailing minutes for hour-scale durations", () => {
    // 1h 29s → 1h 0m → "1h"
    expect(formatEta(3600 + 29)).toBe("1h");
    // 1h 30s → still under a minute → "1h"
    expect(formatEta(3600 + 30)).toBe("1h 1m");
    // 1h 89s → ~1m → "1h 1m"
    expect(formatEta(3600 + 89)).toBe("1h 1m");
    // 1h 90s → rounds up to 2m
    expect(formatEta(3600 + 90)).toBe("1h 2m");
  });

  it("produces stable output for identical input", () => {
    expect(formatEta(200)).toBe(formatEta(200));
    expect(formatEta(3660)).toBe(formatEta(3660));
  });
});
