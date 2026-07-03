import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/services/supabase/server";
import { createContainer } from "@/services/container";

const createSchema = z.object({
  customerId: z.string().uuid(),
  teacherId: z.string().uuid(),
  startTime: z.string(),
  endTime: z.string(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start") ?? new Date().toISOString();
  const end = searchParams.get("end") ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const teacherId = searchParams.get("teacherId") ?? undefined;

  const supabase = await createClient();
  const { repos } = createContainer(supabase);
  const bookings = await repos.bookings.listBetween(start, end, teacherId);

  return NextResponse.json({ bookings });
}

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { booking } = createContainer(supabase);

  try {
    const result = await booking.book(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Booking failed" }, { status: 409 });
  }
}
