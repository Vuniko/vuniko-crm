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
  const body=widget ?? {name:'Chat del sitio web',welcome_message:'¡Hola! ¿Cómo podemos ayudarte?',accent_color:'#111111',is_enabled:true}
  const r=await fetch('/api/web-chat/widget',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
  const j=await r.json().catch(()=>({})); if(!r.ok){toast.error(j.error??'No se pudo guardar el chat');return}
  setWidget(j.widget); toast.success('Chat web guardado')
 }
 async function copy(){if(!code)return; await navigator.clipboard.writeText(code); toast.success('Código de instalación copiado')}
 if(loading)return <p className="text-sm text-muted-foreground">Cargando chat web…</p>
 const draft=widget ?? {public_key:'',name:'Chat del sitio web',welcome_message:'¡Hola! ¿Cómo podemos ayudarte?',accent_color:'#111111',is_enabled:true}
 return <div className="space-y-6">
  <div><h2 className="text-xl font-semibold">Chat web</h2><p className="text-sm text-muted-foreground">Personaliza tu chat de VUNIKO e instálalo en cualquier sitio web.</p></div>
  <div className="grid gap-4">
   <label className="grid gap-2 text-sm font-medium">Nombre del asistente<Input value={draft.name} onChange={e=>setWidget({...draft,name:e.target.value})}/></label>
   <label className="grid gap-2 text-sm font-medium">Mensaje de bienvenida<Textarea rows={3} value={draft.welcome_message} onChange={e=>setWidget({...draft,welcome_message:e.target.value})}/></label>
   <label className="grid gap-2 text-sm font-medium">Color principal<div className="flex gap-2"><input type="color" value={draft.accent_color??'#111111'} onChange={e=>setWidget({...draft,accent_color:e.target.value})} className="h-10 w-14 rounded border"/><Input value={draft.accent_color??'#111111'} onChange={e=>setWidget({...draft,accent_color:e.target.value})}/></div></label>
   <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_enabled} onChange={e=>setWidget({...draft,is_enabled:e.target.checked})}/>Chat activado</label>
  </div>
  <Button onClick={save}>Guardar chat web</Button>
  {widget?.public_key && <div className="space-y-2 rounded-xl border p-4"><p className="font-medium">Instalar en tu sitio web</p><p className="text-sm text-muted-foreground">Pega este código una vez antes de la etiqueta de cierre &lt;/body&gt; tag.</p><pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{code}</pre><Button variant="outline" onClick={copy}>Copiar código de instalación</Button></div>}
 </div>
}
