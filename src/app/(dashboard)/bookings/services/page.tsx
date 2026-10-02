'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Service={id?:string;name:string;description:string;price:number;duration_minutes:number;is_active:boolean;position:number};
const blank=(position:number):Service=>({name:'',description:'',price:0,duration_minutes:30,is_active:true,position});

export default function BookingServicesPage(){
 const supabase=useMemo(()=>createClient(),[]);
 const [services,setServices]=useState<Service[]>([]);
 const [accountId,setAccountId]=useState<string|null>(null);
 const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false);

 const load=useCallback(async()=>{
  const {data:profile}=await supabase.from('profiles').select('account_id').single();
  const id=profile?.account_id??null; setAccountId(id);
  if(id){const {data,error}=await supabase.from('booking_services').select('id,name,description,price,duration_minutes,is_active,position').eq('account_id',id).order('position').order('name');
   if(error) console.error('[services] load failed',error); else setServices((data??[]).map((s:any)=>({...s,price:Number(s.price)})));
  } setLoading(false);
 },[supabase]);
 useEffect(()=>{void load()},[load]);

 function patch(i:number,v:Partial<Service>){setServices(x=>x.map((s,n)=>n===i?{...s,...v}:s))}
 async function remove(i:number){const s=services[i]; if(s.id){const {error}=await supabase.from('booking_services').delete().eq('id',s.id);if(error){toast.error('No se pudo eliminar el servicio');return}} setServices(x=>x.filter((_,n)=>n!==i));toast.success('Servicio eliminado')}
 async function save(){
  if(!accountId)return; if(services.some(s=>!s.name.trim())){toast.error('Todos los servicios necesitan un nombre');return}
  setSaving(true);
  const payload=services.map((s,i)=>({...(s.id?{id:s.id}:{}),account_id:accountId,name:s.name.trim(),description:s.description.trim()||null,price:Number(s.price)||0,currency:'PEN',duration_minutes:s.duration_minutes,is_active:s.is_active,position:i,updated_at:new Date().toISOString()}));
  const {error}=await supabase.from('booking_services').upsert(payload,{onConflict:'account_id,name'});
  setSaving(false); if(error){console.error(error);toast.error('No se pudieron guardar los servicios');return} toast.success('Servicios guardados');void load();
 }
 return <div className="space-y-6 p-4 sm:p-6">
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
   <div><Link href="/bookings" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/>Reservas</Link><h1 className="text-2xl font-semibold">Servicios</h1><p className="mt-1 text-sm text-muted-foreground">Configura qué puede reservar un cliente, su precio y cuánto dura cada turno.</p></div>
   <div className="flex gap-2"><Button variant="outline" onClick={()=>setServices(x=>[...x,blank(x.length)])}><Plus className="size-4"/>Agregar servicio</Button><Button onClick={save} disabled={saving||loading}>{saving?<Loader2 className="size-4 animate-spin"/>:<Save className="size-4"/>}Guardar</Button></div>
  </div>
  <div className="overflow-hidden rounded-xl border border-border bg-card">
   {loading?<div className="flex min-h-48 items-center justify-center"><Loader2 className="size-5 animate-spin"/></div>:services.length===0?<div className="p-10 text-center"><p className="font-medium">Todavía no hay servicios</p><p className="mt-1 text-sm text-muted-foreground">Agrega el primero para que Wally pueda ofrecerlo al reservar.</p><Button className="mt-4" onClick={()=>setServices([blank(0)])}><Plus className="size-4"/>Crear primer servicio</Button></div>:
   <div className="divide-y divide-border">{services.map((s,i)=><div key={s.id??i} className="grid gap-3 p-4 lg:grid-cols-[1.4fr_1.6fr_130px_140px_100px_40px] lg:items-end">
    <label className="text-xs text-muted-foreground">Nombre<Input className="mt-1" value={s.name} onChange={e=>patch(i,{name:e.target.value})} placeholder="Ej. Fade"/></label>
    <label className="text-xs text-muted-foreground">Descripción<Input className="mt-1" value={s.description} onChange={e=>patch(i,{description:e.target.value})} placeholder="Opcional"/></label>
    <label className="text-xs text-muted-foreground">Precio (S/)<Input className="mt-1" type="number" min="0" step="0.01" value={s.price} onChange={e=>patch(i,{price:Number(e.target.value)})}/></label>
    <label className="text-xs text-muted-foreground">Duración<select className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={s.duration_minutes} onChange={e=>patch(i,{duration_minutes:Number(e.target.value)})}>{[15,20,30,45,60,90,120].map(v=><option key={v} value={v}>{v} min</option>)}</select></label>
    <label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={s.is_active} onChange={e=>patch(i,{is_active:e.target.checked})}/>Activo</label>
    <Button size="icon-sm" variant="ghost" onClick={()=>remove(i)} aria-label="Eliminar servicio"><Trash2 className="size-4"/></Button>
   </div>)}</div>}
  </div>
 </div>
}
