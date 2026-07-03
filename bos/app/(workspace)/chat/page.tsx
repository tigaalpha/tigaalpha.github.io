import { createClient } from "@/services/supabase/server";
import { createRepositories } from "@/services/repositories";
import { Inbox } from "@/features/chat/components/inbox";

export default async function ChatPage() {
  const supabase = await createClient();
  const repos = createRepositories(supabase);
  const conversations = await repos.conversations.listRecent(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-secondary">Inbox</h1>
        <p className="text-sm text-secondary/50">AI-handled conversations across LINE and web chat</p>
      </div>
      <Inbox conversations={conversations} />
    </div>
  );
}
