import { useEffect, useState } from 'react';
import { getServices } from '../lib/api.js';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

export default function ServicesList({ compact = false }) {
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getServices()
      .then((data) => setServices(compact ? data.slice(0, 3) : data))
      .catch((err) => setError(err.message));
  }, [compact]);

  if (error) {
    return <p className="text-copper-dark">No pudimos cargar los servicios. Intentá recargar la página.</p>;
  }

  if (!services) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: compact ? 3 : 5 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-cream-dark animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <div key={s.id} className="rounded-2xl border border-ink/10 bg-white/60 p-6 flex flex-col gap-2">
          <h3 className="font-display text-xl text-ink">{s.name}</h3>
          {s.description && <p className="text-sm text-ink-soft flex-1">{s.description}</p>}
          <div className="flex items-center justify-between pt-2 text-sm">
            <span className="text-ink-soft">{s.durationMinutes} min</span>
            <span className="font-semibold text-copper-dark">{formatMoney(s.price)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
