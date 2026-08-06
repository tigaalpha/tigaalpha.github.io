"use client";

import { useRef, useState } from "react";
import { UserSquare2, Upload, Trash2 } from "lucide-react";
import { createClient } from "@/services/supabase/client";
import { createRepositories } from "@/services/repositories";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/types/database";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

interface ReferencePhotosManagerProps {
  photos: Tables<"reference_photos">[];
  onChanged: () => void;
}

function dataUrl(row: Tables<"reference_photos">): string {
  return `data:${row.mime_type};base64,${row.image_base64}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReferencePhotosManager({ photos, onChanged }: ReferencePhotosManagerProps) {
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("เลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("ไฟล์ใหญ่เกินไป (จำกัด 5MB)");
      return;
    }

    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const supabase = createClient();
      const repos = createRepositories(supabase);
      const { data } = await supabase.auth.getUser();
      await repos.referencePhotos.upload(label.trim() || file.name, file.type, base64, data.user?.id ?? null);
      setLabel("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "อัปโหลดรูปไม่สำเร็จ");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    const repos = createRepositories(createClient());
    await repos.referencePhotos.delete(id);
    onChanged();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserSquare2 className="h-4 w-4 text-primary-accent" />
          รูปภาพอ้างอิง
        </CardTitle>
        <CardDescription>
          เก็บรูปหน้าจริง (เช่น เจ้าของร้าน/ครู) ไว้ใช้เป็นข้อมูลอ้างอิงตอนสร้างภาพและวิดีโอ AI ที่หน้า Image Studio /
          Vertical Video ให้เป็นคนคนเดิมสม่ำเสมอ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-xs text-secondary/50">ชื่อ/label เช่น เจ้าของร้าน</label>
            <Input placeholder="เจ้าของร้าน" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <Upload className="h-4 w-4" />
            {uploading ? "กำลังอัปโหลด…" : "อัปโหลดรูป"}
          </Button>
        </div>
        {error ? <p className="text-xs text-danger">{error}</p> : null}

        {photos.length === 0 ? (
          <EmptyState icon={UserSquare2} title="ยังไม่มีรูปภาพอ้างอิง" description="อัปโหลดรูปแรกด้านบน" />
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative overflow-hidden rounded-xl border border-line/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUrl(photo)} alt={photo.label} className="aspect-square w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1">
                  <p className="truncate text-[10px] text-white">{photo.label}</p>
                </div>
                <button
                  onClick={() => void handleDelete(photo.id)}
                  className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
