import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { broadcastWebChatMessage } from '@/lib/web-chat/realtime';

type BookingStatus = 'confirmed' | 'cancelled';

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { id?: string; status?: BookingStatus } | null;
  if (!body?.id || !body?.status || !['confirmed', 'cancelled'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid booking update' }, { status: 400 });
  }

  const { data: booking, error: readError } = await supabase
    .from('booking_requests')
    .select('id, conversation_id, service, requested_date, requested_time, customer_name, status')
    .eq('id', body.id)
    .single();

  if (readError || !booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('booking_requests')
    .update({ status: body.status, updated_at: now })
    .eq('id', booking.id);

  if (updateError) return NextResponse.json({ error: 'Could not update booking' }, { status: 500 });

  const details = [booking.service, booking.requested_date, booking.requested_time].filter(Boolean).join(' · ');
  const customerName = booking.customer_name ? ` ${booking.customer_name}` : '';
  const text = body.status === 'confirmed'
    ? `¡Listo${customerName}! ✅ Tu reserva${details ? ` para ${details}` : ''} fue confirmada por el negocio. ¡Te esperamos!`
    : `Hola${customerName}. Tu solicitud de reserva${details ? ` para ${details}` : ''} fue cancelada. Si querés, podés escribirnos para coordinar otro horario.`;

  const { data: message, error: messageError } = await supabase
    .from('messages')
    .insert({
      conversation_id: booking.conversation_id,
      sender_type: 'agent',
      sender_id: user.id,
      content_type: 'text',
      content_text: text,
      status: 'sent',
    })
    .select('id, sender_type, content_type, content_text, created_at')
    .single();

  if (messageError || !message) {
    console.error('[bookings] notification message failed:', messageError);
    return NextResponse.json({ ok: true, status: body.status, notified: false });
  }

  await supabase
    .from('conversations')
    .update({ last_message_text: text, last_message_at: now, updated_at: now })
    .eq('id', booking.conversation_id);

  await broadcastWebChatMessage(booking.conversation_id, message);

  return NextResponse.json({ ok: true, status: body.status, notified: true });
}
