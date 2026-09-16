import { useEffect, useState } from 'react';
import { getAdminProfessionals, createProfessional, updateProfessional, getAdminServices } from '../../lib/api.js';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function scheduleFromWorkingHours(workingHours) {
  const schedule = DAYS.map((_, dayOfWeek) => {
    const entry = workingHours.find((h) => h.dayOfWeek === dayOfWeek);
    return entry
      ? { enabled: true, start: minutesToTime(entry.startMinutes), end: minutesToTime(entry.endMinutes) }
      : { enabled: false, start: '10:00', end: '19:00' };
  });
  return schedule;
}

function ProfessionalForm({ initial, allServices, onSubmit, onCancel, submitLabel }) {
  const [name, setName] = useState(initial?.name || '');
  const [bio, setBio] = useState(initial?.bio || '');
  const [serviceIds, setServiceIds] = useState(new Set(initial?.serviceIds || []));
  const [schedule, setSchedule] = useState(scheduleFromWorkingHours(initial?.workingHours || []));
  const [busy, setBusy] = useState(false);

  function toggleService(id) {
    const next = new Set(serviceIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setServiceIds(next);
  }

  function updateDay(dayOfWeek, patch) {
    setSchedule((prev) => prev.map((d, i) => (i === dayOfWeek ? { ...d, ...patch } : d)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const workingHours = schedule
        .map((d, dayOfWeek) => ({ ...d, dayOfWeek }))
        .filter((d) => d.enabled)
        .map((d) => ({ dayOfWeek: d.dayOfWeek, startMinutes: timeToMinutes(d.start), endMinutes: timeToMinutes(d.end) }));

      await onSubmit({ name, bio, serviceIds: Array.from(serviceIds), workingHours });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-ink/10 bg-white/70 p-5 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Nombre</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft mb-1">Bio</label>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-soft mb-2">Servicios que ofrece</p>
        <div className="flex flex-wrap gap-2">
          {allServices.map((s) => (
            <label
              key={s.id}
              className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
                serviceIds.has(s.id) ? 'bg-ink text-cream border-ink' : 'border-ink/20 text-ink-soft'
              }`}
            >
              <input type="checkbox" className="hidden" checked={serviceIds.has(s.id)} onChange={() => toggleService(s.id)} />
              {s.name}
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-ink-soft mb-2">Horarios de trabajo</p>
        <div className="space-y-1.5">
          {DAYS.map((label, dayOfWeek) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2 w-32">
                <input
                  type="checkbox"
                  checked={schedule[dayOfWeek].enabled}
                  onChange={(e) => updateDay(dayOfWeek, { enabled: e.target.checked })}
                />
                {label}
              </label>
              {schedule[dayOfWeek].enabled && (
                <>
                  <input
                    type="time"
                    value={schedule[dayOfWeek].start}
                    onChange={(e) => updateDay(dayOfWeek, { start: e.target.value })}
                    className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs"
                  />
                  <span className="text-ink-soft">a</span>
                  <input
                    type="time"
                    value={schedule[dayOfWeek].end}
                    onChange={(e) => updateDay(dayOfWeek, { end: e.target.value })}
                    className="rounded-lg border border-ink/20 bg-white px-2 py-1 text-xs"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-copper px-5 py-1.5 text-sm font-semibold text-cream hover:bg-copper-dark disabled:opacity-40"
        >
          {busy ? 'Guardando...' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-ink-soft hover:text-copper">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

export default function AdminProfesionales() {
  const [professionals, setProfessionals] = useState(null);
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  function load() {
    getAdminProfessionals().then(setProfessionals).catch((err) => setError(err.message));
    getAdminServices().then(setServices).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(payload) {
    await createProfessional(payload);
    setShowNewForm(false);
    load();
  }

  async function handleUpdate(id, payload) {
    await updateProfessional(id, payload);
    setEditingId(null);
    load();
  }

  async function toggleActive(p) {
    await updateProfessional(p.id, { active: !p.active });
    load();
  }

  if (error) return <p className="text-copper-dark">{error}</p>;
  if (!professionals || !services) return <p className="text-ink-soft">Cargando...</p>;

  return (
    <div className="space-y-6">
      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          + Nuevo profesional
        </button>
      ) : (
        <ProfessionalForm allServices={services} submitLabel="Crear profesional" onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} />
      )}

      <div className="space-y-3">
        {professionals.map((p) =>
          editingId === p.id ? (
            <ProfessionalForm
              key={p.id}
              initial={p}
              allServices={services}
              submitLabel="Guardar cambios"
              onSubmit={(payload) => handleUpdate(p.id, payload)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/70 p-4 ${
                !p.active ? 'opacity-50' : ''
              }`}
            >
              <div>
                <p className="font-semibold text-ink">
                  {p.name} {!p.active && <span className="text-xs text-ink-soft">(inactivo)</span>}
                </p>
                <p className="text-xs text-ink-soft">
                  {p.serviceIds.length} servicio(s) · {p.workingHours.length} día(s) configurados
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingId(p.id)} className="text-sm text-copper-dark hover:underline">
                  Editar
                </button>
                <button onClick={() => toggleActive(p)} className="text-sm text-ink-soft hover:text-copper">
                  {p.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
