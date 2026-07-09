"use client";

import { MessagesSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface ConversationListProps {
  conversations: Tables<"conversations">[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, selectedId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return <EmptyState icon={MessagesSquare} title="No conversations yet" className="m-4" />;
  }

  return (
    <ul className="divide-y divide-black/5">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <button
            onClick={() => onSelect(conversation.id)}
            className={cn(
              "flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-black/5",
              selectedId === conversation.id && "bg-primary/5"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-secondary">
                {conversation.channel.toUpperCase()} · {conversation.line_user_id?.slice(0, 10) ?? conversation.id.slice(0, 8)}
              </span>
              {conversation.needs_review ? <Badge variant="danger">Needs review</Badge> : null}
            </div>
            {conversation.summary ? (
              <p className="truncate text-xs text-secondary/50">{conversation.summary}</p>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
