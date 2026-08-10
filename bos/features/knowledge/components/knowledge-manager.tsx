"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Pencil, Trash2, Upload, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { extractFileText } from "@/lib/extract-file-text";
import { cn, describeFunctionError } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { KnowledgeSourceType, Tables } from "@/types/database";

export const SOURCE_TYPES: KnowledgeSourceType[] = [
  "pricing", "promotion", "teachers", "policies", "faq", "school_info", "holiday", "internal_sop",
  "sales_script", "objection_handling", "rule", "example",
];

interface KnowledgeManagerProps {
  documents: Tables<"knowledge_documents">[];
  onChanged: () => void;
  // Set by the coverage checker when the owner clicks an empty category --
  // jumps the add-document form there instead of making her hunt for it
  // in the category <select>.
  focusSourceType?: KnowledgeSourceType | null;
}

export function KnowledgeManager({ documents, onChanged, focusSourceType }: KnowledgeManagerProps) {
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("faq");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusSourceType) return;
    setSourceType(focusSourceType);
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusSourceType]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    setExtracting(true);
    try {
      const text = await extractFileText(file);
      if (!text.trim()) throw new Error("Couldn't find any text in that file.");
      setContent(text);
      if (!title) setTitle(file.name.replace(/\.(txt|pdf|docx)$/i, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      // Chunking + embedding needs the Gemini key, which stays server-side —
      // this invokes the Supabase Edge Function that holds it. Editing
      // re-chunks and re-embeds the whole document (same function, with
      // documentId set) so RAG search never mixes stale and updated chunks.
      const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
        body: editingId ? { title, sourceType, content, documentId: editingId } : { title, sourceType, content },
      });
      if (fnError) throw fnError;

      setTitle("");
      setContent("");
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(doc: Tables<"knowledge_documents">) {
    setEditingId(doc.id);
    setTitle(doc.title);
    setSourceType(doc.source_type);
    setContent(doc.raw_text ?? "");
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setSourceType("faq");
    setContent("");
    setError(null);
  }

  async function handleDelete(id: string) {
    if (editingId === id) cancelEdit();
    const repos = createRepositories(createClient());
    await repos.knowledge.deleteDocument(id);
    onChanged();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div ref={formCardRef} className="lg:col-span-1">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{editingId ? "แก้ไของค์ความรู้" : "Add Knowledge"}</CardTitle>
            {editingId ? (
              <Button type="button" variant="ghost" size="icon" onClick={cancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            ) : null}
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
                placeholder="Paste pricing, FAQ, policy text, a sales script, how to handle an objection, a rule, or an example conversation…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-40"
                required
              />
              <input ref={fileInputRef} type="file" accept=".txt,.pdf,.docx" className="hidden" onChange={handleFileSelected} />
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting}
              >
                <Upload className="h-4 w-4" />
                {extracting ? "กำลังอ่านไฟล์…" : "หรืออัปโหลดไฟล์ (.txt, .pdf, .docx)"}
              </Button>
              {error ? <p className="text-xs text-danger">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "Save to Knowledge Base"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

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
                <li
                  key={doc.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
                    editingId === doc.id ? "border-primary/40 bg-primary/5" : "border-line/5"
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-secondary">{doc.title}</p>
                    <Badge variant="outline" className="mt-1">
                      {doc.source_type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(doc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)}>
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
