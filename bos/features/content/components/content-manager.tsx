"use client";

import { useState } from "react";
import { FileText, Copy, Check, Trash2, Sparkles, Shuffle } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, describeFunctionError } from "@/lib/utils";
import { STANDING_TOPICS, pickRandomTopic, getMissingCoreKeywords } from "@/features/content/topics";
import type { ArticleStatus, Tables } from "@/types/database";

interface ContentManagerProps {
  articles: Tables<"articles">[];
  onChanged: () => void;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

export function ContentManager({ articles, onChanged }: ContentManagerProps) {
  const [topic, setTopic] = useState("");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [language, setLanguage] = useState<"th" | "en">("th");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = articles.find((a) => a.id === selectedId) ?? null;

  async function runGenerate(topicValue: string, keywordValue: string, languageValue: "th" | "en") {
    setGenerating(true);
    setError(null);

    try {
      const supabase = createClient();
      // Chunking, embedding, and the Gemini call need the key, which stays
      // server-side — this invokes the Supabase Edge Function that holds it.
      const { data, error: fnError } = await supabase.functions.invoke<{
        article: Tables<"articles">;
        missingCoreKeywords: string[];
      }>("generate-article", {
        body: { topic: topicValue, targetKeyword: keywordValue, language: languageValue },
      });
      if (fnError) throw fnError;

      setTopic("");
      setTargetKeyword("");
      onChanged();
      if (data?.article) setSelectedId(data.article.id);
      if (data?.missingCoreKeywords?.length) {
        setError(`เตือน: บทความนี้ยังขาดคีย์เวิร์ดหลัก: ${data.missingCoreKeywords.join(", ")} — กรุณาแก้ไขเพิ่มเติมด้วยตนเอง`);
      }
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    void runGenerate(topic, targetKeyword, language);
  }

  function handleQuickContent(topicOverride?: string) {
    const picked = topicOverride ?? pickRandomTopic();
    setTopic(picked);
    setTargetKeyword(picked);
    void runGenerate(picked, picked, language);
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.articles.delete(id);
    if (selectedId === id) setSelectedId(null);
    onChanged();
  }

  async function handleStatusChange(id: string, status: ArticleStatus) {
    const repos = createRepositories(createClient());
    await repos.articles.update(id, { status });
    onChanged();
  }

  async function handleFieldSave(id: string, patch: Partial<Tables<"articles">>) {
    const repos = createRepositories(createClient());
    await repos.articles.update(id, patch);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>สร้างบทความใหม่</CardTitle>
          <CardDescription>AI ค้นข้อมูลจริงจาก Knowledge Base มาเขียนบทความให้ ไม่แต่งราคาหรือข้อมูลเอง</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="หัวข้อบทความ เช่น สอนเปียโนเด็กเริ่มต้นที่ไหนดี"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="md:col-span-2"
              required
            />
            <Input
              placeholder="คีย์เวิร์ดหลัก เช่น เรียนเปียโนกรุงเทพ"
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              required
            />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "th" | "en")}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="th">ภาษาไทย</option>
              <option value="en">English</option>
            </select>
            {error ? <p className="text-xs text-danger md:col-span-4">{error}</p> : null}
            <Button type="submit" className="md:col-span-4" disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? "กำลังเขียนบทความ… (อาจใช้เวลาสักครู่)" : "สร้างบทความ"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>หัวข้อประจำ</CardTitle>
          <CardDescription>กดหัวข้อไหนก็ได้เพื่อสร้างบทความทันที หรือกด &quot;Content ด่วน&quot; ให้ระบบสุ่มหัวข้อให้เอง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={() => handleQuickContent()} disabled={generating} className="w-full sm:w-auto">
            <Shuffle className="h-4 w-4" />
            {generating ? "กำลังเขียนบทความ…" : "Content ด่วน (สุ่มหัวข้อ)"}
          </Button>
          <div className="flex flex-wrap gap-2">
            {STANDING_TOPICS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={generating}
                onClick={() => handleQuickContent(t)}
                className="rounded-full border border-line/10 px-3 py-1.5 text-xs text-secondary/70 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-secondary disabled:opacity-50"
              >
                {t}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>บทความ ({articles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {articles.length === 0 ? (
              <EmptyState icon={FileText} title="ยังไม่มีบทความ" description="สร้างบทความแรกด้านบน" />
            ) : (
              <ul className="space-y-2">
                {articles.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(article.id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        selectedId === article.id ? "border-primary/40 bg-primary/5" : "border-line/5 hover:bg-line/5"
                      )}
                    >
                      <p className="truncate text-sm font-medium text-secondary">{article.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={article.status === "published" ? "success" : "outline"}>
                          {article.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                        </Badge>
                        <span className="text-xs text-secondary/40">{article.target_keyword}</span>
                        {getMissingCoreKeywords(`${article.title}\n${article.content}`).length > 0 ? (
                          <Badge variant="warning">ขาดคีย์เวิร์ด</Badge>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selected ? (
            <ArticleEditor
              key={selected.id}
              article={selected}
              onSave={(patch) => handleFieldSave(selected.id, patch)}
              onStatusChange={(status) => handleStatusChange(selected.id, status)}
              onDelete={() => handleDelete(selected.id)}
            />
          ) : (
            <CardContent>
              <EmptyState icon={FileText} title="เลือกบทความ" description="เลือกบทความจากรายการด้านซ้ายเพื่อดูและแก้ไข" />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function ArticleEditor({
  article,
  onSave,
  onStatusChange,
  onDelete,
}: {
  article: Tables<"articles">;
  onSave: (patch: Partial<Tables<"articles">>) => void;
  onStatusChange: (status: ArticleStatus) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(article.title);
  const [metaDescription, setMetaDescription] = useState(article.meta_description);
  const [content, setContent] = useState(article.content);
  const [dirty, setDirty] = useState(false);

  const fullMarkdown = `# ${title}\n\n${content}`;
  const missingKeywords = getMissingCoreKeywords(`${title}\n${content}`);

  function markDirty<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  return (
    <>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>แก้ไขบทความ</CardTitle>
          <CardDescription>Slug: {article.slug}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={article.status === "published" ? "success" : "outline"}>
            {article.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange(article.status === "published" ? "draft" : "published")}
          >
            {article.status === "published" ? "ย้ายกลับฉบับร่าง" : "ทำเครื่องหมายว่าเผยแพร่แล้ว"}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-danger" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {missingKeywords.length > 0 ? (
          <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">
            ยังขาดคีย์เวิร์ดหลัก: {missingKeywords.join(", ")}
          </p>
        ) : null}

        <Field label="Title Tag / H1" hint={`${title.length} ตัวอักษร (แนะนำไม่เกิน 60)`}>
          <div className="flex items-center gap-2">
            <Input value={title} onChange={(e) => markDirty(setTitle)(e.target.value)} />
            <CopyButton value={title} />
          </div>
        </Field>

        <Field label="Meta Description" hint={`${metaDescription.length} ตัวอักษร (แนะนำ 120-160)`}>
          <div className="flex items-start gap-2">
            <Textarea value={metaDescription} onChange={(e) => markDirty(setMetaDescription)(e.target.value)} className="min-h-16" />
            <CopyButton value={metaDescription} />
          </div>
        </Field>

        <Field label="เนื้อหาบทความ (Markdown)">
          <div className="flex items-start gap-2">
            <Textarea value={content} onChange={(e) => markDirty(setContent)(e.target.value)} className="min-h-96 font-mono text-xs" />
            <CopyButton value={fullMarkdown} />
          </div>
        </Field>

        {article.faq.length > 0 ? (
          <Field label="คำถามที่พบบ่อย (FAQ)">
            <div className="space-y-2">
              {article.faq.map((item, i) => (
                <div key={i} className="rounded-xl border border-line/5 p-3">
                  <p className="text-sm font-medium text-secondary">{item.question}</p>
                  <p className="mt-1 text-sm text-secondary/70">{item.answer}</p>
                </div>
              ))}
            </div>
          </Field>
        ) : null}

        {article.internal_link_ideas.length > 0 ? (
          <Field label="ไอเดียลิงก์ภายในเว็บ">
            <ul className="list-inside list-disc space-y-1 text-sm text-secondary/70">
              {article.internal_link_ideas.map((idea, i) => (
                <li key={i}>{idea}</li>
              ))}
            </ul>
          </Field>
        ) : null}

        <Button
          className="w-full"
          disabled={!dirty}
          onClick={() => {
            onSave({ title, meta_description: metaDescription, content });
            setDirty(false);
          }}
        >
          บันทึกการแก้ไข
        </Button>
      </CardContent>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-secondary/60">{label}</label>
        {hint ? <span className="text-xs text-secondary/40">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
