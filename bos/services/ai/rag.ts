import "server-only";
import type { AIProvider } from "@/types/ai";
import type { KnowledgeRepository, KnowledgeMatch } from "@/services/repositories/knowledge.repository";

/**
 * Cost-optimization priority #1 per PRD: always try the Knowledge Base
 * (cheap vector search) before spending a Gemini generation call.
 */
export class RagService {
  constructor(private readonly ai: AIProvider, private readonly knowledge: KnowledgeRepository) {}

  async retrieve(query: string, matchCount = 6): Promise<KnowledgeMatch[]> {
    const embedding = await this.ai.embed(query);
    return this.knowledge.search(embedding, matchCount);
  }

  async retrieveAsContext(query: string, matchCount = 6): Promise<string> {
    const matches = await this.retrieve(query, matchCount);
    if (matches.length === 0) return "";

    return matches
      .map((match, index) => `[${index + 1}] (similarity ${match.similarity.toFixed(2)}) ${match.content}`)
      .join("\n\n");
  }
}
