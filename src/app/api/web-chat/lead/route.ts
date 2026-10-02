import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    widgetKey?: string; visitorToken?: string; name?: string; email?: string; phone?: string;
  };
  if (!body.widgetKey || !body.visitorToken) return NextResponse.json({ error: "Missing visitor credentials" }, { status: 400 });

  const supabase = adminClient();
  const { data: widget } = await supabase.from("web_chat_widgets").select("id, account_id, is_enabled")
    .eq("public_key", body.widgetKey).maybeSingle();
  if (!widget?.is_enabled) return NextResponse.json({ error: "Widget unavailable" }, { status: 404 });

  const tokenHash = createHash("sha256").update(body.visitorToken).digest("hex");
  const { data: visitor } = await supabase.from("web_chat_visitors")
    .select("id, contact_id").eq("widget_id", widget.id).eq("visitor_token_hash", tokenHash).maybeSingle();
  if (!visitor) return NextResponse.json({ error: "Visitor not found" }, { status: 404 });

  const name = body.name?.trim().slice(0, 120) || null;
  const email = body.email?.trim().slice(0, 320) || null;
  const phone = body.phone?.trim().slice(0, 50) || null;
  await supabase.from("web_chat_visitors").update({
    display_name: name, email, phone,
    lead_capture_completed: Boolean(name && (email || phone)),
    last_seen_at: new Date().toISOString(),
  }).eq("id", visitor.id);

  if (visitor.contact_id) {
    const update: Record<string,string> = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (phone) update.phone = phone;
    if (Object.keys(update).length) await supabase.from("contacts").update(update).eq("id", visitor.contact_id);
  }
  return NextResponse.json({ ok: true });
}
