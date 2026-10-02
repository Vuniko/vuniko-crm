import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'
import { loadAiConfig } from '@/lib/ai/config'
import { generateReply } from '@/lib/ai/generate'
import { AiError, type ChatMessage } from '@/lib/ai/types'

export const runtime = 'nodejs'

const PUBLIC_CHAT_SYSTEM_PROMPT = `
Eres el asistente web de VUNIKO. Atiendes clientes de forma clara, breve y profesional.
Responde en el idioma del cliente. Tu objetivo es resolver consultas y captar la intención
comercial sin inventar precios, productos, disponibilidad ni políticas que no aparezcan
en el contexto del negocio. Si falta información importante, dilo y pide el dato necesario.
Si el cliente pide hablar con una persona o no puedes resolver algo con seguridad, incluye
[[HANDOFF]] al final de tu respuesta.
`.trim()

function toAiMessages(
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
): ChatMessage[] {
  return [
    ...history.map((item) => ({
      role: item.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: item.content,
    })),
    { role: 'user' as const, content: currentMessage },
  ]
}

export async function POST(request: Request) {
  const accountId = process.env.PUBLIC_CHAT_ACCOUNT_ID
  if (!accountId) return NextResponse.json({ error: 'Configura PUBLIC_CHAT_ACCOUNT_ID en Vercel.' }, { status: 503 })
  const body = await request.json().catch(() => ({}))
  const message = String(body.message ?? '').trim()
  if (!message) return NextResponse.json({ error: 'Escribe un mensaje.' }, { status: 400 })
  const admin = supabaseAdmin()
  let session: any
  if (body.sessionToken) {
    const { data } = await admin.from('public_chat_sessions').select('*').eq('visitor_token', body.sessionToken).eq('account_id', accountId).maybeSingle()
    session = data
  }
  if (!session) {
    const token = crypto.randomUUID()
    const { data, error } = await admin.from('public_chat_sessions').insert({ account_id: accountId, visitor_token: token, customer_name: body.customerName ?? null, customer_email: body.customerEmail ?? null }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    session = data
  }
  const { data: history } = await admin
    .from('public_chat_messages')
    .select('role,content')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })

  const aiConfig = await loadAiConfig(admin, accountId)
  if (!aiConfig) {
    return NextResponse.json(
      { error: 'El asistente de IA todavía no está configurado para este negocio.' },
      { status: 503 },
    )
  }

  let generated
  try {
    generated = await generateReply({
      config: aiConfig,
      systemPrompt: [PUBLIC_CHAT_SYSTEM_PROMPT, aiConfig.systemPrompt]
        .filter(Boolean)
        .join('\n\n'),
      messages: toAiMessages(history ?? [], message),
    })
  } catch (error) {
    const aiError = error instanceof AiError ? error : null
    console.error('[public chat] AI generation failed', error)
    return NextResponse.json(
      { error: 'No pude responder ahora. Intenta nuevamente en unos segundos.' },
      { status: aiError?.status ?? 502 },
    )
  }

  const assistantContent =
    generated.text ||
    'Voy a derivar esta conversación a una persona del equipo para ayudarte.'

  const { error: insertError } = await admin.from('public_chat_messages').insert([
    { session_id: session.id, role: 'customer', content: message },
    { session_id: session.id, role: 'assistant', content: assistantContent },
  ])
  if (insertError) {
    console.error('[public chat] failed to persist messages', insertError)
    return NextResponse.json({ error: 'No pude guardar la conversación.' }, { status: 500 })
  }

  await admin
    .from('public_chat_sessions')
    .update({
      customer_name: body.customerName ?? session.customer_name,
      customer_email: body.customerEmail ?? session.customer_email,
      status: generated.handoff ? 'handoff' : session.status,
    })
    .eq('id', session.id)

  return NextResponse.json({
    sessionToken: session.visitor_token,
    messages: [
      ...(history ?? []),
      { role: 'customer', content: message },
      { role: 'assistant', content: assistantContent },
    ],
    handoff: generated.handoff,
  })
}
