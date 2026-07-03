"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { KnowledgeSourceType, Tables } from "@/types/database";

const SOURCE_TYPES: KnowledgeSourceType[] = [
  "pricing", "promotion", "teachers", "policies", "faq", "school_info", "holiday", "internal_sop",
];

export function KnowledgeManager({ documents }: { documents: Tables<"knowledge_documents">[] }) {
  const router = useRouter();
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
      const response = await fetch("/api/knowledge/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, sourceType, content }),
      });
      if (!response.ok) throw new Error(await response.text());

      setTitle("");
      setContent("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document");
    } finally {
      setSubmitting(false);
    }
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
              className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
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
                <li key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-secondary">{doc.title}</p>
                    <Badge variant="outline" className="mt-1">
                      {doc.source_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <form
                    action={async () => {
                      await fetch(`/api/knowledge/upload?id=${doc.id}`, { method: "DELETE" });
                      router.refresh();
                    }}
                  >
                    <Button variant="ghost" size="icon" type="submit">
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
