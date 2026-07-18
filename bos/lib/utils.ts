import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

/**
 * supabase.functions.invoke() only exposes a generic "Edge Function returned
 * a non-2xx status code" via error.message — the actual { error: "..." }
 * body our functions return lives on error.context (the raw Response).
 * Without this, every Edge Function failure looks identical to the user.
 */
export async function describeFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const text = await context.clone().text();
      try {
        const body = JSON.parse(text) as { error?: string };
        if (body?.error) return body.error;
      } catch {
        // response body wasn't JSON — fall through to raw text
      }
      if (text) return text;
    } catch {
      // reading the body failed — fall through to the generic message
    }
  }
  return error instanceof Error ? error.message : "Unknown error";
}
