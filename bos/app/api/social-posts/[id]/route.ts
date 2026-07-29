import { createAdminClient } from "@/services/supabase-admin";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (!token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("social_posts").delete().eq("id", params.id).eq("user_id", user.id);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/social-posts/[id] failed:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
