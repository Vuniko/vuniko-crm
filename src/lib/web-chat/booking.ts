type Db = any;

export type BookingState = {
  active: boolean;
  complete: boolean;
  service?: string | null;
  requestedDate?: string | null;
  requestedTime?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  nextQuestion?: string | null;
  availabilityVerified?: boolean;
  alternatives?: string[];
};

const dateLike = /(hoy|mañana|pasado mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b)/i;
const timeLike = /(?:a las\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|hs?|h)?/i;
const phoneLike = /(?:\+?\d[\d\s-]{7,}\d)/;
const weekdays: Record<string, number> = { domingo:0, lunes:1, martes:2, miercoles:3, miércoles:3, jueves:4, viernes:5, sabado:6, sábado:6 };

function pad(n:number){ return String(n).padStart(2,'0'); }
function localDate(d:Date){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }

function normalizeDate(value:string): string | null {
  const raw=value.trim().toLowerCase();
  const today=new Date();
  if(raw==='hoy') return localDate(today);
  if(raw==='mañana'){ const d=new Date(today); d.setDate(d.getDate()+1); return localDate(d); }
  if(raw==='pasado mañana'){ const d=new Date(today); d.setDate(d.getDate()+2); return localDate(d); }
  if(raw in weekdays){
    const target=weekdays[raw]; const d=new Date(today); let delta=(target-d.getDay()+7)%7; if(delta===0) delta=7; d.setDate(d.getDate()+delta); return localDate(d);
  }
  const m=raw.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if(m){ let y=m[3]?Number(m[3]):today.getFullYear(); if(y<100)y+=2000; return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`; }
  return /^\d{4}-\d{2}-\d{2}$/.test(raw)?raw:null;
}

function normalizeTime(value:string): string | null {
  const m=value.toLowerCase().match(timeLike); if(!m)return null;
  let h=Number(m[1]); const min=Number(m[2]||0); const suffix=m[3];
  if(suffix==='pm'&&h<12)h+=12; if(suffix==='am'&&h===12)h=0;
  if(h>23||min>59)return null; return `${pad(h)}:${pad(min)}`;
}
function minutes(v:string){ const [h,m]=v.slice(0,5).split(':').map(Number); return h*60+m; }
function timeFromMinutes(v:number){ return `${pad(Math.floor(v/60))}:${pad(v%60)}`; }

async function checkAvailability(db:Db, accountId:string, date:string, time:string, conversationId:string){
  const day=new Date(date+'T12:00:00').getDay();
  const {data:schedule}=await db.from('booking_availability').select('is_open,opens_at,closes_at,slot_minutes').eq('account_id',accountId).eq('weekday',day).maybeSingle();
  if(!schedule?.is_open) return {available:false, alternatives:[] as string[]};
  const start=minutes(schedule.opens_at), end=minutes(schedule.closes_at), slot=schedule.slot_minutes||30, wanted=minutes(time);
  const {data:busy}=await db.from('booking_requests').select('conversation_id,requested_time,status').eq('account_id',accountId).eq('requested_date',date).in('status',['pending_confirmation','confirmed']);
  const occupied=new Set((busy||[]).filter((b:any)=>b.conversation_id!==conversationId).map((b:any)=>normalizeTime(b.requested_time||'')).filter(Boolean));
  const valid=wanted>=start && wanted+slot<=end && !occupied.has(time);
  const alternatives:string[]=[];
  for(let t=start;t+slot<=end && alternatives.length<3;t+=slot){ const candidate=timeFromMinutes(t); if(!occupied.has(candidate) && candidate!==time) alternatives.push(candidate); }
  return {available:valid, alternatives};
}

export async function advanceBookingRequest(args:{db:Db;accountId:string;conversationId:string;contactId:string;text:string;intent:string;}):Promise<BookingState>{
  const {db,accountId,conversationId,contactId,text,intent}=args;
  const {data:existing}=await db.from('booking_requests').select('*').eq('conversation_id',conversationId).maybeSingle();
  if(!existing&&intent!=='booking')return {active:false,complete:false};
  const row:any=existing??{account_id:accountId,conversation_id:conversationId,contact_id:contactId,status:'collecting'};
  const clean=text.trim();
  if(!row.service&&intent==='booking'&&!/reserv|turno|cita|agend/i.test(clean))row.service=clean;
  else if(!row.service&&existing)row.service=clean;
  else if(!row.requested_date&&dateLike.test(clean))row.requested_date=normalizeDate(clean.match(dateLike)?.[0]??clean)??clean;
  else if(!row.requested_time&&timeLike.test(clean))row.requested_time=normalizeTime(clean)??clean;
  else if(!row.customer_name&&!phoneLike.test(clean))row.customer_name=clean;
  else if(!row.customer_phone&&phoneLike.test(clean))row.customer_phone=clean.match(phoneLike)?.[0]??clean;

  let availabilityVerified=false; let alternatives:string[]=[];
  if(row.requested_date&&row.requested_time){
    const date=normalizeDate(row.requested_date); const time=normalizeTime(row.requested_time);
    if(date&&time){
      row.requested_date=date; row.requested_time=time;
      const availability=await checkAvailability(db,accountId,date,time,conversationId);
      availabilityVerified=availability.available; alternatives=availability.alternatives;
      if(!availabilityVerified) row.requested_time=null;
    }
  }

  const complete=Boolean(row.service&&row.requested_date&&row.requested_time&&row.customer_name&&row.customer_phone&&availabilityVerified);
  row.status=complete?'pending_confirmation':'collecting'; row.updated_at=new Date().toISOString();
  await db.from('booking_requests').upsert(row,{onConflict:'conversation_id'});

  let nextQuestion:string|null=null;
  if(!row.service)nextQuestion='¿Qué servicio querés reservar?';
  else if(!row.requested_date)nextQuestion='¿Para qué día te gustaría?';
  else if(!row.requested_time&&alternatives.length)nextQuestion=`Ese horario no está disponible. Tengo libres: ${alternatives.join(', ')}. ¿Cuál preferís?`;
  else if(!row.requested_time)nextQuestion='Ese horario no está disponible. ¿Qué otro horario preferís?';
  else if(!row.customer_name)nextQuestion='Perfecto. ¿Cuál es tu nombre?';
  else if(!row.customer_phone)nextQuestion='¿Cuál es tu teléfono o WhatsApp para contactarte?';
  else nextQuestion='Listo. El horario está disponible y registré tu solicitud. El negocio debe confirmarla para que el turno quede confirmado.';

  return {active:true,complete,service:row.service,requestedDate:row.requested_date,requestedTime:row.requested_time,customerName:row.customer_name,customerPhone:row.customer_phone,nextQuestion,availabilityVerified,alternatives};
}

export function bookingPrompt(state?:BookingState):string|null{
  if(!state?.active)return null;
  return ['BOOKING FLOW:','The customer is making a booking request. Follow the booking state exactly. Never invent availability.',state.availabilityVerified?'Availability: verified':'Availability: not verified',state.service?`Service: ${state.service}`:'Service: missing',state.requestedDate?`Requested date: ${state.requestedDate}`:'Requested date: missing',state.requestedTime?`Requested time: ${state.requestedTime}`:'Requested time: missing',state.customerName?`Customer name: ${state.customerName}`:'Customer name: missing',state.customerPhone?`Customer phone: ${state.customerPhone}`:'Customer phone: missing',state.nextQuestion?`Reply with this booking instruction: ${state.nextQuestion}`:''].filter(Boolean).join('\n');
}
