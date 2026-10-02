import { createHash, randomBytes } from "crypto";
import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dispatchInboundToAiReply } from "@/lib/ai/auto-reply";
import { saveLeadIntent } from "@/lib/web-chat/intent";
import { syncLeadToPipeline } from "@/lib/web-chat/pipeline";
import { captureConversationalLead } from "@/lib/web-chat/lead-capture";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { advanceBookingRequest } from "@/lib/web-chat/booking";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: Request) {
  const body = (await request.json()) as { widgetKey?: string; text?: string; visitorToken?: string };
  const text = body.text?.trim();
  if (!body.widgetKey || !text || text.length > 4000) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const visitorRate = checkRateLimit(`web-chat:${ip}:${body.widgetKey}`, { limit: 20, windowMs: 60_000 });
  if (!visitorRate.success) return rateLimitResponse(visitorRate);

  const supabase = adminClient();
  const { data: widget } = await supabase
    .from("web_chat_widgets")
    .select("id, account_id, is_enabled")
    .eq("public_key", body.widgetKey)
    .maybeSingle();

  if (!widget?.is_enabled) return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });

  const visitorToken = body.visitorToken || randomBytes(24).toString("hex");
  const tokenHash = createHash("sha256").update(visitorToken).digest("hex");

  const { data: visitor } = await supabase
    .from("web_chat_visitors")
    .select("id, contact_id, conversation_id")
    .eq("widget_id", widget.id)
    .eq("visitor_token_hash", tokenHash)
    .maybeSingle();

  let contactId = visitor?.contact_id ?? null;
  let conversationId = visitor?.conversation_id ?? null;

  if (!contactId) {
    const { data: owner } = await supabase.from("accounts").select("owner_user_id").eq("id", widget.account_id).single();
    if (!owner) return NextResponse.json({ error: "Account unavailable" }, { status: 404 });
    const { data: contact, error } = await supabase.from("contacts").insert({
      account_id: widget.account_id,
      user_id: owner.owner_user_id,
      phone: "",
      name: "Website visitor",
    }).select("id").single();
    if (error || !contact) return NextResponse.json({ error: "Could not create visitor" }, { status: 500 });
    contactId = contact.id;

    const { data: conversation, error: convError } = await supabase.from("conversations").insert({
      account_id: widget.account_id,
      user_id: owner.owner_user_id,
      contact_id: contactId,
      channel: "web",
      status: "open",
    }).select("id").single();
    if (convError || !conversation) return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });
    conversationId = conversation.id;

    await supabase.from("web_chat_visitors").upsert({
      widget_id: widget.id,
      account_id: widget.account_id,
      contact_id: contactId,
      conversation_id: conversationId,
      visitor_token_hash: tokenHash,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "widget_id,visitor_token_hash" });
  }

  const now = new Date().toISOString();
  const { data: message, error: messageError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: "customer",
    content_type: "text",
    content_text: text,
    status: "delivered",
  }).select("id, created_at").single();

  if (messageError) return NextResponse.json({ error: "Could not send message" }, { status: 500 });

  await supabase.from("conversations").update({
    last_message_text: text,
    last_message_at: now,
    updated_at: now,
    unread_count: 1,
  }).eq("id", conversationId);

  const intent = await saveLeadIntent(supabase, conversationId!, text);

  // An explicit request for a person must stop automation immediately.
  // Leave the thread unassigned so any available agent can claim it from
  // the shared inbox; a configured AI handoff target may assign it later.
  if (intent.intent === "human") {
    await supabase.from("conversations").update({
      ai_autoreply_disabled: true,
      ai_handoff_summary: "Customer explicitly asked to speak with a person.",
    }).eq("id", conversationId);
  }

  const bookingState = await advanceBookingRequest({
    db: supabase,
    accountId: widget.account_id,
    conversationId: conversationId!,
    contactId: contactId!,
    text,
    intent: intent.intent,
  });

  const leadState = await captureConversationalLead({
    db: supabase,
    widgetId: widget.id,
    visitorId: visitor?.id ?? null,
    contactId: contactId!,
    text,
    intent: intent.intent,
  });

  const { data: account } = await supabase
    .from("accounts")
    .select("owner_user_id")
    .eq("id", widget.account_id)
    .single();

  if (account?.owner_user_id) {
    await syncLeadToPipeline({
      db: supabase,
      accountId: widget.account_id,
      ownerUserId: account.owner_user_id,
      conversationId: conversationId!,
      contactId: contactId!,
      intent: intent.intent,
    });

    if (intent.intent !== "human") {
      after(async () => {
        try {
          await dispatchInboundToAiReply({
            accountId: widget.account_id,
            conversationId: conversationId!,
            contactId: contactId!,
            configOwnerUserId: account.owner_user_id,
            leadCaptureState: leadState,
            bookingState,
          });
        } catch (error) {
          console.error("[web-chat] AI auto-reply failed:", error);
        }
      });
    }
  }

  return NextResponse.json({ ok: true, visitorToken, conversationId, message });
}
