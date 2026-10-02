import type { SupabaseClient } from '@supabase/supabase-js'
import type { LeadIntent } from './intent'

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/
const NAME_PATTERNS = [
  /(?:me llamo|mi nombre es|soy)\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,3})/iu,
  /(?:i am|i'm|my name is)\s+([\p{L}][\p{L}'’-]*(?:\s+[\p{L}][\p{L}'’-]*){0,3})/iu,
]

export interface LeadState {
  name: string | null
  email: string | null
  phone: string | null
  qualified: boolean
  missing: Array<'name'|'contact'>
}

function cleanPhone(value: string | null) {
  if (!value) return null
  const plus = value.trim().startsWith('+') ? '+' : ''
  const digits = value.replace(/\D/g,'')
  return digits.length >= 8 && digits.length <= 15 ? plus + digits : null
}

function extractName(text: string) {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1].trim().replace(/[.,!?]+$/,'').slice(0,120)
  }
  return null
}

export async function captureConversationalLead(args: {
  db: SupabaseClient
  widgetId: string
  visitorId: string | null
  contactId: string
  text: string
  intent: LeadIntent
}): Promise<LeadState> {
  const { db, visitorId, contactId, text, intent } = args
  const { data: contact } = await db.from('contacts').select('name,email,phone').eq('id',contactId).maybeSingle()
  const { data: visitor } = visitorId
    ? await db.from('web_chat_visitors').select('display_name,email,phone').eq('id',visitorId).maybeSingle()
    : { data: null }

  const extractedEmail = text.match(EMAIL_RE)?.[0]?.toLowerCase() ?? null
  const extractedPhone = cleanPhone(text.match(PHONE_RE)?.[0] ?? null)
  const currentName = contact?.name && contact.name !== 'Website visitor' ? contact.name : visitor?.display_name
  const extractedName = currentName ? null : extractName(text)

  const name = currentName || extractedName || null
  const email = contact?.email || visitor?.email || extractedEmail || null
  const phone = cleanPhone(contact?.phone || visitor?.phone || extractedPhone)
  const qualified = intent !== 'general'
  const missing: LeadState['missing'] = []
  if (qualified && !name) missing.push('name')
  if (qualified && !email && !phone) missing.push('contact')

  const contactUpdate: Record<string,string> = {}
  if (extractedName) contactUpdate.name = extractedName
  if (extractedEmail) contactUpdate.email = extractedEmail
  if (extractedPhone) contactUpdate.phone = extractedPhone
  if (Object.keys(contactUpdate).length) await db.from('contacts').update(contactUpdate).eq('id',contactId)

  if (visitorId && (extractedName || extractedEmail || extractedPhone)) {
    await db.from('web_chat_visitors').update({
      ...(extractedName ? { display_name: extractedName } : {}),
      ...(extractedEmail ? { email: extractedEmail } : {}),
      ...(extractedPhone ? { phone: extractedPhone } : {}),
      lead_capture_completed: Boolean(name && (email || phone)),
      last_seen_at: new Date().toISOString(),
    }).eq('id',visitorId)
  }

  return { name, email, phone, qualified, missing }
}

export function leadCapturePrompt(state: LeadState): string | null {
  if (!state.qualified || state.missing.length === 0) return null
  const known = [
    state.name ? `name: ${state.name}` : null,
    state.email ? `email: ${state.email}` : null,
    state.phone ? `phone: ${state.phone}` : null,
  ].filter(Boolean).join(', ')
  const next = state.missing[0]
  return [
    'Lead capture state for this web-chat visitor.',
    known ? `Already known: ${known}.` : 'No verified contact details are known yet.',
    next === 'name'
      ? 'After answering the customer’s current question, naturally ask for their name. Ask only this one question.'
      : 'After answering the customer’s current question, naturally ask for one contact method (phone/WhatsApp or email). Ask only this one question.',
    'Do not claim a booking, purchase, or confirmation is complete merely because contact details were provided.',
  ].join(' ')
}
