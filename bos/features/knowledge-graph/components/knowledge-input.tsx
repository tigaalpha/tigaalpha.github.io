"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileText, Upload, X } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { extractFileText } from "@/lib/extract-file-text";
import { cn, describeFunctionError } from "@/lib/utils";
import { useLang } from "@/lib/language-context";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { SOURCE_TYPES } from "@/features/knowledge/components/knowledge-manager";
import type { KnowledgeSourceType } from "@/types/database";

/* ── Add data & knowledge ──────────────────────────────────────────────────
   The CTA on the knowledge-graph header opens this page. Two input modes:
   typed/pasted text, or a file of any type.
     • .pdf / .docx / plain text  → read client-side into text, then saved
       through the existing knowledge-upload edge function, so it is chunked
       and embedded into the RAG the AI answers from (the graph's
       คลังความรู้ domain counts these rows).
     • everything else (video, audio, images, …) → the original binary is
       stored in Supabase Storage (knowledge-files, falling back to the
       already-existing slips bucket) and a knowledge_documents row records
       the file (file_path + a human-readable note), so it counts in the
       graph too. If storage rejects it, the row is still saved and the UI
       says plainly that the original file was not kept. ────────────────── */

/** knowledge-upload rejects anything longer — keep the client under it. */
const MAX_CONTENT_CHARS = 200_000;

/** Storage buckets tried in order for binary files. `knowledge-files` is the
    dedicated bucket (supabase-knowledge-files-bucket-migration.sql); `slips`
    is a bucket this app already uploads to from the client today, so it is a
    working fallback until that migration has been run. */
const STORAGE_BUCKETS = ["knowledge-files", "slips"];

type Mode = "text" | "file";
type Phase = "idle" | "reading" | "uploading" | "saving" | "done";

