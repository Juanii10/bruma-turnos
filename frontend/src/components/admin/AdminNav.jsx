import { clearAdminToken } from '../../lib/api.js';

const LINKS = [
  { href: '/admin/dashboard', label: 'Panel' },
  { href: '/admin/turnos', label: 'Turnos' },
  { href: '/admin/servicios', label: 'Servicios' },
  { href: '/admin/profesionales', label: 'Profesionales' },
  { href: '/admin/cuenta', label: 'Mi cuenta' },
];

export default function AdminNav({ current }) {
  function handleLogout() {
    clearAdminToken();
    window.location.href = '/admin';
  }

  return (
    <div className="border-b border-ink/10 bg-white/60">
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-display text-lg text-ink mr-4">BRUMA admin</span>
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors ' +
                (current === l.href ? 'bg-ink text-cream' : 'text-ink-soft hover:bg-cream-dark')
              }
            >
              {l.label}
            </a>
          ))}
        </div>
        <button onClick={handleLogout} className="text-sm text-copper-dark hover:underline">
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
