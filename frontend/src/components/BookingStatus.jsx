import { useEffect, useState } from 'react';
import { getBooking, cancelBooking, rescheduleBooking, getAvailability } from '../lib/api.js';

const STATUS_LABELS = {
  pending_deposit: 'Pendiente de pago de seña',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
  no_show: 'No se presentó',
  expired: 'Expirado (no se pagó la seña a tiempo)',
};

const MIN_HOURS_BEFORE_MODIFY = 24;

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function maxDateISO() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function BookingStatus() {
  const [params, setParams] = useState(null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [slots, setSlots] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [rescheduleError, setRescheduleError] = useState(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const id = url.searchParams.get('id');
    const token = url.searchParams.get('token');
    setParams({ id, token });
  }, []);

  useEffect(() => {
    if (!params) return;
    if (!params.id || !params.token) {
      setError('Falta información en el enlace. Revisá que hayas abierto el link completo que te enviamos por mail.');
      return;
    }
    getBooking(params.id, params.token)
      .then(setBooking)
      .catch((err) => setError(err.message));
  }, [params]);

  useEffect(() => {
    if (!showReschedule || !booking) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    getAvailability(booking.serviceId, booking.professionalId, newDate)
      .then((data) => setSlots(data.slots))
      .catch((err) => setRescheduleError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [showReschedule, newDate, booking]);

  async function handleCancel() {
    if (!confirm('¿Seguro que querés cancelar este turno?')) return;
    setBusy(true);
    try {
      await cancelBooking(params.id, params.token);
      const updated = await getBooking(params.id, params.token);
      setBooking(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmReschedule() {
    setBusy(true);
    setRescheduleError(null);
    try {
      await rescheduleBooking(params.id, params.token, newDate, selectedTime);
      const updated = await getBooking(params.id, params.token);
      setBooking(updated);
      setShowReschedule(false);
    } catch (err) {
      setRescheduleError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return <p className="text-copper-dark">{error}</p>;
  }

  if (!booking) {
    return <p className="text-ink-soft">Buscando tu turno...</p>;
  }

  const isActive = ['pending_deposit', 'confirmed'].includes(booking.status);
  const hoursUntilStart = (new Date(booking.startAt).getTime() - Date.now()) / 3_600_000;
  const canModify = isActive && hoursUntilStart >= MIN_HOURS_BEFORE_MODIFY;
  const canCancel = isActive;

  return (
    <div className="rounded-2xl border border-ink/10 bg-white/60 p-8 max-w-lg mx-auto">
      <h2 className="font-display text-2xl mb-4">Tu turno en BRUMA</h2>
      <div className="space-y-1 text-sm mb-6">
        <p>
          <strong>Servicio:</strong> {booking.serviceName}
        </p>
        <p>
          <strong>Profesional:</strong> {booking.professionalName}
        </p>
        <p>
          <strong>Fecha:</strong> {new Date(booking.startAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
        </p>
        <p>
          <strong>Seña:</strong> {formatMoney(booking.depositAmount)} ({booking.depositStatus === 'paid' ? 'pagada' : 'pendiente'})
        </p>
        <p>
          <strong>Estado:</strong> {STATUS_LABELS[booking.status] || booking.status}
        </p>
      </div>

      {isActive && !canModify && !showReschedule && (
        <p className="text-xs text-ink-soft mb-4">
          Este turno ya no se puede modificar desde acá porque falta menos de {MIN_HOURS_BEFORE_MODIFY}hs.
          Si necesitás cambiar el horario, contactanos directamente. Todavía podés cancelarlo si hace falta.
        </p>
      )}

      {isActive && !showReschedule && (
        <div className="flex flex-wrap gap-3">
          {canModify && (
            <button
              onClick={() => setShowReschedule(true)}
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:bg-ink/90"
            >
              Modificar turno
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="rounded-full border border-copper-dark text-copper-dark px-5 py-2 text-sm font-semibold hover:bg-copper-light/30 disabled:opacity-40"
            >
              {busy ? 'Cancelando...' : 'Cancelar turno'}
            </button>
          )}
        </div>
      )}

      {showReschedule && (
        <div className="border-t border-ink/10 pt-5 mt-1">
          <p className="font-medium text-ink mb-3">Elegí nueva fecha y horario</p>

          {rescheduleError && (
            <div className="mb-4 rounded-lg bg-copper-light/40 border border-copper/30 px-3 py-2 text-sm text-copper-dark">
              {rescheduleError}
            </div>
          )}

          <input
            type="date"
            value={newDate}
            min={todayISO()}
            max={maxDateISO()}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg border border-ink/20 bg-white px-4 py-2 mb-4"
          />

          {loadingSlots && <p className="text-sm text-ink-soft mb-4">Buscando horarios disponibles...</p>}

          {!loadingSlots && slots && slots.length === 0 && (
            <p className="text-sm text-ink-soft mb-4">No hay horarios disponibles ese día. Probá con otra fecha.</p>
          )}

          {!loadingSlots && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5">
              {slots.map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTime(t)}
                  className={
                    'rounded-lg border px-3 py-2 text-sm font-medium transition-colors ' +
                    (selectedTime === t
                      ? 'bg-ink text-cream border-ink'
                      : 'border-ink/15 bg-white text-ink hover:border-copper')
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirmReschedule}
              disabled={!selectedTime || busy}
              className="rounded-full bg-copper px-6 py-2.5 text-sm font-semibold text-cream disabled:opacity-40 hover:bg-copper-dark"
            >
              {busy ? 'Guardando...' : 'Confirmar nuevo horario'}
            </button>
            <button
              onClick={() => {
                setShowReschedule(false);
                setRescheduleError(null);
              }}
              className="text-sm text-ink-soft hover:text-copper"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
