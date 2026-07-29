import { createAdminClient } from "@/services/supabase-admin";
import { SocialMediaRepository } from "@/services/repositories/social-media.repository";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: Request) {
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
    const repo = new SocialMediaRepository(admin);
    const posts = await repo.getUserSocialPosts(user.id, 50);

    return Response.json({ posts });
  } catch (error) {
    console.error("GET /api/social-posts failed:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    const { content, platforms } = await req.json();

    if (!content || !platforms || platforms.length === 0) {
      return Response.json({ error: "content and platforms are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const repo = new SocialMediaRepository(admin);
    const post = await repo.createSocialPost(user.id, content, platforms);

    return Response.json({ post }, { status: 201 });
  } catch (error) {
    console.error("POST /api/social-posts failed:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
