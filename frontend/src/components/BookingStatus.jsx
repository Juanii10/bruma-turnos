import { useEffect, useState } from 'react';
import { getBooking, cancelBooking } from '../lib/api.js';

const STATUS_LABELS = {
  pending_deposit: 'Pendiente de pago de seña',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
  no_show: 'No se presentó',
  expired: 'Expirado (no se pagó la seña a tiempo)',
};

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function BookingStatus() {
  const [params, setParams] = useState(null);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

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

  if (error) {
    return <p className="text-copper-dark">{error}</p>;
  }

  if (!booking) {
    return <p className="text-ink-soft">Buscando tu turno...</p>;
  }

  const canCancel = ['pending_deposit', 'confirmed'].includes(booking.status);

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
  );
}
