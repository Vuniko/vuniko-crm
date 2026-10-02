import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

const SELECT = 'id, public_key, name, welcome_message, accent_color, is_enabled'

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase.from('web_chat_widgets').select(SELECT).eq('account_id',accountId).maybeSingle()
    if (error) throw error
    return NextResponse.json({ widget: data ?? null })
  } catch (err) { return toErrorResponse(err) }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const body = await request.json().catch(()=>({}))
    const color = typeof body.accent_color === 'string' && /^#[0-9a-f]{6}$/i.test(body.accent_color) ? body.accent_color : '#111111'
    const row = {
      account_id: accountId,
      name: typeof body.name === 'string' ? body.name.trim().slice(0,80) || 'Website chat' : 'Website chat',
      welcome_message: typeof body.welcome_message === 'string' ? body.welcome_message.trim().slice(0,500) || 'Hi! How can we help?' : 'Hi! How can we help?',
      accent_color: color,
      is_enabled: body.is_enabled !== false,
    }
    const { data,error }=await supabase.from('web_chat_widgets').upsert(row,{onConflict:'account_id'}).select(SELECT).single()
    if(error) throw error
    return NextResponse.json({widget:data})
  } catch(err){ return toErrorResponse(err) }
}
