"use client";

import { MultiChannelPost } from "@/features/marketing/components/multi-channel-post";

export default function PostPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Post ทุกช่องทาง</h1>
        <p className="text-sm text-secondary/50">โพสต์คอนเทนต์ไปทุก Marketing Channel ด้วยปุ่มเดียว</p>
      </div>
      <MultiChannelPost />
    </div>
  );
}
