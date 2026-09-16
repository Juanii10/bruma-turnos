import { useEffect, useState } from 'react';
import { getProfessionals } from '../lib/api.js';

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function ProfessionalsList() {
  const [professionals, setProfessionals] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProfessionals()
      .then(setProfessionals)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <p className="text-copper-dark">No pudimos cargar el equipo. Intentá recargar la página.</p>;
  }

  if (!professionals) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-cream-dark animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {professionals.map((p) => (
        <div key={p.id} className="rounded-2xl border border-ink/10 bg-white/60 p-6 flex flex-col items-center text-center gap-3">
          <div className="h-20 w-20 rounded-full bg-copper-light text-copper-dark font-display text-2xl flex items-center justify-center">
            {initials(p.name)}
          </div>
          <h3 className="font-display text-xl text-ink">{p.name}</h3>
          {p.bio && <p className="text-sm text-ink-soft">{p.bio}</p>}
        </div>
      ))}
    </div>
  );
}
