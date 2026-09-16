import { useEffect, useState } from 'react';
import { getAdminServices, createService, updateService } from '../../lib/api.js';

function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
}

const emptyForm = { name: '', description: '', durationMinutes: 45, price: 0 };

function ServiceForm({ initial, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ ...form, durationMinutes: Number(form.durationMinutes), price: Number(form.price) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 rounded-2xl border border-ink/10 bg-white/70 p-5">
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-ink-soft mb-1">Nombre</label>
        <input
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-ink-soft mb-1">Descripción</label>
        <input
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1">Duración (min)</label>
        <input
          type="number"
          min="5"
          step="5"
          required
          value={form.durationMinutes}
          onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
          className="w-full rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-ink-soft mb-1">Precio (ARS)</label>
        <input
          type="number"
          min="0"
          step="100"
          required
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          className="w-full rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
        />
      </div>
      <div className="sm:col-span-2 flex gap-2">
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

export default function AdminServicios() {
  const [services, setServices] = useState(null);
  const [error, setError] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  function load() {
    getAdminServices().then(setServices).catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleCreate(payload) {
    await createService(payload);
    setShowNewForm(false);
    load();
  }

  async function handleUpdate(id, payload) {
    await updateService(id, payload);
    setEditingId(null);
    load();
  }

  async function toggleActive(s) {
    await updateService(s.id, { active: !s.active });
    load();
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-copper-dark text-sm">{error}</p>}

      {!showNewForm ? (
        <button
          onClick={() => setShowNewForm(true)}
          className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          + Nuevo servicio
        </button>
      ) : (
        <ServiceForm submitLabel="Crear servicio" onSubmit={handleCreate} onCancel={() => setShowNewForm(false)} />
      )}

      {!services ? (
        <p className="text-ink-soft">Cargando servicios...</p>
      ) : (
        <div className="space-y-3">
          {services.map((s) =>
            editingId === s.id ? (
              <ServiceForm
                key={s.id}
                initial={s}
                submitLabel="Guardar cambios"
                onSubmit={(payload) => handleUpdate(s.id, payload)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <div
                key={s.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-white/70 p-4 ${
                  !s.active ? 'opacity-50' : ''
                }`}
              >
                <div>
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="text-xs text-ink-soft">
                    {s.durationMinutes} min · {formatMoney(s.price)} {!s.active && '· inactivo'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingId(s.id)} className="text-sm text-copper-dark hover:underline">
                    Editar
                  </button>
                  <button onClick={() => toggleActive(s)} className="text-sm text-ink-soft hover:text-copper">
                    {s.active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
