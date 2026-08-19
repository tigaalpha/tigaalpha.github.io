// Generic retry wrapper (feature #13) — agent tasks that fail transiently
// (Gemini quota blips, network) get retried with exponential backoff instead
// of failing the whole workflow. Pure Deno-free code so vitest can exercise
// it from bos/lib/retry.test.ts.

export interface RetryOptions {
  /** Total attempts including the first. Default 3. */
  attempts?: number;
  /** Base delay before the first retry in ms. Doubles each attempt. Default 500. */
  baseDelayMs?: number;
  /** Predicate deciding whether a thrown error is worth retrying. Default: retry everything. */
  retryable?: (error: unknown) => boolean;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 500);
  const retryable = options.retryable ?? (() => true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !retryable(error)) throw error;
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError; // unreachable, satisfies TS
}