const COPY = {
  th: {
    title: "เพิ่มข้อมูล & องค์ความรู้ธุรกิจ",
    subtitle: "พิมพ์เป็นข้อความ หรืออัปโหลดไฟล์ — PDF, Word, วิดีโอ, เสียง และไฟล์อื่น ๆ ได้ทุกชนิด ทุกอย่างบันทึกลงในกราฟองค์ความรู้",
    back: "กลับไปกราฟองค์ความรู้",
    titleLbl: "หัวข้อ",
    titlePh: "เช่น ราคาคอร์สเปียโน ปี 2569",
    catLbl: "หมวดหมู่",
    tabText: "พิมพ์เป็นข้อความ",
    tabFile: "อัปโหลดไฟล์",
    textPh: "พิมพ์หรือวางข้อมูลที่ต้องการให้ธุรกิจจดจำ — ราคา โปรโมชัน นโยบาย คำถามที่พบบ่อย สคริปต์ขาย ฯลฯ…",
    drop: "ลากไฟล์มาวางที่นี่ หรือแตะเพื่อเลือกไฟล์",
    dropSub: "PDF · Word · ข้อความ · วิดีโอ · เสียง · รูปภาพ และไฟล์อื่น ๆ ทุกชนิด",
    noFile: "ยังไม่ได้เลือกไฟล์",
    removeFile: "เอาไฟล์ออก",
    save: "บันทึกลงกราฟองค์ความรู้",
    saving: "กำลังบันทึก…",
    reading: "กำลังอ่านข้อมูลจากไฟล์…",
    uploading: "กำลังอัปโหลดไฟล์…",
    pickFileFirst: "เลือกไฟล์ก่อนบันทึก",
    needTitle: "ใส่หัวข้อก่อนบันทึก",
    needContent: "พิมพ์ข้อความก่อนบันทึก",
    successTitle: "บันทึกเรียบร้อยแล้ว!",
    successBody: "เพิ่มลงในหมวดคลังความรู้ของกราฟองค์ความรู้เรียบร้อย — เปิดหน้ากราฟใหม่เพื่อเห็นข้อมูลล่าสุดบนแผนผัง",
    viewGraph: "ดูกราฟองค์ความรู้",
    addMore: "เพิ่มข้อมูลอีก",
    truncated: "ข้อความยาวเกินขีดจำกัดของระบบ จึงเก็บเฉพาะ 200,000 อักขระแรก",
    emptyFile: "ไม่พบข้อความในไฟล์นี้ จึงเก็บเป็นไฟล์ต้นฉบับแทน",
    readFail: "อ่านข้อความจากไฟล์ไม่สำเร็จ จึงเก็บเป็นไฟล์ต้นฉบับแทน",
    noStorage: "บันทึกข้อมูลไฟล์ลงกราฟแล้ว แต่ยังเก็บไฟล์ต้นฉบับไม่สำเร็จ — ต้องเพิ่ม storage ก่อน (รันไฟล์ supabase-knowledge-files-bucket-migration.sql ใน SQL Editor แล้วอัปโหลดใหม่)",
    fileLbl: "ไฟล์แนบ",
    storedAt: "เก็บไฟล์ไว้ที่",
    notStored: "ยังเก็บไฟล์ต้นฉบับไม่ได้",
    failedRead: "การอ่านข้อความล้มเหลว",
  },
  en: {
    title: "Add data & knowledge",
    subtitle: "Type text or upload a file — PDF, Word, video, audio, any file type. Everything is saved into the business knowledge graph.",
    back: "Back to the knowledge graph",
    titleLbl: "Title",
    titlePh: "e.g. Piano course pricing 2026",
    catLbl: "Category",
    tabText: "Type text",
    tabFile: "Upload a file",
    textPh: "Type or paste the knowledge the business should keep — pricing, promotions, policies, FAQs, sales scripts…",
    drop: "Drag a file here, or tap to choose one",
    dropSub: "PDF · Word · Text · Video · Audio · Images · any file type",
    noFile: "No file selected yet",
    removeFile: "Remove file",
    save: "Save to knowledge graph",
    saving: "Saving…",
    reading: "Reading the file…",
    uploading: "Uploading the file…",
    pickFileFirst: "Choose a file before saving",
    needTitle: "Add a title before saving",
    needContent: "Type some text before saving",
    successTitle: "Saved!",
    successBody: "Added to the Knowledge Base domain of the knowledge graph — reopen the graph to see it on the map.",
    viewGraph: "View knowledge graph",
    addMore: "Add more",
    truncated: "Text exceeds the system limit — only the first 200,000 characters were kept",
    emptyFile: "No text found in this file — the original file was stored instead",
    readFail: "Couldn't read text from this file — the original file was stored instead",
    noStorage: "The file's info was saved to the graph, but the original file could not be stored yet — the storage bucket must be added first (run supabase-knowledge-files-bucket-migration.sql in the SQL Editor, then upload again)",
    fileLbl: "Attached file",
    storedAt: "Stored at",
    notStored: "Original file not stored",
    failedRead: "Text extraction failed",
  },
} as const;

/** Text-capable files are read into RAG content; anything else is kept as an
    original binary in Storage. */
