'use client';

import {
  FormEvent,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';

type WireMessage = {
  id: string;
  sender_type: 'customer' | 'agent' | 'bot';
  content_type: string;
  content_text: string | null;
  created_at: string;
};

export default function WebChatPage({
  params,
}: {
  params: Promise<{ widgetKey: string }>;
}) {
  const { widgetKey } = use(params);
  const [open, setOpen] = useState(true);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<WireMessage[]>([]);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [waitingForReply, setWaitingForReply] = useState(false);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const refreshingRef = useRef(false);
  const [realtimeTopic, setRealtimeTopic] = useState<string | null>(null);
  const [config, setConfig] = useState({
    name: 'VUNIKO',
    welcome_message: 'Hi! 👋 How can we help?',
    accent_color: '#111111',
  });
  const latestRef = useRef<string | null>(null);

  useEffect(() => {
    void fetch(`/api/web-chat/widget/${widgetKey}`, { cache: 'no-store' }).then(
      async (r) => {
        if (!r.ok) return;
        const j = await r.json();
        if (j.widget) {
          setConfig(j.widget);
          window.parent.postMessage(
            { type: 'vuniko:theme', color: j.widget.accent_color },
            '*'
          );
        }
      }
    );
    const key = `vuniko:web-chat:${widgetKey}`;
    const stored = localStorage.getItem(key);
    if (stored) setVisitorToken(stored);
  }, [widgetKey]);

  const refresh = useCallback(async () => {
    if (!visitorToken || refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const query = new URLSearchParams({ widgetKey, visitorToken });
      if (latestRef.current) query.set('after', latestRef.current);
      const response = await fetch(
        `/api/web-chat/messages/list?${query.toString()}`,
        {
          cache: 'no-store',
        }
      );
      if (!response.ok) return;
      const payload = (await response.json()) as {
        messages?: WireMessage[];
        realtimeTopic?: string;
      };
      if (payload.realtimeTopic) setRealtimeTopic(payload.realtimeTopic);
      const incoming = payload.messages ?? [];
      if (!incoming.length) return;
      if (
        incoming.some(
          (message) =>
            message.sender_type === 'agent' || message.sender_type === 'bot'
        )
      )
        setWaitingForReply(false);
      setMessages((current) => {
        const ids = new Set(current.map((message) => message.id));
        return [
          ...current,
          ...incoming.filter((message) => !ids.has(message.id)),
        ];
      });
      latestRef.current =
        incoming[incoming.length - 1]?.created_at ?? latestRef.current;
    } catch {
      // Realtime and the next poll can recover from a temporary connection loss.
    } finally {
      refreshingRef.current = false;
    }
  }, [visitorToken, widgetKey]);

  useEffect(() => {
    void refresh();
    // Stay below the API's 45 reads/minute limit; Realtime delivers fast replies.
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!realtimeTopic) return;
    const supabase = createClient();
    const channel = supabase
      .channel(realtimeTopic)
      .on('broadcast', { event: 'message' }, ({ payload }) => {
        const message = payload as WireMessage;
        if (!message?.id) return;
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : [...current, message]
        );
        // Only polling advances its cursor, so a broadcast cannot skip older rows.
        if (message.sender_type === 'agent' || message.sender_type === 'bot')
          setWaitingForReply(false);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [realtimeTopic]);

  async function sendText(text: string) {
    if (!text.trim() || sendingRef.current) return;
    sendingRef.current = true;
    setPendingText(text);
    setSendError(null);
    setWaitingForReply(true);
    try {
      const response = await fetch('/api/web-chat/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ widgetKey, text, visitorToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error('No se pudo enviar el mensaje. Intentá de nuevo.');

      const confirmed: WireMessage[] = [
        payload.message,
        ...(payload.replies ?? []),
      ].filter(Boolean);
      setMessages((current) => {
        const ids = new Set(current.map((message) => message.id));
        return [
          ...current,
          ...confirmed.filter((message) => !ids.has(message.id)),
        ].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
      if (payload.replies?.length) setWaitingForReply(false);
      if (payload.realtimeTopic) setRealtimeTopic(payload.realtimeTopic);

      if (payload.visitorToken && payload.visitorToken !== visitorToken) {
        try {
          localStorage.setItem(
            `vuniko:web-chat:${widgetKey}`,
            payload.visitorToken
          );
        } catch {
          /* Keep the active session usable. */
        }
        setVisitorToken(payload.visitorToken);
      }
    } catch {
      setWaitingForReply(false);
      setSendError(
        'No se pudo confirmar el envío. Revisá la conexión antes de reintentar.'
      );
      setDraft((current) => current || text);
    } finally {
      sendingRef.current = false;
      setPendingText(null);
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sendingRef.current) return;
    setDraft('');
    await sendText(text);
  }

  const quickActions = [
    { label: '✂️ Servicios', message: 'Quiero conocer los servicios.' },
    { label: '💰 Precios', message: 'Quiero conocer los precios.' },
    { label: '📅 Reservar', message: 'Quiero reservar un turno.' },
    {
      label: '👤 Hablar con alguien',
      message: 'Quiero hablar con una persona.',
    },
  ];

  if (!open) {
    return (
      <main className="flex min-h-screen items-end justify-end bg-transparent p-4">
        <button
          className="h-14 w-14 rounded-full bg-black text-2xl text-white shadow-lg"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
        >
          💬
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-end justify-end bg-transparent p-4">
      <section className="flex h-[560px] w-full max-w-sm flex-col overflow-hidden rounded-3xl border bg-white text-neutral-950 shadow-2xl">
        <header className="flex items-center justify-between border-b bg-white p-4 text-neutral-950">
          <div>
            <p className="font-semibold">{config.name}</p>
            <p className="text-sm text-neutral-500">Online</p>
          </div>
          <button onClick={() => setOpen(false)} aria-label="Close chat">
            ×
          </button>
        </header>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="max-w-[85%] rounded-2xl bg-neutral-100 p-3 text-sm text-neutral-950">
            {config.welcome_message}
          </div>
          {messages.length === 0 && !waitingForReply && (
            <div className="flex flex-wrap gap-2 pt-1">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => void sendText(action.message)}
                  className="rounded-full border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 active:scale-[.98]"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={
                message.sender_type === 'customer'
                  ? 'ml-auto max-w-[85%] rounded-2xl p-3 text-sm text-white'
                  : 'max-w-[85%] rounded-2xl bg-neutral-100 p-3 text-sm text-neutral-950'
              }
              style={
                message.sender_type === 'customer'
                  ? { backgroundColor: config.accent_color }
                  : undefined
              }
            >
              {message.content_text}
            </div>
          ))}
          {pendingText && (
            <div
              className="ml-auto max-w-[85%] rounded-2xl p-3 text-sm text-white opacity-70"
              style={{ backgroundColor: config.accent_color }}
            >
              {pendingText}
              <span className="block text-xs">Enviando…</span>
            </div>
          )}
          {waitingForReply && (
            <p role="status" className="text-sm text-neutral-500">
              {config.name} está escribiendo…
            </p>
          )}
          {sendError && (
            <p role="alert" className="text-sm text-red-600">
              {sendError}
            </p>
          )}
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t p-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribí un mensaje…"
            className="min-w-0 flex-1 rounded-full border bg-white px-4 py-2 text-sm text-neutral-950 outline-none placeholder:text-neutral-400"
          />
          <button
            disabled={pendingText !== null}
            className="rounded-full px-4 py-2 text-sm text-white disabled:opacity-50"
            style={{ backgroundColor: config.accent_color }}
            type="submit"
          >
            Enviar
          </button>
        </form>
      </section>
    </main>
  );
}
