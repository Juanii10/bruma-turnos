import { useEffect, useState } from 'react';
import { getAdminBookings, updateBookingStatus } from '../../lib/api.js';

const STATUS_LABELS = {
  pending_deposit: 'Pendiente de seña',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
  no_show: 'No se presentó',
  expired: 'Expirado',
};

const STATUS_COLORS = {
  pending_deposit: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-neutral-200 text-neutral-600',
  completed: 'bg-sky-100 text-sky-800',
  no_show: 'bg-red-100 text-red-800',
  expired: 'bg-neutral-200 text-neutral-500',
};

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminTurnos() {
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState('');
  const [bookings, setBookings] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  function load() {
    const params = {};
    if (date) params.date = date;
    if (status) params.status = status;
    getAdminBookings(params).then(setBookings).catch((err) => setError(err.message));
  }

  useEffect(load, [date, status]);

  async function handleStatusChange(id, newStatus) {
    setBusyId(id);
    try {
      await updateBookingStatus(id, newStatus);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Estado</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button onClick={() => setDate('')} className="mt-5 text-xs text-ink-soft hover:text-copper">
          Ver todas las fechas
        </button>
      </div>

      {error && <p className="text-copper-dark text-sm mb-4">{error}</p>}

      {!bookings ? (
        <p className="text-ink-soft">Cargando turnos...</p>
      ) : bookings.length === 0 ? (
        <p className="text-ink-soft">No hay turnos que coincidan con el filtro.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-white/70">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3">Fecha y hora</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Servicio</th>
                <th className="px-4 py-3">Profesional</th>
                <th className="px-4 py-3">Seña</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-b border-ink/5 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(b.startAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <p>{b.customerName}</p>
                    <p className="text-xs text-ink-soft">{b.customerPhone}</p>
                  </td>
                  <td className="px-4 py-3">{b.serviceName}</td>
                  <td className="px-4 py-3">{b.professionalName}</td>
                  <td className="px-4 py-3">
                    {formatMoney(b.depositAmount)}
                    <span className="block text-xs text-ink-soft">{b.depositStatus === 'paid' ? 'pagada' : 'pendiente'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[b.status] || ''}`}>
                      {STATUS_LABELS[b.status] || b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={busyId === b.id}
                      value=""
                      onChange={(e) => e.target.value && handleStatusChange(b.id, e.target.value)}
                      className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs"
                    >
                      <option value="">Cambiar estado...</option>
                      {Object.entries(STATUS_LABELS)
                        .filter(([value]) => value !== b.status)
                        .map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