async function readTextIfPossible(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractFileText(file);
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractFileText(file);
  }
  if (file.type.startsWith("text/") || /\.(txt|md|csv|tsv|json|html?|rtf|log)$/i.test(file.name)) {
    return file.text();
  }
  return null;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function baseTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function KnowledgeInput() {
  const { lang } = useLang();
  const c = lang === "th" ? COPY.th : COPY.en;

  const [mode, setMode] = useState<Mode>("text");
  const [phase, setPhase] = useState<Phase>("idle");
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<KnowledgeSourceType>("faq");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = phase === "reading" || phase === "uploading" || phase === "saving";
  const submitLabel =
    phase === "reading" ? c.reading : phase === "uploading" ? c.uploading : phase === "saving" ? c.saving : c.save;

  function reset() {
    setPhase("idle");
    setTitle("");
    setContent("");
    setFile(null);
    setError(null);
    setWarn(null);
  }

  async function saveAsText(titleToUse: string, body: string, notes: string[]): Promise<void> {
    const supabase = createClient();
    let text = body;
    if (text.length > MAX_CONTENT_CHARS) {
      text = text.slice(0, MAX_CONTENT_CHARS);
      notes.push(c.truncated);
    }
    // Same pipeline the Knowledge Base page uses: the edge function chunks +
    // embeds server-side (Gemini key stays server-side), so the graph's
    // knowledge domain and RAG answers both pick the content up.
    const { error: fnError } = await supabase.functions.invoke("knowledge-upload", {
      body: { title: titleToUse, sourceType, content: text },
    });
    if (fnError) throw fnError;
  }

  async function saveBinary(titleToUse: string, chosen: File, notes: string[]): Promise<void> {
    const supabase = createClient();
    const repos = createRepositories(supabase);
    setPhase("uploading");

    const safeName = chosen.name.replace(/[^\p{L}\p{N}._-]+/gu, "_") || "file";
    const path = `knowledge/${Date.now()}-${safeName}`;
    const mime = chosen.type || "application/octet-stream";

    let storedPath: string | null = null;
    let lastStoreError = "";
    for (const bucket of STORAGE_BUCKETS) {
      const { error } = await supabase.storage.from(bucket).upload(path, chosen, { contentType: mime, upsert: false });
      if (!error) {
        storedPath = `${bucket}/${path}`;
        break;
      }
      lastStoreError = error.message;
    }

    const noteLines = [`${c.fileLbl}: ${chosen.name} (${mime}, ${fmtSize(chosen.size)})`];
    if (storedPath) {
      noteLines.push(`${c.storedAt}: ${storedPath}`);
    } else {
      noteLines.push(`${c.notStored}: ${lastStoreError || "unknown error"}`);
      notes.push(c.noStorage);
    }

    const { data } = await supabase.auth.getUser();
    setPhase("saving");
    // Direct insert (RLS: knowledge_documents staff write) — no chunking, the
    // file itself has no text to embed; file_path keeps the storage location.
    await repos.knowledge.createDocument(titleToUse, sourceType, noteLines.join("\n"), data.user?.id, storedPath ?? undefined);
  }

  async function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setWarn(null);
    const titleToUse = title.trim();
    const body = content.trim();
    if (!titleToUse) {
      setError(c.needTitle);
      return;
    }
    if (!body) {
      setError(c.needContent);
      return;
    }
    setPhase("saving");
    try {
      const notes: string[] = [];
      await saveAsText(titleToUse, body, notes);
      setWarn(notes.length ? notes.join("\n") : null);
      setPhase("done");
    } catch (err) {
      setError(await describeFunctionError(err));
      setPhase("idle");
    }
  }

  async function handleFileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setWarn(null);
    const chosen = file;
    if (!chosen) {
      setError(c.pickFileFirst);
      return;
    }
    const titleToUse = title.trim() || baseTitle(chosen.name);
    if (!titleToUse) {
      setError(c.needTitle);
      return;
    }

    const notes: string[] = [];
    let extracted: string | null = null;
    setPhase("reading");
    try {
      extracted = await readTextIfPossible(chosen);
    } catch (err) {
      // A scanned/corrupt PDF still has value as the original file — fall
      // through to the binary path instead of failing the whole save.
      extracted = null;
      notes.push(`${c.readFail}: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      if (extracted !== null && extracted.trim()) {
        setPhase("saving");
        await saveAsText(titleToUse, extracted, notes);
      } else {
        if (extracted !== null) notes.push(c.emptyFile);
        await saveBinary(titleToUse, chosen, notes);
      }
      setWarn(notes.length ? notes.join("\n") : null);
      setPhase("done");
    } catch (err) {
      setError(await describeFunctionError(err));
      setPhase("idle");
    }
  }

  const backLink = (
    <Link
      href="/knowledge-graph"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:underline dark:text-purple-300"
    >
      <ArrowLeft className="h-4 w-4" />
      {c.back}
    </Link>
  );

  if (phase === "done") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {backLink}
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </span>
            <h2 className="text-lg font-bold text-secondary dark:text-white">{c.successTitle}</h2>
            <p className="max-w-md text-sm leading-relaxed text-secondary/60 dark:text-white/60">{c.successBody}</p>
            {warn ? (
              <p className="max-w-md whitespace-pre-wrap rounded-xl bg-line/[0.06] px-3 py-2 text-xs leading-relaxed text-secondary/60 dark:bg-white/[0.06] dark:text-white/60">
                {warn}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Link
                href="/knowledge-graph"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary-gradient px-4 text-sm font-medium text-white shadow-soft transition-opacity hover:opacity-90"
              >
                {c.viewGraph}
              </Link>
              <Button type="button" variant="outline" onClick={reset}>
                {c.addMore}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      {backLink}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-secondary dark:text-white">{c.title}</h1>
        <p className="mt-1 text-sm text-secondary/50 dark:text-white/50">{c.subtitle}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <form onSubmit={mode === "text" ? handleTextSubmit : handleFileSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="kg-add-title" className="text-xs font-semibold uppercase tracking-wider text-secondary/40 dark:text-white/40">
                {c.titleLbl}
              </label>
              <Input id="kg-add-title" placeholder={c.titlePh} value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="kg-add-cat" className="text-xs font-semibold uppercase tracking-wider text-secondary/40 dark:text-white/40">
                {c.catLbl}
              </label>
              <select
                id="kg-add-cat"
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
            </div>

            {/* input mode tabs */}
            <div className="flex gap-1 rounded-xl bg-line/[0.06] p-1 dark:bg-white/[0.06]">
              {([["text", c.tabText], ["file", c.tabFile]] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setMode(key);
                    setError(null);
                  }}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    mode === key
                      ? "bg-white text-secondary shadow-soft dark:bg-white/10 dark:text-white"
                      : "text-secondary/50 hover:text-secondary/80 dark:text-white/50 dark:hover:text-white/80"
                  )}
                >
                  {key === "text" ? <FileText className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                  {label}
                </button>
              ))}
            </div>

            {mode === "text" ? (
              <Textarea
                placeholder={c.textPh}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-44"
              />
            ) : (
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const chosen = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (chosen) {
                      setFile(chosen);
                      setError(null);
                    }
                  }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) {
                      setFile(dropped);
                      setError(null);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-line/15 hover:border-primary/50 dark:border-white/15 dark:hover:border-primary/50"
                  )}
                >
                  <Upload className="h-6 w-6 text-secondary/40 dark:text-white/40" />
                  <p className="text-sm font-medium text-secondary/70 dark:text-white/70">{c.drop}</p>
                  <p className="text-xs text-secondary/40 dark:text-white/40">{c.dropSub}</p>
                </div>
                {file ? (
                  <div className="flex items-center gap-2 rounded-xl border border-line/10 bg-line/[0.04] px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-sm text-secondary dark:text-white">{file.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-secondary/40 dark:text-white/40">
                      {fmtSize(file.size)}
                    </span>
                    <button
                      type="button"
                      aria-label={c.removeFile}
                      onClick={() => setFile(null)}
                      className="shrink-0 rounded-md p-1 text-secondary/40 transition-colors hover:text-secondary dark:text-white/40 dark:hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-secondary/40 dark:text-white/40">{c.noFile}</p>
                )}
              </div>
            )}

            {error ? <p className="text-xs text-danger">{error}</p> : null}
            {warn ? (
              <p className="whitespace-pre-wrap text-xs text-secondary/50 dark:text-white/50">{warn}</p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={busy || (mode === "file" && !file)}
            >
              {submitLabel}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
