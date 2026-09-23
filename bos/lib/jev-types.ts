/* ── bos/lib/jev-types.ts — shared types for the Jev judgment client ──
   Kept separate from jev.ts so .test.ts files and server code can import the
   types without pulling the late-importing client. Mirrors the wire contract
   of the jev-judge edge function (TypeSafe System One primitives). ── */

export type JevQuestionType = "choice" | "score" | "noul";

/** One typed question — matches the TypeSafe primitives:
 *  choice → criteria: { [key]: description }; score → criteria: string[];
 *  noul → no criteria. */
export interface JevQuestion {
  type: JevQuestionType;
  instructions: string;
  criteria?: Record<string, string> | string[];
}

export interface JevChoiceAnswer {
  type: "choice";
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}
export interface JevScoreAnswer {
  type: "score";
  score: number;
  confidence: number;
  probabilities: Record<string, number>;
}
export interface JevNoulAnswer {
  type: "noul";
  noul: number;
}
export type JevAnswer = JevChoiceAnswer | JevScoreAnswer | JevNoulAnswer;

export type JevAnswers = Record<string, JevAnswer>;

export type JevJudgeResult =
  | { ok: true; answers: JevAnswers; model?: string; usage?: unknown; via: string }
  | { ok: false; error: string; via: string };
