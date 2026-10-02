'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const fields = [
  ['business_name','Business name','input'],
  ['description','What does your business do?','textarea'],
  ['location_text','Location / service area','input'],
  ['business_hours','Business hours','textarea'],
  ['services','Services','textarea'],
  ['pricing','Prices','textarea'],
  ['faqs','Frequently asked questions','textarea'],
  ['policies','Policies','textarea'],
] as const

export function BusinessProfileSettings() {
  const [form,setForm]=useState<Record<string,string>>({})
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)

  useEffect(()=>{ void fetch('/api/business-profile').then(r=>r.json()).then(j=>setForm(j.profile ?? {})) },[])

  async function save(){
    setSaving(true); setSaved(false)
    const r=await fetch('/api/business-profile',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(form)})
    setSaving(false); setSaved(r.ok)
  }

  return <div className="space-y-6">
    <div><h2 className="text-xl font-semibold">Business profile</h2>
      <p className="text-sm text-muted-foreground">VUNIKO uses this information to answer customers without inventing prices, hours or policies.</p></div>
    <div className="grid gap-5">
      {fields.map(([key,label,kind])=><label key={key} className="grid gap-2 text-sm font-medium">{label}
        {kind==='input'
          ? <Input value={form[key] ?? ''} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>
          : <Textarea rows={4} value={form[key] ?? ''} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>}
      </label>)}
    </div>
    <div className="flex items-center gap-3"><Button onClick={save} disabled={saving}>{saving?'Saving…':'Save business profile'}</Button>
      {saved && <span className="text-sm text-muted-foreground">Saved. Gemini will use this context.</span>}</div>
  </div>
}
