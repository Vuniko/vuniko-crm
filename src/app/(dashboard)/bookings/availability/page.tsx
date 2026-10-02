'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock3, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type DayRow = { weekday: number; is_open: boolean; opens_at: string; closes_at: string; slot_minutes: number };
const DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

export default function AvailabilityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<DayRow[]>(DAYS.map((_, weekday) => ({ weekday, is_open: weekday !== 0, opens_at: '09:00', closes_at: '18:00', slot_minutes: 30 })));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('booking_availability').select('weekday,is_open,opens_at,closes_at,slot_minutes').order('weekday');
    if (error) console.error('[availability] load failed:', error);
    if (data?.length) setRows((current) => current.map((fallback) => {
      const found = data.find((row) => row.weekday === fallback.weekday);
      return found ? { ...found, opens_at: found.opens_at.slice(0,5), closes_at: found.closes_at.slice(0,5) } : fallback;
    }));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void load(); }, [load]);

  function patch(weekday: number, values: Partial<DayRow>) {
    setRows((current) => current.map((row) => row.weekday === weekday ? { ...row, ...values } : row));
  }

  async function save() {
    setSaving(true);
    const { data: profile } = await supabase.from('profiles').select('account_id').single();
    if (!profile?.account_id) {
      toast.error('No se encontró la cuenta');
      setSaving(false);
      return;
    }
    const payload = rows.map((row) => ({ ...row, account_id: profile.account_id, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from('booking_availability').upsert(payload, { onConflict: 'account_id,weekday' });
    if (error) {
      console.error('[availability] save failed:', error);
      toast.error('No se pudo guardar la disponibilidad');
    } else toast.success('Disponibilidad guardada');
    setSaving(false);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Disponibilidad</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define cuándo puede aceptar turnos tu negocio.</p>
        </div>
        <Button onClick={save} disabled={saving || loading}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Guardar cambios</Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {loading ? <div className="flex min-h-48 items-center justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div> :
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div key={row.weekday} className="grid gap-3 p-4 md:grid-cols-[140px_100px_1fr_1fr_150px] md:items-center">
                <p className="font-medium text-foreground">{DAYS[row.weekday]}</p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" checked={row.is_open} onChange={(e) => patch(row.weekday,{is_open:e.target.checked})} className="size-4" />
                  {row.is_open ? 'Abierto' : 'Cerrado'}
                </label>
                <label className="text-xs text-muted-foreground">Desde<Input type="time" value={row.opens_at} disabled={!row.is_open} onChange={(e) => patch(row.weekday,{opens_at:e.target.value})} className="mt-1" /></label>
                <label className="text-xs text-muted-foreground">Hasta<Input type="time" value={row.closes_at} disabled={!row.is_open} onChange={(e) => patch(row.weekday,{closes_at:e.target.value})} className="mt-1" /></label>
                <label className="text-xs text-muted-foreground">Duración
                  <select value={row.slot_minutes} disabled={!row.is_open} onChange={(e) => patch(row.weekday,{slot_minutes:Number(e.target.value)})} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                    {[15,20,30,45,60,90,120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
                  </select>
                </label>
              </div>
            ))}
          </div>
        }
      </div>
      <div className="flex gap-2 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Clock3 className="mt-0.5 size-4 shrink-0" />
        Esta configuración será la fuente de horarios que Wally podrá ofrecer a los clientes.
      </div>
    </div>
  );
}
