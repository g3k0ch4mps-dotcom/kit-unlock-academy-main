import { describe, it, expect } from "vitest";

const formatCode = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 32);

const ERROR_MAP = {
  not_found: { message: "Code not found", canRetry: true },
  already_used: { message: "Code already redeemed", canRetry: false },
  expired: { message: "Code has expired", canRetry: false },
  already_has_access: { message: "You already have access", canRetry: false },
  no_program: { message: "Code not linked to a program", canRetry: false },
  network: { message: "Connection error", canRetry: true },
  generic: { message: "Something went wrong", canRetry: true },
};

describe("formatCode", () => {
  it("converts to uppercase", () => {
    expect(formatCode("abc-xyz")).toBe("ABC-XYZ");
  });

  it("removes invalid characters", () => {
    expect(formatCode("hello!@#world$%^")).toBe("HELLOWORLD");
  });

  it("strips spaces", () => {
    expect(formatCode("MAMUZA ABCD EFGH")).toBe("MAMUZAABCDEFGH");
  });

  it("preserves hyphens", () => {
    expect(formatCode("MAMUZA-1234-5678")).toBe("MAMUZA-1234-5678");
  });

  it("truncates to 32 characters", () => {
    expect(formatCode("A".repeat(50))).toHaveLength(32);
  });

  it("handles empty string", () => {
    expect(formatCode("")).toBe("");
  });
});

describe("ERROR_MAP", () => {
  it("has retryable errors", () => {
    expect(ERROR_MAP.not_found.canRetry).toBe(true);
    expect(ERROR_MAP.network.canRetry).toBe(true);
    expect(ERROR_MAP.generic.canRetry).toBe(true);
  });

  it("has non-retryable errors", () => {
    expect(ERROR_MAP.already_used.canRetry).toBe(false);
    expect(ERROR_MAP.expired.canRetry).toBe(false);
    expect(ERROR_MAP.already_has_access.canRetry).toBe(false);
    expect(ERROR_MAP.no_program.canRetry).toBe(false);
  });

  it("has messages for all error kinds", () => {
    for (const key of Object.keys(ERROR_MAP) as Array<keyof typeof ERROR_MAP>) {
      expect(ERROR_MAP[key].message).toBeTruthy();
    }
  });
});
