import { redirect } from "next/navigation";
import { createClient } from "@/services/supabase/server";
import { AppShell } from "@/features/dashboard/components/app-shell";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();

  return (
    <AppShell userName={profile?.full_name ?? user.email ?? "User"} userEmail={user.email ?? ""}>
      {children}
    </AppShell>
  );
}
