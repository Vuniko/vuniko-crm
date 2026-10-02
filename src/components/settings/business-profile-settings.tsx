'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const fields = [
  ['business_name','Nombre del negocio','input'],
  ['description','¿A qué se dedica tu negocio?','textarea'],
  ['location_text','Ubicación / zona de atención','input'],
  ['business_hours','Horarios de atención','textarea'],
  ['services','Servicios','textarea'],
  ['pricing','Precios','textarea'],
  ['faqs','Preguntas frecuentes','textarea'],
  ['policies','Políticas','textarea'],
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
    <div><h2 className="text-xl font-semibold">Perfil del negocio</h2>
      <p className="text-sm text-muted-foreground">VUNIKO usa esta información para responder a tus clientes sin inventar precios, horarios ni políticas.</p></div>
    <div className="grid gap-5">
      {fields.map(([key,label,kind])=><label key={key} className="grid gap-2 text-sm font-medium">{label}
        {kind==='input'
          ? <Input value={form[key] ?? ''} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>
          : <Textarea rows={4} value={form[key] ?? ''} onChange={e=>setForm(v=>({...v,[key]:e.target.value}))}/>}
      </label>)}
    </div>
    <div className="flex items-center gap-3"><Button onClick={save} disabled={saving}>{saving?'Guardando…':'Guardar perfil del negocio'}</Button>
      {saved && <span className="text-sm text-muted-foreground">Guardado. La IA usará esta información como contexto.</span>}</div>
  </div>
}
