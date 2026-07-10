"use client";

import { useState } from "react";
import { BookOpen, Trash2 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { KnowledgeSourceType, Tables } from "@/types/database";

const SOURCE_TYPES: KnowledgeSourceType[] = [
  "pricing", "promotion", "teachers", "policies", "faq", "school_info", "holiday", "internal_sop",
];

interface KnowledgeManagerProps {
  documents: Tables<"knowledge_documents">[];
  onChanged: () => void;
}

export function KnowledgeManager({ documents, onChanged }: KnowledgeManagerProps) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("faq");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      // Chunking + embedding needs the Gemini key, which stays server-side —
      // this invokes the Supabase Edge Function that holds it.
      const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
        body: { title, sourceType, content },
      });
      if (fnError) throw fnError;

      setTitle("");
      setContent("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.knowledge.deleteDocument(id);
    onChanged();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Add Knowledge</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value as KnowledgeSourceType)}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Textarea
              placeholder="Paste pricing, FAQ, policy text, etc."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-40"
              required
            />
            {error ? <p className="text-xs text-danger">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving…" : "Save to Knowledge Base"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Documents ({documents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <EmptyState icon={BookOpen} title="No documents yet" description="Add pricing, FAQ, or policy content on the left." />
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-line/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-secondary">{doc.title}</p>
                    <Badge variant="outline" className="mt-1">
                      {doc.source_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
