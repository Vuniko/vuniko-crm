import type { SupabaseClient } from '@supabase/supabase-js'

export type LeadIntent = 'general' | 'price' | 'booking' | 'purchase' | 'human'

export function classifyLeadIntent(text: string): { intent: LeadIntent; confidence: number } {
  const value = text.toLocaleLowerCase()
  const rules: Array<[LeadIntent, RegExp, number]> = [
    ['human', /\b(humano|persona|asesor|agente|representante|hablar con alguien|human|agent)\b/i, .98],
    ['booking', /\b(reserv|cita|turno|agend|disponibilidad|appointment|book)\w*/i, .90],
    ['purchase', /\b(compr|contrat|quiero uno|me lo llevo|pagar|purchase|buy|order)\w*/i, .88],
    ['price', /\b(precio|cu[aá]nto|costo|cuesta|tarifa|cotiz|price|cost|quote)\w*/i, .86],
  ]
  for (const [intent, regex, confidence] of rules) if (regex.test(value)) return { intent, confidence }
  return { intent: 'general', confidence: .55 }
}

export async function saveLeadIntent(db: SupabaseClient, conversationId: string, text: string) {
  const result = classifyLeadIntent(text)
  await db.from('conversations').update({
    lead_intent: result.intent,
    lead_intent_confidence: result.confidence,
    lead_intent_updated_at: new Date().toISOString(),
  }).eq('id', conversationId)
  return result
}
