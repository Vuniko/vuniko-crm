import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";\nimport { webChatRealtimeTopic } from "@/lib/web-chat/realtime";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const widgetKey = url.searchParams.get("widgetKey");
  const visitorToken = url.searchParams.get("visitorToken");
  const after = url.searchParams.get("after");
  if (!widgetKey || !visitorToken) {
    return NextResponse.json({ error: "Missing visitor credentials" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const readRate = checkRateLimit(`web-chat-read:${ip}:${widgetKey}`, { limit: 45, windowMs: 60_000 });
  if (!readRate.success) return rateLimitResponse(readRate);

  const supabase = adminClient();
  const { data: widget } = await supabase.from("web_chat_widgets")
    .select("id, is_enabled").eq("public_key", widgetKey).maybeSingle();
  if (!widget?.is_enabled) return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });

  const tokenHash = createHash("sha256").update(visitorToken).digest("hex");
  const { data: visitor } = await supabase.from("web_chat_visitors")
    .select("conversation_id").eq("widget_id", widget.id)
    .eq("visitor_token_hash", tokenHash).maybeSingle();
  if (!visitor?.conversation_id) return NextResponse.json({ messages: [] });

  let query = supabase.from("messages")
    .select("id, sender_type, content_type, content_text, created_at")
    .eq("conversation_id", visitor.conversation_id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (after) query = query.gt("created_at", after);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Could not load messages" }, { status: 500 });
  return NextResponse.json({ messages: data ?? [], realtimeTopic: webChatRealtimeTopic(visitor.conversation_id) });
}
