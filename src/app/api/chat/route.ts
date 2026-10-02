import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/automations/admin-client'

export const runtime = 'nodejs'

type Item = { id: string; name: string; price: number; quantity: number }

const catalog: Omit<Item, 'quantity'>[] = [
  { id: 'demo-kit', name: 'Kit de bienvenida', price: 49 },
  { id: 'demo-consulta', name: 'Consulta comercial', price: 120 },
]

function reply(message: string, items: Item[], name?: string) {
  const text = message.toLowerCase()
  if (!items.length) {
    const product = catalog.find((p) => text.includes('kit') || text.includes('bienvenida')) ?? catalog[0]
    const quantity = Math.max(1, Number(text.match(/\d+/)?.[0] ?? 1))
    return { content: `Perfecto. ${quantity} × ${product.name} son S/ ${(product.price * quantity).toFixed(2)}. ¿Confirmas el pedido?`, items: [{ ...product, quantity }] }
  }
  if (/(confirm|sí|si|adelante|acepto)/i.test(text)) {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    return { content: `¡Pedido confirmado${name ? `, ${name}` : ''}! Total: S/ ${total.toFixed(2)}. El equipo de VUNIKO se pondrá en contacto contigo.`, items }
  }
  return { content: 'Tengo tu pedido preparado. Responde “confirmar” para registrarlo, o dime qué deseas cambiar.', items }
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
  const { data: history } = await admin.from('public_chat_messages').select('role,content').eq('session_id', session.id).order('created_at', { ascending: true })
  const items: Item[] = Array.isArray(session.cart) ? session.cart : []
  const result = reply(message, items, body.customerName ?? session.customer_name)
  await admin.from('public_chat_messages').insert([{ session_id: session.id, role: 'customer', content: message }, { session_id: session.id, role: 'assistant', content: result.content }])
  const confirmed = items.length > 0 && /(confirm|sí|si|adelante|acepto)/i.test(message)
  if (confirmed) {
    const total = result.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    await admin.from('public_orders').insert({ session_id: session.id, account_id: accountId, customer_name: body.customerName ?? session.customer_name ?? 'Cliente web', customer_email: body.customerEmail ?? session.customer_email, items: result.items, total, status: 'confirmed' })
    await admin.from('public_chat_sessions').update({ cart: result.items, status: 'completed' }).eq('id', session.id)
  } else {
    await admin.from('public_chat_sessions').update({ cart: result.items, customer_name: body.customerName ?? session.customer_name, customer_email: body.customerEmail ?? session.customer_email }).eq('id', session.id)
  }
  return NextResponse.json({ sessionToken: session.visitor_token, messages: [...(history ?? []), { role: 'customer', content: message }, { role: 'assistant', content: result.content }], order: confirmed ? { items: result.items, total: result.items.reduce((sum, item) => sum + item.price * item.quantity, 0) } : null })
}
