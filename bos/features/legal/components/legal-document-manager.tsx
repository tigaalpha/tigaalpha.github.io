"use client";

import { useEffect, useState } from "react";
import { Scale, Sparkles, AlertTriangle, Copy, Check } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Tables, LegalDocumentType } from "@/types/database";

type LegalDocument = Tables<"legal_documents">;
type CustomerRow = Tables<"customers">;

const TYPE_LABEL: Record<LegalDocumentType, string> = {
  enrollment_contract: "สัญญาลงทะเบียนเรียน",
  parental_consent: "หนังสือยินยอมผู้ปกครอง",
};

export function LegalDocumentManager() {
  const [type, setType] = useState<LegalDocumentType>("enrollment_contract");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerRow[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [documents, setDocuments] = useState<LegalDocument[] | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const repos = createRepositories(createClient());
    repos.legalDocuments.listRecent(50).then(setDocuments);
  }, []);

  useEffect(() => {
    if (!customerQuery.trim()) {
      setCustomerResults([]);
      return;
    }
    const repos = createRepositories(createClient());
    const timeout = setTimeout(() => {
      repos.customers.search(customerQuery.trim(), 5).then(setCustomerResults);
    }, 300);
    return () => clearTimeout(timeout);
  }, [customerQuery]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-legal-document`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ type, customerId: selectedCustomer?.id }),
      });
      const data = await response.json();
      if (response.ok) {
        setDocuments((prev) => [data.document, ...(prev ?? [])]);
      } else {
        setError(data.error ?? "สร้างเอกสารไม่สำเร็จ");
      }
    } catch (err) {
      console.error("Failed to generate legal document:", err);
      setError("สร้างเอกสารไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setGenerating(false);
    }
  }

  function copyDocument(doc: LegalDocument) {
    navigator.clipboard.writeText(doc.content);
    setCopiedId(doc.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex items-start gap-3 pt-6 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            เอกสารทุกฉบับที่สร้างโดย AI เป็นเพียง<b>ฉบับร่าง ยังไม่ผ่านการตรวจสอบทางกฎหมาย</b> — กรุณาให้ทนายความตรวจสอบก่อนนำไปใช้จริงกับลูกค้าทุกครั้ง
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary-accent" />
            สร้างเอกสารใหม่
          </CardTitle>
          <CardDescription>เลือกประเภทเอกสาร และลูกค้า (ไม่บังคับ) เพื่อให้ AI ร่างให้</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as LegalDocumentType)}
            className="h-10 w-full rounded-xl border border-line/10 bg-card px-3 text-sm text-secondary focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="enrollment_contract">สัญญาลงทะเบียนเรียน</option>
            <option value="parental_consent">หนังสือยินยอมผู้ปกครอง</option>
          </select>

          <div className="relative">
            <Input
              placeholder="ค้นหาลูกค้า (ไม่บังคับ)"
              value={selectedCustomer ? selectedCustomer.name : customerQuery}
              onChange={(e) => {
                setSelectedCustomer(null);
                setCustomerQuery(e.target.value);
              }}
            />
            {customerResults.length > 0 && !selectedCustomer ? (
              <div className="absolute z-10 mt-1 w-full rounded-xl border border-line/10 bg-card shadow-card">
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-line/5"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setCustomerResults([]);
                    }}
                  >
                    {c.name} {c.phone ? `— ${c.phone}` : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {error ? <p className="text-xs text-danger">{error}</p> : null}
          <Button className="w-full" onClick={() => void generate()} disabled={generating}>
            <Sparkles className="h-4 w-4" />
            {generating ? "กำลังร่าง..." : "สร้างเอกสาร"}
          </Button>
        </CardContent>
      </Card>

      {documents === null ? null : documents.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-secondary/50">ยังไม่มีเอกสาร</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{TYPE_LABEL[doc.type]}</Badge>
                  <span className="text-xs text-secondary/50">{new Date(doc.created_at).toLocaleString("th-TH")}</span>
                </div>
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-line/5 p-3 text-xs text-secondary">{doc.content}</pre>
                <Button size="sm" variant="outline" onClick={() => copyDocument(doc)}>
                  {copiedId === doc.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  คัดลอก
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
