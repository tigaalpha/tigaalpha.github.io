"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, Plus, Pin, Copy, Check, Trash2, MessagesSquare } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { cn, describeFunctionError } from "@/lib/utils";
import type { Tables } from "@/types/database";

const STRATEGY_MODEL_OPTIONS: { id: string; label: string }[] = [
  { id: "gemini", label: "Gemini" },
  { id: "claude", label: "Claude" },
  { id: "gpt", label: "GPT" },
  { id: "grok", label: "Grok" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "kimi", label: "Kimi" },
  { id: "glm", label: "GLM" },
];

const MODEL_STORAGE_KEY = "tiga-strategy-selected-models";

function modelLabel(id: string): string {
  return STRATEGY_MODEL_OPTIONS.find((m) => m.id === id)?.label ?? id;
}

interface Turn {
  user: Tables<"strategy_messages"> | null;
  ai: Tables<"strategy_messages">[];
}

function groupIntoTurns(messages: Tables<"strategy_messages">[]): Turn[] {
  const turns: Turn[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      turns.push({ user: message, ai: [] });
    } else if (turns.length > 0) {
      turns[turns.length - 1]!.ai.push(message);
    } else {
      turns.push({ user: null, ai: [message] });
    }
  }
  return turns;
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
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

interface StrategyWorkspaceProps {
  initialSessions: Tables<"strategy_sessions">[];
  onSessionsChanged: () => void;
}

