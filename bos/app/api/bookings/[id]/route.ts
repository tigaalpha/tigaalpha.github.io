import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/services/supabase/server";
import { createContainer } from "@/services/container";

const patchSchema = z.union([
  z.object({ action: z.literal("reschedule"), newStart: z.string(), newEnd: z.string() }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("complete") }),
]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await request.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { booking } = createContainer(supabase);

  try {
    if (parsed.data.action === "reschedule") {
      return NextResponse.json(await booking.reschedule(id, parsed.data.newStart, parsed.data.newEnd));
    }
    if (parsed.data.action === "cancel") {
      return NextResponse.json(await booking.cancel(id));
    }
    return NextResponse.json(await booking.complete(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 409 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { booking } = createContainer(supabase);

  try {
    return NextResponse.json(await booking.cancel(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cancel failed" }, { status: 409 });
  }
}
