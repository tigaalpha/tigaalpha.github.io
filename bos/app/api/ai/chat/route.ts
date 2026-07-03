import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/services/supabase/server";
import { createContainer } from "@/services/container";

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1),
});

/** Web chat widget endpoint — staff-authenticated (see middleware.ts). */
export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const { chat, repos } = createContainer(supabase);

  const conversation = parsed.data.conversationId
    ? await repos.conversations.listRecent(1).then((list) => list.find((c) => c.id === parsed.data.conversationId))
    : undefined;

  const conversationId =
    conversation?.id ??
    (
      await supabase
        .from("conversations")
        .insert({ channel: "web" })
        .select("*")
        .single()
    ).data?.id;

  if (!conversationId) {
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }

  const result = await chat.respond({ conversationId, customerMessage: parsed.data.message });

  return NextResponse.json({ conversationId, ...result });
}
