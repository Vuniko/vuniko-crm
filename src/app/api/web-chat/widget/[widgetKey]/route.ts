import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(_: Request, { params }: { params: Promise<{ widgetKey: string }> }) {
  const { widgetKey } = await params
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}})
  const {data}=await db.from('web_chat_widgets').select('name,welcome_message,accent_color,is_enabled').eq('public_key',widgetKey).maybeSingle()
  if(!data?.is_enabled) return NextResponse.json({error:'Widget unavailable'},{status:404})
  return NextResponse.json({widget:{name:data.name,welcome_message:data.welcome_message,accent_color:data.accent_color || '#111111'}})
}