export function StrategyWorkspace({ initialSessions, onSessionsChanged }: StrategyWorkspaceProps) {
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Tables<"strategy_messages">[]>([]);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<Tables<"strategy_messages">[] | null>(null);
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<string[]>(["gemini"]);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length > 0) setSelectedModels(parsed);
      } catch {
        // ignore malformed stored value
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(selectedModels));
  }, [selectedModels]);

  function reloadMessages(sessionId: string) {
    const repos = createRepositories(createClient());
    repos.strategy.listMessages(sessionId).then(setMessages);
  }

  useEffect(() => {
    if (selectedSessionId) reloadMessages(selectedSessionId);
    else setMessages([]);
  }, [selectedSessionId]);

  function loadPinned() {
    const repos = createRepositories(createClient());
    repos.strategy.listPinned().then(setPinnedMessages);
  }

  useEffect(() => {
    if (showPinnedOnly) loadPinned();
  }, [showPinnedOnly]);

  function toggleModel(id: string) {
    setSelectedModels((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  async function ask() {
    if (!prompt.trim() || selectedModels.length === 0 || asking) return;
    setAsking(true);
    setError(null);
    const currentPrompt = prompt.trim();
    setPrompt("");
    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        sessionId: string;
        responses: { model: string; content?: string; error?: string }[];
      }>("strategy-ask", { body: { sessionId: selectedSessionId, prompt: currentPrompt, models: selectedModels } });
      if (fnError || !data) throw fnError ?? new Error("ไม่ได้รับคำตอบจากระบบ");

      const anyFailed = data.responses.some((r) => r.error);
      if (anyFailed) {
        const failedList = data.responses
          .filter((r) => r.error)
          .map((r) => `${modelLabel(r.model)}: ${r.error}`)
          .join(" / ");
        setError(`บางโมเดลตอบไม่สำเร็จ — ${failedList}`);
      }

      setSelectedSessionId(data.sessionId);
      reloadMessages(data.sessionId);
      if (!selectedSessionId) onSessionsChanged();
    } catch (err) {
      setPrompt(currentPrompt);
      setError(await describeFunctionError(err));
    } finally {
      setAsking(false);
    }
  }

  async function togglePin(message: Tables<"strategy_messages">) {
    const repos = createRepositories(createClient());
    await repos.strategy.togglePin(message.id, !message.pinned);
    if (selectedSessionId) reloadMessages(selectedSessionId);
    if (showPinnedOnly) loadPinned();
  }

  async function deleteSession(id: string) {
    const repos = createRepositories(createClient());
    await repos.strategy.deleteSession(id);
    if (selectedSessionId === id) setSelectedSessionId(null);
    onSessionsChanged();
  }

  const turns = useMemo(() => groupIntoTurns(messages), [messages]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <Card className="lg:col-span-1">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">หัวข้อที่คุยไว้</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setSelectedSessionId(null)} title="เริ่มหัวข้อใหม่">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <button
            type="button"
            onClick={() => setShowPinnedOnly((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
              showPinnedOnly ? "border-primary/40 bg-primary/5 text-secondary" : "border-line/10 text-secondary/70 hover:bg-line/5"
            )}
          >
            <Pin className="h-3.5 w-3.5" />
            ที่ปักหมุดไว้
          </button>

          {sessions.length === 0 ? (
            <EmptyState icon={MessagesSquare} title="ยังไม่มีหัวข้อ" description="พิมพ์คำถามด้านล่างเพื่อเริ่มหัวข้อแรก" />
          ) : (
            <ul className="space-y-1">
              {sessions.map((session) => (
                <li key={session.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinnedOnly(false);
                      setSelectedSessionId(session.id);
                    }}
                    className={cn(
                      "flex-1 truncate rounded-xl px-3 py-2 text-left text-sm transition-colors",
                      !showPinnedOnly && selectedSessionId === session.id
                        ? "bg-primary/10 text-secondary"
                        : "text-secondary/70 hover:bg-line/5"
                    )}
                  >
                    {session.title}
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => void deleteSession(session.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-danger" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardContent className="space-y-4 pt-6">
          {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

          {showPinnedOnly ? (
            <div className="space-y-3">
              {!pinnedMessages || pinnedMessages.length === 0 ? (
                <EmptyState icon={Pin} title="ยังไม่มีคำตอบที่ปักหมุดไว้" description="กด ★ ที่คำตอบไหนก็ได้เพื่อเก็บไว้ดูทีหลัง" />
              ) : (
                pinnedMessages.map((message) => (
                  <div key={message.id} className="rounded-xl border border-line/10 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <Badge variant="outline">{modelLabel(message.model ?? "")}</Badge>
                      <div className="flex items-center gap-1">
                        <CopyButton value={message.content} />
                        <Button variant="ghost" size="icon" onClick={() => void togglePin(message)}>
                          <Pin className="h-3.5 w-3.5 fill-current text-primary-accent" />
                        </Button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-secondary/80">{message.content}</p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
              {turns.length === 0 ? (
                <EmptyState icon={Sparkles} title="เริ่มถามคำถามกลยุทธ์แรกได้เลย" />
              ) : (
                turns.map((turn, i) => (
                  <div key={turn.user?.id ?? i} className="space-y-3">
                    {turn.user ? (
                      <div className="ml-auto max-w-[80%] rounded-2xl bg-primary-gradient px-4 py-2 text-sm text-white shadow-soft">
                        {turn.user.content}
                      </div>
                    ) : null}
                    {turn.ai.length > 0 ? (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {turn.ai.map((message) => (
                          <div key={message.id} className="rounded-xl border border-line/10 p-3">
                            <div className="mb-1 flex items-center justify-between">
                              <Badge variant="outline">{modelLabel(message.model ?? "")}</Badge>
                              <div className="flex items-center gap-1">
                                <CopyButton value={message.content} />
                                <Button variant="ghost" size="icon" onClick={() => void togglePin(message)}>
                                  <Pin className={cn("h-3.5 w-3.5", message.pinned && "fill-current text-primary-accent")} />
                                </Button>
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-secondary/80">{message.content}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-line/10 pt-4">
            <div className="flex flex-wrap gap-2">
              {STRATEGY_MODEL_OPTIONS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleModel(model.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    selectedModels.includes(model.id)
                      ? "border-primary/40 bg-primary/10 text-secondary"
                      : "border-line/10 text-secondary/50 hover:bg-line/5"
                  )}
                >
                  {model.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-secondary/40">
              เลือกได้หลายตัว — ยิ่งเลือกเยอะยิ่งใช้เวลา/ค่าใช้จ่ายเยอะขึ้นตาม โมเดลที่ยังไม่ได้ตั้งค่า API key จะตอบ error กลับมา
              (ตั้งค่าได้ที่ Settings)
            </p>
            <div className="flex items-end gap-2">
              <Textarea
                placeholder="ถามคำถามกลยุทธ์ธุรกิจ... เช่น ควรขึ้นราคาคอร์ส 40 ชม. ตอนนี้ไหม"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                className="min-h-16"
              />
              <Button onClick={() => void ask()} disabled={asking || !prompt.trim() || selectedModels.length === 0}>
                <Sparkles className="h-4 w-4" />
                {asking ? "กำลังคิด…" : "ถาม"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
