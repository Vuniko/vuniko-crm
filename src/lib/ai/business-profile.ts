import type { SupabaseClient } from '@supabase/supabase-js'

export async function loadBusinessProfileContext(db: SupabaseClient, accountId: string): Promise<string | null> {
  const { data, error } = await db.from('business_profiles')
    .select('business_name, description, location_text, business_hours, services, pricing, faqs, policies')
    .eq('account_id', accountId).maybeSingle()
  if (error || !data) return null
  const labels: Record<string,string> = {
    business_name: 'Business name', description: 'Description', location_text: 'Location',
    business_hours: 'Business hours', services: 'Services', pricing: 'Pricing',
    faqs: 'FAQs', policies: 'Policies',
  }
  const sections = Object.entries(data)
    .filter(([, value]) => typeof value === 'string' && value.trim())
    .map(([key,value]) => `${labels[key]}:\n${String(value).trim()}`)
  return sections.length ? sections.join('\n\n') : null
}
