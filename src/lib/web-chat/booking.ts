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
};

const dateLike = /(hoy|mañana|pasado mañana|lunes|martes|miércoles|miercoles|jueves|viernes|sábado|sabado|domingo|\b\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?\b)/i;
const timeLike = /(?:a las\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|hs?|h)?/i;
const phoneLike = /(?:\+?\d[\d\s-]{7,}\d)/;

export async function advanceBookingRequest(args: {
  db: Db;
  accountId: string;
  conversationId: string;
  contactId: string;
  text: string;
  intent: string;
}): Promise<BookingState> {
  const { db, accountId, conversationId, contactId, text, intent } = args;
  const { data: existing } = await db.from("booking_requests").select("*").eq("conversation_id", conversationId).maybeSingle();

  if (!existing && intent !== "booking") return { active: false, complete: false };

  const row: any = existing ?? {
    account_id: accountId,
    conversation_id: conversationId,
    contact_id: contactId,
    status: "collecting",
  };

  const clean = text.trim();
  if (!row.service && intent === "booking" && !/reserv|turno|cita|agend/i.test(clean)) row.service = clean;
  else if (!row.service && existing) row.service = clean;
  else if (!row.requested_date && dateLike.test(clean)) row.requested_date = clean;
  else if (!row.requested_time && timeLike.test(clean)) row.requested_time = clean;
  else if (!row.customer_name && !phoneLike.test(clean)) row.customer_name = clean;
  else if (!row.customer_phone && phoneLike.test(clean)) row.customer_phone = clean.match(phoneLike)?.[0] ?? clean;

  const complete = Boolean(row.service && row.requested_date && row.requested_time && row.customer_name && row.customer_phone);
  row.status = complete ? "pending_confirmation" : "collecting";
  row.updated_at = new Date().toISOString();

  await db.from("booking_requests").upsert(row, { onConflict: "conversation_id" });

  let nextQuestion: string | null = null;
  if (!row.service) nextQuestion = "¿Qué servicio querés reservar?";
  else if (!row.requested_date) nextQuestion = "¿Para qué día te gustaría?";
  else if (!row.requested_time) nextQuestion = "¿Qué horario preferís?";
  else if (!row.customer_name) nextQuestion = "Perfecto. ¿Cuál es tu nombre?";
  else if (!row.customer_phone) nextQuestion = "¿Cuál es tu teléfono o WhatsApp para contactarte?";
  else nextQuestion = "Listo. Registré tu solicitud de reserva. El negocio debe confirmar la disponibilidad antes de que el turno quede confirmado.";

  return {
    active: true,
    complete,
    service: row.service,
    requestedDate: row.requested_date,
    requestedTime: row.requested_time,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    nextQuestion,
  };
}

export function bookingPrompt(state?: BookingState): string | null {
  if (!state?.active) return null;
  return [
    "BOOKING FLOW:",
    "The customer is making a booking request. Never claim that an appointment is confirmed or that a time is available unless availability has been independently verified.",
    state.service ? `Service: ${state.service}` : "Service: missing",
    state.requestedDate ? `Requested date: ${state.requestedDate}` : "Requested date: missing",
    state.requestedTime ? `Requested time: ${state.requestedTime}` : "Requested time: missing",
    state.customerName ? `Customer name: ${state.customerName}` : "Customer name: missing",
    state.customerPhone ? `Customer phone: ${state.customerPhone}` : "Customer phone: missing",
    state.nextQuestion ? `Ask exactly for the next missing booking detail: ${state.nextQuestion}` : "",
  ].filter(Boolean).join("\n");
}
