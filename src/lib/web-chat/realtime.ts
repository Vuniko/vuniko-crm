import { createHmac } from "crypto";

export type WebChatRealtimeMessage = {
  id: string;
  sender_type: "customer" | "agent" | "bot";
  content_type: string;
  content_text: string | null;
  created_at: string;
};

export function webChatRealtimeTopic(conversationId: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const digest = createHmac("sha256", secret).update(conversationId).digest("hex").slice(0, 32);
  return `web-chat:${digest}`;
}

export async function broadcastWebChatMessage(
  conversationId: string,
  message: WebChatRealtimeMessage,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  try {
    const response = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [{
          topic: webChatRealtimeTopic(conversationId),
          event: "message",
          payload: message,
          private: false,
        }],
      }),
    });
    if (!response.ok) {
      console.warn("[web-chat realtime] broadcast failed:", response.status);
    }
  } catch (error) {
    console.warn("[web-chat realtime] broadcast unavailable; polling fallback remains active:", error);
  }
}
