import { NextResponse } from 'next/server'
import { getCurrentAccount, requireRole, toErrorResponse } from '@/lib/auth/account'

const FIELDS = [
  'business_name','description','location_text','business_hours',
  'services','pricing','faqs','policies',
] as const

export async function GET() {
  try {
    const { supabase, accountId } = await getCurrentAccount()
    const { data, error } = await supabase.from('business_profiles')
      .select(FIELDS.join(',')).eq('account_id', accountId).maybeSingle()
    if (error) throw error
    return NextResponse.json({ profile: data ?? null })
  } catch (err) { return toErrorResponse(err) }
}

export async function PUT(request: Request) {
  try {
    const { supabase, accountId } = await requireRole('admin')
    const body = await request.json().catch(() => ({}))
    const row: Record<string,string> = {}
    for (const field of FIELDS) row[field] = typeof body[field] === 'string' ? body[field].trim().slice(0, 12000) : ''
    const { data, error } = await supabase.from('business_profiles')
      .upsert({ account_id: accountId, ...row, updated_at: new Date().toISOString() }, { onConflict: 'account_id' })
      .select(FIELDS.join(',')).single()
    if (error) throw error
    return NextResponse.json({ profile: data })
  } catch (err) { return toErrorResponse(err) }
}
