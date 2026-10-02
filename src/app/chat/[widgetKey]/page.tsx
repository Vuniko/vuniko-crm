"use client";

import { FormEvent, useMemo, useState } from "react";

type ChatMessage = { id: string; role: "visitor" | "business"; text: string };

export default function WebChatPage({
  params,
}: {
  params: Promise<{ widgetKey: string }>;
}) {
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const widgetKey = useMemo(() => params.then((p) => p.widgetKey), [params]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    const optimistic = { id: crypto.randomUUID(), role: "visitor" as const, text };
    setMessages((current) => [...current, optimistic]);

    const key = await widgetKey;
    const response = await fetch("/api/web-chat/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ widgetKey: key, text }),
    });

    if (!response.ok) {
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "business", text: "We couldn't send that message. Please try again." },
      ]);
    }
  }

  if (!open) {
    return (
      <main className="flex min-h-screen items-end justify-end bg-transparent p-4">
        <button className="h-14 w-14 rounded-full bg-black text-2xl text-white shadow-lg" onClick={() => setOpen(true)} aria-label="Open chat">💬</button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-end justify-end bg-transparent p-4">
      <section className="flex h-[560px] w-full max-w-sm flex-col overflow-hidden rounded-3xl border bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b p-4">
          <div><p className="font-semibold">VUNIKO</p><p className="text-sm text-neutral-500">How can we help?</p></div>
          <button onClick={() => setOpen(false)} aria-label="Close chat">×</button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="max-w-[85%] rounded-2xl bg-neutral-100 p-3 text-sm">Hi! 👋 How can we help?</div>
          {messages.map((message) => (
            <div key={message.id} className={message.role === "visitor" ? "ml-auto max-w-[85%] rounded-2xl bg-black p-3 text-sm text-white" : "max-w-[85%] rounded-2xl bg-neutral-100 p-3 text-sm"}>{message.text}</div>
          ))}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a message…" className="min-w-0 flex-1 rounded-full border px-4 py-2 text-sm outline-none" />
          <button className="rounded-full bg-black px-4 py-2 text-sm text-white" type="submit">Send</button>
        </form>
      </section>
    </main>
  );
}
