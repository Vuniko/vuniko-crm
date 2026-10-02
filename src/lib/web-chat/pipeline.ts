import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadIntent } from '@/lib/web-chat/intent'

const INTENT_STAGE_HINTS: Record<Exclude<LeadIntent,'general'|'human'>, string[]> = {
  price: ['proposal', 'cotiz', 'quote', 'qualified', 'interes'],
  booking: ['negotiation', 'reserv', 'booking', 'qualified', 'interes'],
  purchase: ['negotiation', 'venta', 'sale', 'qualified', 'interes'],
}

export async function syncLeadToPipeline(args: {
  db: SupabaseClient
  accountId: string
  ownerUserId: string
  conversationId: string
  contactId: string
  intent: LeadIntent
}) {
  const { db, accountId, ownerUserId, conversationId, contactId, intent } = args
  if (intent === 'general' || intent === 'human') return

  const { data: pipeline } = await db.from('pipelines').select('id')
    .eq('account_id', accountId).order('created_at').limit(1).maybeSingle()
  if (!pipeline) return

  const { data: stages } = await db.from('pipeline_stages').select('id,name,position')
    .eq('pipeline_id', pipeline.id).order('position')
  if (!stages?.length) return

  const hints = INTENT_STAGE_HINTS[intent]
  const desired = stages.find((stage) => hints.some((hint) => stage.name.toLocaleLowerCase().includes(hint)))
    ?? stages[Math.min(intent === 'price' ? 1 : 2, stages.length - 1)]
    ?? stages[0]

  const { data: existing } = await db.from('deals').select('id,stage_id,status')
    .eq('account_id', accountId).eq('conversation_id', conversationId).eq('status','open').maybeSingle()

  if (existing) {
    const currentIndex = stages.findIndex((s) => s.id === existing.stage_id)
    const desiredIndex = stages.findIndex((s) => s.id === desired.id)
    if (desiredIndex > currentIndex) {
      await db.from('deals').update({ stage_id: desired.id, source_intent: intent }).eq('id', existing.id)
    } else {
      await db.from('deals').update({ source_intent: intent }).eq('id', existing.id)
    }
    return
  }

  const { data: contact } = await db.from('contacts').select('name,email,phone').eq('id',contactId).maybeSingle()
  const label = contact?.name || contact?.email || contact?.phone || 'Website lead'
  await db.from('deals').insert({
    user_id: ownerUserId,
    account_id: accountId,
    pipeline_id: pipeline.id,
    stage_id: desired.id,
    contact_id: contactId,
    conversation_id: conversationId,
    title: `${label} — Web lead`,
    value: 0,
    currency: 'USD',
    status: 'open',
    source: 'web_chat_ai',
    source_intent: intent,
    notes: `Automatically created from web chat. Detected intent: ${intent}.`,
  })
}
