"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Loader2, Piano, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import {
  QUIZ_LEVEL_RESULT,
  QUIZ_QUESTIONS,
  quizLeadSource,
  scoreQuizAnswers,
  type QuizLevel,
} from "@/lib/quiz-score";

/**
 * Public lead magnet — "ทดสอบระดับเปียโนของคุณ" at /studio/quiz.
 *
 * The funnel the dashboard advertises (landing-pages, lead-quiz) but that
 * never existed: quiz → result → lead form → CRM. Submission reuses the
 * public web-chat endpoint (same shared-secret model as chat-widget.js —
 * verify_jwt=false, x-web-chat-secret header) so the lead lands in the
 * normal Inbox pipeline with the quiz level stamped into lead_source, and
 * the AI can continue the conversation with the customer tools unlocked.
 * The widget secret is a site-embed key by design (not a user secret) —
 * fetched from this app's own /api path is impossible on static export, so
 * it is baked at build time exactly like chat-widget.js's documented
 * deployment. ?ref= URLs are honored: the code travels with the lead and
 * attributes the referral (0088 referral loop) the moment the form submits.
 */

type Step = "quiz" | "result" | "done";

const WEB_CHAT_URL = `${env.supabase.url().replace(/\/$/, "")}/functions/v1/web-chat`;
// Site-embed shared key (integration_settings `web_chat_secret`) — same one
// widget-demo.html ships with. Replace on rotation, same as the widget.
const WEB_CHAT_SECRET = "bbcd2cc4a0674dd187144648f7797122";

const REF_STORAGE_KEY = "tiga-quiz-ref";

