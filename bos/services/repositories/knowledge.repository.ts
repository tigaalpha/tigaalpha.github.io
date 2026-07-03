import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, KnowledgeSourceType, Tables } from "@/types/database";

export interface KnowledgeMatch {
  id: string;
  document_id: string;
  content: string;
  similarity: number;
}

export class KnowledgeRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async createDocument(title: string, sourceType: KnowledgeSourceType, rawText: string, createdBy?: string): Promise<Tables<"knowledge_documents">> {
    const { data, error } = await this.db
      .from("knowledge_documents")
      .insert({ title, source_type: sourceType, raw_text: rawText, created_by: createdBy ?? null })
      .select("*")
      .single();
    if (error) throw error;
    return data;
  }

  async listDocuments(): Promise<Tables<"knowledge_documents">[]> {
    const { data, error } = await this.db.from("knowledge_documents").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async deleteDocument(id: string): Promise<void> {
    const { error } = await this.db.from("knowledge_documents").delete().eq("id", id);
    if (error) throw error;
  }

  async insertChunks(documentId: string, chunks: { content: string; embedding: number[] }[]): Promise<void> {
    const rows = chunks.map((chunk) => ({ document_id: documentId, content: chunk.content, embedding: chunk.embedding }));
    const { error } = await this.db.from("knowledge_chunks").insert(rows);
    if (error) throw error;
  }

  async search(embedding: number[], matchCount = 6, minSimilarity = 0.65): Promise<KnowledgeMatch[]> {
    const { data, error } = await this.db.rpc("match_knowledge_chunks", {
      query_embedding: embedding as unknown as string,
      match_count: matchCount,
      min_similarity: minSimilarity,
    });
    if (error) throw error;
    return (data ?? []) as KnowledgeMatch[];
  }
}
