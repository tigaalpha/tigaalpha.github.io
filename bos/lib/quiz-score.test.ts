import { describe, expect, it } from "vitest";
import {
  QUIZ_QUESTIONS,
  QUIZ_LEVEL_RESULT,
  quizLeadSource,
  scoreQuiz,
  scoreQuizAnswers,
  type QuizLevel,
} from "./quiz-score";

describe("scoreQuiz (total points → level)", () => {
  it("maps zero to beginner", () => {
    expect(scoreQuiz(0)).toBe("beginner");
  });

  it("keeps the beginner band closed at 2", () => {
    expect(scoreQuiz(2)).toBe("beginner");
  });

  it("puts 3–5 in elementary", () => {
    expect(scoreQuiz(3)).toBe("elementary");
    expect(scoreQuiz(5)).toBe("elementary");
  });

  it("puts 6–8 in intermediate", () => {
    expect(scoreQuiz(6)).toBe("intermediate");
    expect(scoreQuiz(8)).toBe("intermediate");
  });

  it("puts 9+ in advanced", () => {
    expect(scoreQuiz(9)).toBe("advanced");
  });

  it("clamps out-of-range totals instead of returning undefined", () => {
    expect(scoreQuiz(-5)).toBe("beginner");
    expect(scoreQuiz(999)).toBe("advanced");
  });
});

describe("scoreQuizAnswers (answer indices → level)", () => {
  it("scores an all-first-option set to beginner", () => {
    const allFirst = QUIZ_QUESTIONS.map(() => 0);
    expect(scoreQuizAnswers(allFirst)).toBe("beginner");
  });

  it("scores an all-last-option set to advanced", () => {
    const allLast = QUIZ_QUESTIONS.map((q) => q.options.length - 1);
    expect(scoreQuizAnswers(allLast)).toBe("advanced");
  });

  it("treats missing answers as 0 points rather than throwing", () => {
    expect(scoreQuizAnswers([])).toBe("beginner");
    // first 4 questions all-last (3+2+2+3 = 10 points), last question skipped
    const partial = QUIZ_QUESTIONS.map((q) => q.options.length - 1).slice(0, -1);
    expect(scoreQuizAnswers(partial)).toBe("advanced");
  });

  it("ignores out-of-bounds picks instead of crashing", () => {
    // out-of-bounds picks contribute 0 points each
    expect(scoreQuizAnswers([-1, -1, -1, -1, -1])).toBe("beginner");
    expect(scoreQuizAnswers([99, 99, 99, 99, 99])).toBe("beginner");
  });
});

describe("quizLeadSource", () => {
  it("stamps a source the dashboard lead-quiz classifier recognizes", () => {
    // classifyLevel() on the dashboard lowercases lead_source and scans for
    // the level keyword — quizLeadSource must embed it verbatim.
    const levels: QuizLevel[] = ["beginner", "elementary", "intermediate", "advanced"];
    for (const level of levels) {
      const source = quizLeadSource(level);
      expect(source).toContain("quiz");
      expect(source).toContain(level);
    }
  });
});

describe("QUIZ_QUESTIONS integrity", () => {
  it("has at least one option per question and non-negative points", () => {
    for (const q of QUIZ_QUESTIONS) {
      expect(q.options.length).toBeGreaterThan(0);
      for (const o of q.options) {
        expect(o.points).toBeGreaterThanOrEqual(0);
        expect(o.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("has a result (course offer) for every level the scorer can return", () => {
    const possible = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 12].map(scoreQuiz));
    for (const level of possible) {
      expect(QUIZ_LEVEL_RESULT[level].course.name.length).toBeGreaterThan(0);
      expect(QUIZ_LEVEL_RESULT[level].course.price.length).toBeGreaterThan(0);
    }
  });
});
