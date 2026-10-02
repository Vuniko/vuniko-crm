'use client'
import { useEffect,useMemo,useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

type Widget={public_key:string;name:string;welcome_message:string;accent_color:string|null;is_enabled:boolean}

export function WebChatSettings(){
 const [widget,setWidget]=useState<Widget|null>(null); const [loading,setLoading]=useState(true)
 useEffect(()=>{void fetch('/api/web-chat/widget').then(r=>r.json()).then(j=>setWidget(j.widget)).finally(()=>setLoading(false))},[])
 const code=useMemo(()=>widget ? `<script src="${window.location.origin}/widget.js" data-widget-key="${widget.public_key}" async></script>`:'',[widget])
 async function save(){
  const body=widget ?? {name:'Website chat',welcome_message:'Hi! How can we help?',accent_color:'#111111',is_enabled:true}
  const r=await fetch('/api/web-chat/widget',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  const j=await r.json().catch(()=>({})); if(!r.ok){toast.error(j.error??'Could not save widget');return}
  setWidget(j.widget); toast.success('Web chat saved')
 }
 async function copy(){if(!code)return; await navigator.clipboard.writeText(code); toast.success('Installation code copied')}
 if(loading)return <p className="text-sm text-muted-foreground">Loading web chat…</p>
 const draft=widget ?? {public_key:'',name:'Website chat',welcome_message:'Hi! How can we help?',accent_color:'#111111',is_enabled:true}
 return <div className="space-y-6">
  <div><h2 className="text-xl font-semibold">Web chat</h2><p className="text-sm text-muted-foreground">Customize your VUNIKO chat and install it on any website.</p></div>
  <div className="grid gap-4">
   <label className="grid gap-2 text-sm font-medium">Assistant name<Input value={draft.name} onChange={e=>setWidget({...draft,name:e.target.value})}/></label>
   <label className="grid gap-2 text-sm font-medium">Welcome message<Textarea rows={3} value={draft.welcome_message} onChange={e=>setWidget({...draft,welcome_message:e.target.value})}/></label>
   <label className="grid gap-2 text-sm font-medium">Accent color<div className="flex gap-2"><input type="color" value={draft.accent_color??'#111111'} onChange={e=>setWidget({...draft,accent_color:e.target.value})} className="h-10 w-14 rounded border"/><Input value={draft.accent_color??'#111111'} onChange={e=>setWidget({...draft,accent_color:e.target.value})}/></div></label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_enabled} onChange={e=>setWidget({...draft,is_enabled:e.target.checked})}/>Chat enabled</label>
  </div>
  <Button onClick={save}>Save web chat</Button>
  {widget?.public_key && <div className="space-y-2 rounded-xl border p-4"><p className="font-medium">Install on your website</p><p className="text-sm text-muted-foreground">Paste this once before the closing &lt;/body&gt; tag.</p><pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{code}</pre><Button variant="outline" onClick={copy}>Copy installation code</Button></div>}
 </div>
}
