'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, List, Loader2, Phone, Scissors, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

type BookingStatus = 'collecting' | 'pending_confirmation' | 'confirmed' | 'cancelled';

interface BookingRequest {
  id: string;
  service: string | null;
  requested_date: string | null;
  requested_time: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: BookingStatus;
  created_at: string;
}

const statusMeta: Record<BookingStatus, { label: string; className: string }> = {
  collecting: { label: 'Incompleta', className: 'bg-muted text-muted-foreground' },
  pending_confirmation: { label: 'Pendiente', className: 'bg-amber-500/10 text-amber-600' },
  confirmed: { label: 'Confirmada', className: 'bg-emerald-500/10 text-emerald-600' },
  cancelled: { label: 'Cancelada', className: 'bg-destructive/10 text-destructive' },
};

export default function BookingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'agenda'>('list');
  const [weekOffset, setWeekOffset] = useState(0);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('booking_requests')
      .select('id, service, requested_date, requested_time, customer_name, customer_phone, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('No se pudieron cargar las reservas');
      console.error('[bookings] load failed:', error);
    } else {
      setBookings((data ?? []) as BookingRequest[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  async function updateStatus(id: string, status: 'confirmed' | 'cancelled') {
    setUpdatingId(id);
    try {
      const response = await fetch('/api/bookings/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      const result = await response.json().catch(() => null) as { error?: string; notified?: boolean } | null;
      if (!response.ok) throw new Error(result?.error || 'Could not update booking');

      setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
      const label = status === 'confirmed' ? 'Reserva confirmada' : 'Reserva cancelada';
      toast.success(result?.notified === false ? `${label}. No se pudo enviar el aviso al chat.` : `${label} y cliente avisado`);
    } catch (error) {
      console.error('[bookings] update failed:', error);
      toast.error('No se pudo actualizar la reserva');
    } finally {
      setUpdatingId(null);
    }
  }

  const pending = bookings.filter((b) => b.status === 'pending_confirmation').length;
  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;

  const weekDays = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    const day = (today.getDay() + 6) % 7;
    start.setDate(today.getDate() - day + weekOffset * 7);
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [weekOffset]);

  function bookingDate(value: string | null): Date | null {
    if (!value) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + 'T12:00:00') : new Date(value);
    return Number.isNaN(iso.getTime()) ? null : iso;
  }

  function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  const agendaBookings = bookings.filter((booking) => booking.status !== 'cancelled' && bookingDate(booking.requested_date));

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reservas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Solicitudes captadas por Wally y gestionadas por tu equipo.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={bookings.length} icon={<CalendarDays className="size-4" />} />
        <SummaryCard label="Pendientes" value={pending} icon={<Clock3 className="size-4" />} />
        <SummaryCard label="Confirmadas" value={confirmed} icon={<Check className="size-4" />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <Button size="sm" variant={view === 'list' ? 'default' : 'ghost'} onClick={() => setView('list')}>
            <List className="size-4" /> Lista
          </Button>
          <Button size="sm" variant={view === 'agenda' ? 'default' : 'ghost'} onClick={() => setView('agenda')}>
            <CalendarDays className="size-4" /> Agenda
          </Button>
        </div>
        {view === 'agenda' && (
          <div className="flex items-center gap-2">
            <Button size="icon-sm" variant="outline" onClick={() => setWeekOffset((v) => v - 1)}><ChevronLeft className="size-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => setWeekOffset(0)}>Hoy</Button>
            <Button size="icon-sm" variant="outline" onClick={() => setWeekOffset((v) => v + 1)}><ChevronRight className="size-4" /></Button>
          </div>
        )}
      </div>

      {view === 'agenda' && !loading ? (
        <div className="grid gap-3 lg:grid-cols-7">
          {weekDays.map((day) => {
            const dayBookings = agendaBookings
              .filter((booking) => {
                const date = bookingDate(booking.requested_date);
                return date ? sameDay(date, day) : false;
              })
              .sort((a, b) => (a.requested_time || '').localeCompare(b.requested_time || ''));
            const isToday = sameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`min-h-40 rounded-xl border bg-card p-3 ${isToday ? 'border-primary' : 'border-border'}`}>
                <div className="mb-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">{day.toLocaleDateString('es-PE', { weekday: 'short' })}</p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day.getDate()}</p>
                </div>
                <div className="space-y-2">
                  {dayBookings.length === 0 ? <p className="text-xs text-muted-foreground">Sin turnos</p> : dayBookings.map((booking) => {
                    const meta = statusMeta[booking.status];
                    const busy = updatingId === booking.id;
                    return (
                      <div key={booking.id} className="rounded-lg border border-border bg-background p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">{booking.requested_time || 'Sin hora'}</span>
                          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-foreground">{booking.customer_name || 'Cliente'}</p>
                        <p className="truncate text-xs text-muted-foreground">{booking.service || 'Servicio pendiente'}</p>
                        {booking.status === 'pending_confirmation' && (
                          <div className="mt-2 flex gap-1">
                            <Button size="sm" className="h-7 flex-1 px-2 text-xs" disabled={busy} onClick={() => updateStatus(booking.id, 'confirmed')}><Check className="size-3" /> Confirmar</Button>
                            <Button size="icon-sm" variant="outline" className="size-7" disabled={busy} onClick={() => updateStatus(booking.id, 'cancelled')}><X className="size-3" /></Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading ? (
          <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Cargando reservas…
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex min-h-52 flex-col items-center justify-center gap-2 px-6 text-center">
            <CalendarDays className="size-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Todavía no hay reservas</p>
            <p className="max-w-md text-sm text-muted-foreground">Cuando un cliente solicite un turno desde el chat web, aparecerá acá.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bookings.map((booking) => {
              const meta = statusMeta[booking.status];
              const busy = updatingId === booking.id;
              return (
                <div key={booking.id} className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">{booking.customer_name || 'Cliente sin nombre'}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>{meta.label}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5"><Scissors className="size-3.5" />{booking.service || 'Servicio pendiente'}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{booking.requested_date || 'Fecha pendiente'}{booking.requested_time ? ` · ${booking.requested_time}` : ''}</span>
                      {booking.customer_phone && <span className="inline-flex items-center gap-1.5"><Phone className="size-3.5" />{booking.customer_phone}</span>}
                    </div>
                  </div>

                  {booking.status !== 'cancelled' && (
                    <div className="flex shrink-0 gap-2">
                      {booking.status !== 'confirmed' && (
                        <Button size="sm" onClick={() => updateStatus(booking.id, 'confirmed')} disabled={busy}>
                          {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Confirmar
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => updateStatus(booking.id, 'cancelled')} disabled={busy}>
                        <X className="size-4" /> Cancelar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
