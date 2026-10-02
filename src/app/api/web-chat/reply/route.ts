import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    conversation_id?: string;
    content_text?: string;
    reply_to_message_id?: string;
  };
  const text = body.content_text?.trim();
  if (!body.conversation_id || !text || text.length > 4000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, account_id, channel")
    .eq("id", body.conversation_id)
    .maybeSingle();

  if (!conversation || conversation.channel !== "web") {
    return NextResponse.json({ error: "Web conversation not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_type: "agent",
      sender_id: user.id,
      content_type: "text",
      content_text: text,
      status: "sent",
      reply_to_message_id: body.reply_to_message_id ?? null,
    })
    .select("*")
    .single();

  if (error || !message) {
    return NextResponse.json({ error: "Could not send message" }, { status: 500 });
  }

  await supabase.from("conversations").update({
    last_message_text: text,
    last_message_at: now,
    updated_at: now,
  }).eq("id", conversation.id);

  return NextResponse.json({ ok: true, message });
}
