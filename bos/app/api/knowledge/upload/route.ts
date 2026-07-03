import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { getAIProvider } from "@/services/ai/provider";
import { chunkText } from "@/services/ai/chunk";

const bodySchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum(["pricing", "promotion", "teachers", "policies", "faq", "school_info", "holiday", "internal_sop"]),
  content: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const json = await request.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const repos = createRepositories(supabase);
  const ai = getAIProvider();

  const document = await repos.knowledge.createDocument(parsed.data.title, parsed.data.sourceType, parsed.data.content, user?.id);

  const chunks = chunkText(parsed.data.content);
  const embeddings = await Promise.all(chunks.map((chunk) => ai.embed(chunk)));

  await repos.knowledge.insertChunks(
    document.id,
    chunks.map((content, i) => ({ content, embedding: embeddings[i]! }))
  );

  return NextResponse.json({ document }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const supabase = await createClient();
  const repos = createRepositories(supabase);
  await repos.knowledge.deleteDocument(id);

  return NextResponse.json({ ok: true });
}
