"use client";

import { useState } from "react";
import { GraduationCap, Copy, Check, Trash2, Sparkles, ExternalLink } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface CourseWriterManagerProps {
  courseArticles: Tables<"course_articles">[];
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

export function CourseWriterManager({ courseArticles, onChanged }: CourseWriterManagerProps) {
  const [moduleTitle, setModuleTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState<"th" | "en" | "zh">("th");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = courseArticles.find((a) => a.id === selectedId) ?? null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{ courseArticle: Tables<"course_articles"> }>(
        "generate-course-article",
        { body: { moduleTitle, topic, language } }
      );
      if (fnError) throw fnError;

      setTopic("");
      onChanged();
      if (data?.courseArticle) setSelectedId(data.courseArticle.id);
    } catch (err) {
      setError(await describeFunctionError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.courseArticles.delete(id);
    if (selectedId === id) setSelectedId(null);
    onChanged();
  }

  async function handleStatusChange(id: string, status: "draft" | "published") {
    const repos = createRepositories(createClient());
    await repos.courseArticles.update(id, { status });
    onChanged();
  }

  async function handleFieldSave(id: string, patch: Partial<Tables<"course_articles">>) {
    const repos = createRepositories(createClient());
    await repos.courseArticles.update(id, patch);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>สร้างบทเรียนใหม่</CardTitle>
          <CardDescription>
            AI ค้นข้อมูลจริงจากเว็บก่อนเขียน (เทคนิคเปียโน ทฤษฎีดนตรี วิธีฝึกซ้อม) แล้วนำมาเขียนเป็นบทเรียน — ทุกข้อเท็จจริงมีแหล่งอ้างอิงแนบมาด้วย
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerate} className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Input
              placeholder="ชื่อโมดูล เช่น โมดูล 1: พื้นฐานการนั่งเปียโน"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
              className="md:col-span-4"
              required
            />
            <Input
              placeholder="หัวข้อบทเรียน เช่น ท่านั่งและตำแหน่งมือที่ถูกต้องสำหรับผู้เริ่มต้น"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="md:col-span-3"
              required
            />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as "th" | "en" | "zh")}
              className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <option value="th">ภาษาไทย</option>
              <option value="zh">จีนกลาง (中文)</option>
              <option value="en">English</option>
            </select>
            {error ? <p className="text-xs text-danger md:col-span-4">{error}</p> : null}
            <Button type="submit" className="md:col-span-4" disabled={generating}>
              <Sparkles className="h-4 w-4" />
              {generating ? "กำลังค้นข้อมูลและเขียนบทเรียน… (อาจใช้เวลาสักครู่)" : "สร้างบทเรียน"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>บทเรียน ({courseArticles.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {courseArticles.length === 0 ? (
              <EmptyState icon={GraduationCap} title="ยังไม่มีบทเรียน" description="สร้างบทเรียนแรกด้านบน" />
            ) : (
              <ul className="space-y-2">
                {courseArticles.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(article.id)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-colors",
                        selectedId === article.id ? "border-primary/40 bg-primary/5" : "border-line/5 hover:bg-line/5"
                      )}
                    >
                      <p className="truncate text-xs text-secondary/40">{article.module_title}</p>
                      <p className="truncate text-sm font-medium text-secondary">{article.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={article.status === "published" ? "success" : "outline"}>
                          {article.status === "published" ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
                        </Badge>
                        <span className="text-xs text-secondary/40">{article.sources.length} แหล่งอ้างอิง</span>
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
            <CourseArticleEditor
              key={selected.id}
              article={selected}
              onSave={(patch) => handleFieldSave(selected.id, patch)}
              onStatusChange={(status) => handleStatusChange(selected.id, status)}
              onDelete={() => handleDelete(selected.id)}
            />
          ) : (
            <CardContent>
              <EmptyState icon={GraduationCap} title="เลือกบทเรียน" description="เลือกบทเรียนจากรายการด้านซ้ายเพื่อดูและแก้ไข" />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

function CourseArticleEditor({
  article,
  onSave,
  onStatusChange,
  onDelete,
}: {
  article: Tables<"course_articles">;
  onSave: (patch: Partial<Tables<"course_articles">>) => void;
  onStatusChange: (status: "draft" | "published") => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(article.title);
  const [summary, setSummary] = useState(article.summary ?? "");
  const [content, setContent] = useState(article.content);
  const [dirty, setDirty] = useState(false);

  const fullMarkdown = `# ${title}\n\n${content}`;

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
          <CardTitle>แก้ไขบทเรียน</CardTitle>
          <CardDescription>{article.module_title}</CardDescription>
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
        <Field label="ชื่อบทเรียน">
          <div className="flex items-center gap-2">
            <Input value={title} onChange={(e) => markDirty(setTitle)(e.target.value)} />
            <CopyButton value={title} />
          </div>
        </Field>

        <Field label="สรุปย่อ">
          <div className="flex items-start gap-2">
            <Textarea value={summary} onChange={(e) => markDirty(setSummary)(e.target.value)} className="min-h-16" />
            <CopyButton value={summary} />
          </div>
        </Field>

        <Field label="เนื้อหาบทเรียน (Markdown)">
          <div className="flex items-start gap-2">
            <Textarea value={content} onChange={(e) => markDirty(setContent)(e.target.value)} className="min-h-96 font-mono text-xs" />
            <CopyButton value={fullMarkdown} />
          </div>
        </Field>

        {article.sources.length > 0 ? (
          <Field label={`แหล่งอ้างอิงจากเว็บ (${article.sources.length})`}>
            <ul className="space-y-1">
              {article.sources.map((s, i) => (
                <li key={i}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 truncate text-xs text-primary-accent underline"
                  >
                    {s.title || s.url} <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </li>
              ))}
            </ul>
          </Field>
        ) : null}

        <Button
          className="w-full"
          disabled={!dirty}
          onClick={() => {
            onSave({ title, summary, content });
            setDirty(false);
          }}
        >
          บันทึกการแก้ไข
        </Button>
      </CardContent>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-secondary/60">{label}</label>
      {children}
    </div>
  );
}