function readReferralCode(): string {
  try {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("ref");
    if (fromUrl) {
      localStorage.setItem(REF_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return localStorage.getItem(REF_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export default function QuizPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-page"><Loader2 className="h-8 w-8 animate-spin text-primary" /></main>}>
      <QuizFlow />
    </Suspense>
  );
}

function QuizFlow() {
  const [step, setStep] = useState<Step>("quiz");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [level, setLevel] = useState<QuizLevel>("beginner");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState("");

  useEffect(() => {
    setRefCode(readReferralCode());
  }, []);

  const question = QUIZ_QUESTIONS[Math.min(qIndex, QUIZ_QUESTIONS.length - 1)];
  const progress = Math.round((qIndex / QUIZ_QUESTIONS.length) * 100);
  const result = QUIZ_LEVEL_RESULT[level];

  const pick = useCallback(
    (optionIndex: number) => {
      setAnswers((prev) => {
        const next = [...prev];
        next[qIndex] = optionIndex;
        return next;
      });
      if (qIndex + 1 < QUIZ_QUESTIONS.length) {
        setQIndex(qIndex + 1);
      } else {
        setLevel(scoreQuizAnswers(answers));
        setStep("result");
      }
    },
    [qIndex, answers]
  );

  const back = useCallback(() => {
    if (qIndex > 0) setQIndex(qIndex - 1);
  }, [qIndex]);

  const restart = useCallback(() => {
    setStep("quiz");
    setQIndex(0);
    setAnswers([]);
    setSubmitError(null);
  }, []);

  const submitLead = useCallback(async () => {
    if (!name.trim()) {
      setSubmitError("กรุณากรอกชื่อ");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(WEB_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-web-chat-secret": WEB_CHAT_SECRET },
        body: JSON.stringify({
          message: `สวัสดีค่ะ ฉันเพิ่งทำแบบทดสอบระดับเปียโน ผลออกมาคือระดับ ${result.label} อยากทราบข้อมูลคอร์ส ${result.course.name} เพิ่มเดิม`,
          lead: {
            name: name.trim(),
            phone: phone.trim() || undefined,
            source: quizLeadSource(level),
            referralCode: refCode || undefined,
          },
        }),
      });
      if (!res.ok) throw new Error(`submit failed (${res.status})`);
      setStep("done");
    } catch {
      setSubmitError("ส่งข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }, [name, phone, level, refCode, result]);

  if (step === "quiz") {
    return (
      <main className="flex min-h-screen flex-col bg-page">
        <header className="flex items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2">
            <Piano className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-secondary">TIGA Studio</span>
          </div>
          <span className="text-xs text-secondary/40">ทดสอบระดับเปียโนฟรี</span>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-10">
          <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-line/10">
            <div className="h-full rounded-full bg-primary-gradient transition-all duration-300" style={{ width: `${Math.max(progress, 4)}%` }} />
          </div>
          <p className="mt-2 text-right text-xs text-secondary/40">
            ข้อ {qIndex + 1}/{QUIZ_QUESTIONS.length}
          </p>

          <h1 className="mt-8 text-xl font-bold text-secondary sm:text-2xl">{question?.question}</h1>

          <div className="mt-5 flex flex-col gap-3">
            {(question?.options ?? []).map((opt, i) => {
              const chosen = answers[qIndex] === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => pick(i)}
                  className={cn(
                    "flex items-center justify-between rounded-xl border border-line/10 bg-card px-4 py-3.5 text-left text-sm text-secondary transition-all hover:border-primary/40 hover:shadow-soft",
                    chosen && "border-primary/60 bg-primary/5"
                  )}
                >
                  <span>{opt.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-secondary/30" />
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            {qIndex > 0 ? (
              <Button variant="ghost" size="sm" onClick={back}>
                ← ย้อนกลับ
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  if (step === "result") {
    return (
      <main className="flex min-h-screen flex-col bg-page">
        <header className="flex items-center justify-between px-5 pt-6">
          <div className="flex items-center gap-2">
            <Piano className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-secondary">TIGA Studio</span>
          </div>
          <button type="button" onClick={restart} className="flex items-center gap-1 text-xs text-secondary/40 hover:text-secondary/70">
            <RotateCcw className="h-3.5 w-3.5" /> ทำใหม่
          </button>
        </header>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 pb-12">
          <div className="mt-8 rounded-2xl border border-primary/20 bg-card p-6 text-center shadow-card">
            <div className="text-5xl">{result.emoji}</div>
            <p className="mt-3 text-xs uppercase tracking-widest text-secondary/40">ระดับของคุณคือ</p>
            <h1 className="mt-1 text-2xl font-bold text-secondary">{result.label}</h1>
            <div className="mt-5 rounded-xl bg-primary/5 p-4">
              <p className="text-xs text-secondary/50">คอร์สที่แนะนำสำหรับคุณ</p>
              <p className="mt-1 text-lg font-bold text-primary">{result.course.name}</p>
              <p className="text-sm font-semibold text-secondary/80">{result.course.price}</p>
              <p className="mt-2 text-xs leading-relaxed text-secondary/60">{result.course.blurb}</p>
            </div>
          </div>

          <p className="mt-8 text-center text-sm font-medium text-secondary">
            รับคำแนะนำเพิ่มเติมจากครู — กรอกข้อมูลแล้วทีมงานจะติดต่อกลับ
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <Input placeholder="ชื่อ-นามสกุล *" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            <Input
              placeholder="เบอร์โทรศัพท์ / LINE (ไม่บังคับ)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              inputMode="tel"
            />
            {submitError && <p className="text-xs text-danger">{submitError}</p>}
            <Button size="lg" onClick={submitLead} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              รับคำแนะนำฟรี
            </Button>
            <p className="text-center text-[11px] text-secondary/35">
              ข้อมูลของคุณจะถูกใช้เพื่อติดต่อกลับเรื่องคอร์สเรียนเท่านั้น
            </p>
          </div>
        </div>
      </main>
    );
  }

  // done
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-page px-5">
      <div className="w-full max-w-sm rounded-2xl border border-line/10 bg-card p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
        <h1 className="mt-4 text-xl font-bold text-secondary">ส่งข้อมูลเรียบร้อยแล้ว</h1>
        <p className="mt-2 text-sm leading-relaxed text-secondary/60">
          ขอบคุณค่ะ! ทีมงาน TIGA Studio จะติดต่อกลับโดยเร็ว
          <br />
          ระหว่างรอ ลองแชทกับครู AI ของเราได้เลย
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={restart} variant="outline">
            ทำแบบทดสอบอีกครั้ง
          </Button>
          <Link href="/" className="text-xs text-secondary/40 hover:text-secondary/70">
            กลับหน้าหลัก
          </Link>
        </div>
      </div>
    </main>
  );
}
