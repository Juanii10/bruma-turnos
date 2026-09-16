import { useEffect, useState } from 'react';
import { getAdminStats } from '../../lib/api.js';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_LABELS = {
  pending_deposit: 'Pendiente de seña',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Completado',
  no_show: 'No se presentó',
  expired: 'Expirado',
};

export default function AdminDashboard() {
  const [date, setDate] = useState(todayISO());
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getAdminStats(date).then(setStats).catch((err) => setError(err.message));
  }, [date]);

  if (error) return <p className="text-copper-dark">{error}</p>;
  if (!stats) return <p className="text-ink-soft">Cargando estadísticas...</p>;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-ink-soft">Fecha</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink/10 bg-white/70 p-6">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Turnos del día</p>
          <p className="font-display text-3xl">{stats.todayCount}</p>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-white/70 p-6 sm:col-span-2">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-3">Ocupación por profesional</p>
          <div className="space-y-2">
            {stats.occupancyByProfessional.map((o) => (
              <div key={o.professionalId} className="flex items-center gap-3 text-sm">
                <span className="w-28 shrink-0 text-ink">{o.name}</span>
                <div className="flex-1 h-2 rounded-full bg-cream-dark overflow-hidden">
                  <div
                    className="h-full bg-copper"
                    style={{ width: `${o.occupancyPct ?? 0}%` }}
                  />
                </div>
                <span className="w-12 text-right text-ink-soft">{o.occupancyPct != null ? `${o.occupancyPct}%` : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-6">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-3">Servicios más pedidos (últimos 30 días)</p>
        {stats.topServices.length === 0 ? (
          <p className="text-sm text-ink-soft">Todavía no hay datos.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {stats.topServices.map((s, i) => (
              <li key={s.serviceId} className="flex justify-between">
                <span>
                  {i + 1}. {s.name}
                </span>
                <span className="text-ink-soft">{s.count} turnos</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white/70 p-6">
        <p className="text-xs uppercase tracking-wide text-ink-soft mb-3">Turnos de hoy</p>
        {stats.todayBookings.length === 0 ? (
          <p className="text-sm text-ink-soft">No hay turnos para esta fecha.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {stats.todayBookings
                .sort((a, b) => a.startAt.localeCompare(b.startAt))
                .map((b) => (
                  <tr key={b.id} className="border-t border-ink/5">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(b.startAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2 pr-4">{b.customerName}</td>
                    <td className="py-2 text-ink-soft">{STATUS_LABELS[b.status] || b.status}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
