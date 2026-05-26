import { describe, it, expect } from "vitest";

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0 },
  { level: 2, xp: 50 },
  { level: 3, xp: 150 },
  { level: 4, xp: 300 },
  { level: 5, xp: 500 },
  { level: 6, xp: 800 },
  { level: 7, xp: 1200 },
  { level: 8, xp: 1700 },
  { level: 9, xp: 2300 },
  { level: 10, xp: 3000 },
];

function calculateLevel(totalXp: number): number {
  let level = 1;
  for (const t of LEVEL_THRESHOLDS) {
    if (totalXp >= t.xp) level = t.level;
  }
  return level;
}

const XP_VALUES = {
  DAILY_LOGIN: 2,
  SESSION_COMPLETE: 5,
  QUIZ_PASS: 10,
  TEST_PASS: 50,
  PROGRAM_COMPLETE: 100,
} as const;

describe("calculateLevel", () => {
  it("returns level 1 for 0 XP", () => {
    expect(calculateLevel(0)).toBe(1);
  });

  it("returns level 2 for 50 XP", () => {
    expect(calculateLevel(50)).toBe(2);
  });

  it("returns level 3 for 150 XP", () => {
    expect(calculateLevel(150)).toBe(3);
  });

  it("returns level 5 for 500 XP", () => {
    expect(calculateLevel(500)).toBe(5);
  });

  it("returns level 10 for 3000+ XP", () => {
    expect(calculateLevel(3000)).toBe(10);
    expect(calculateLevel(9999)).toBe(10);
  });

  it("returns correct level for mid-range XP", () => {
    expect(calculateLevel(175)).toBe(3);
    expect(calculateLevel(400)).toBe(4);
    expect(calculateLevel(1000)).toBe(6);
  });
});

describe("XP_VALUES", () => {
  it("has expected values", () => {
    expect(XP_VALUES.DAILY_LOGIN).toBe(2);
    expect(XP_VALUES.SESSION_COMPLETE).toBe(5);
    expect(XP_VALUES.QUIZ_PASS).toBe(10);
    expect(XP_VALUES.TEST_PASS).toBe(50);
    expect(XP_VALUES.PROGRAM_COMPLETE).toBe(100);
  });
});

describe("quiz pass threshold", () => {
  const passesQuiz = (score: number, total: number) => score >= Math.ceil(total * 0.6);

  it("passes with 60% score", () => {
    expect(passesQuiz(6, 10)).toBe(true);
    expect(passesQuiz(3, 5)).toBe(true);
  });

  it("fails with below 60% score", () => {
    expect(passesQuiz(5, 10)).toBe(false);
    expect(passesQuiz(2, 5)).toBe(false);
  });

  it("rounds up threshold for partial pass", () => {
    expect(passesQuiz(3, 5)).toBe(true);
    expect(passesQuiz(4, 6)).toBe(true);
    expect(passesQuiz(3, 7)).toBe(false);
  });
});
