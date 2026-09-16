import { useEffect, useMemo, useState } from 'react';
import { getServices, getProfessionals, getAvailability, createBooking, payDeposit } from '../lib/api.js';

const STEPS = ['Servicio', 'Profesional', 'Fecha y hora', 'Tus datos', 'Confirmar y pagar seña'];

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

function StepIndicator({ step }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs font-medium mb-8">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n === step ? 'current' : n < step ? 'done' : 'pending';
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                'flex h-6 w-6 items-center justify-center rounded-full text-[11px] ' +
                (state === 'done'
                  ? 'bg-copper text-cream'
                  : state === 'current'
                  ? 'bg-ink text-cream'
                  : 'bg-cream-dark text-ink-soft')
              }
            >
              {state === 'done' ? '✓' : n}
            </span>
            <span className={state === 'pending' ? 'text-ink-soft/60' : 'text-ink-soft'}>{label}</span>
            {n < STEPS.length && <span className="mx-1 text-ink-soft/30">—</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function BookingWizard() {
  const [step, setStep] = useState(1);
  const [services, setServices] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  const [professionals, setProfessionals] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null); // null id = "any"

  const [date, setDate] = useState(todayISO());
  const [slots, setSlots] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [form, setForm] = useState({ customerName: '', customerPhone: '', customerEmail: '', notes: '' });

  const [booking, setBooking] = useState(null); // resultado de createBooking
  const [cardNumber, setCardNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    getServices().then(setServices).catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedService) return;
    setProfessionals(null);
    getProfessionals(selectedService.id).then(setProfessionals).catch((err) => setError(err.message));
  }, [selectedService]);

  useEffect(() => {
    if (step !== 3 || !selectedService) return;
    setLoadingSlots(true);
    setSelectedTime(null);
    getAvailability(selectedService.id, selectedProfessional?.id || 'any', date)
      .then((data) => setSlots(data.slots))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSlots(false));
  }, [step, date, selectedService, selectedProfessional]);

  const depositPreview = useMemo(() => {
    if (!selectedService) return null;
    // 30% por defecto; el valor real y definitivo lo confirma el backend al crear la reserva
    return Math.round(selectedService.price * 0.3);
  }, [selectedService]);

  function goTo(n) {
    setError(null);
    setStep(n);
  }

  async function handleSubmitContactStep(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await createBooking({
        serviceId: selectedService.id,
        professionalId: selectedProfessional?.id || 'any',
        date,
        time: selectedTime,
        ...form,
      });
      setBooking(result);
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePay(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await payDeposit(booking.id, booking.cancelToken, cardNumber);
      setPaid(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (paid) {
    return (
      <div className="rounded-2xl border border-ink/10 bg-white/70 p-10 text-center max-w-xl mx-auto">
        <div className="text-4xl mb-4">✂️ 🎉</div>
        <h2 className="font-display text-2xl mb-2">¡Turno confirmado!</h2>
        <p className="text-ink-soft mb-6">
          Te enviamos un mail a <strong>{form.customerEmail}</strong> con los detalles de tu turno en BRUMA.
        </p>
        <a
          href={`/turno?id=${booking.id}&token=${booking.cancelToken}`}
          className="inline-flex items-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream hover:bg-ink/90"
        >
          Ver el detalle de mi turno
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <StepIndicator step={step} />

      {error && (
        <div className="mb-6 rounded-xl bg-copper-light/40 border border-copper/30 px-4 py-3 text-sm text-copper-dark">
          {error}
        </div>
      )}

      {step === 1 && (
        <div>
          <h2 className="font-display text-2xl mb-4">¿Qué te querés hacer?</h2>
          {!services ? (
            <p className="text-ink-soft">Cargando servicios...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedService(s);
                    setSelectedProfessional(null);
                    goTo(2);
                  }}
                  className="text-left rounded-2xl border border-ink/10 bg-white/60 p-5 hover:border-copper transition-colors"
                >
                  <p className="font-semibold text-ink">{s.name}</p>
                  <p className="text-sm text-ink-soft mt-1">
                    {s.durationMinutes} min · {formatMoney(s.price)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && selectedService && (
        <div>
          <h2 className="font-display text-2xl mb-1">¿Con quién?</h2>
          <p className="text-sm text-ink-soft mb-4">Para: {selectedService.name}</p>

          {!professionals ? (
            <p className="text-ink-soft">Cargando profesionales...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => {
                  setSelectedProfessional(null);
                  goTo(3);
                }}
                className="text-left rounded-2xl border border-dashed border-ink/20 bg-white/40 p-5 hover:border-copper transition-colors"
              >
                <p className="font-semibold text-ink">Cualquiera disponible</p>
                <p className="text-sm text-ink-soft mt-1">Te asignamos el primer horario libre</p>
              </button>
              {professionals.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProfessional(p);
                    goTo(3);
                  }}
                  className="text-left rounded-2xl border border-ink/10 bg-white/60 p-5 hover:border-copper transition-colors"
                >
                  <p className="font-semibold text-ink">{p.name}</p>
                  {p.bio && <p className="text-sm text-ink-soft mt-1 line-clamp-2">{p.bio}</p>}
                </button>
              ))}
            </div>
          )}

          <button onClick={() => goTo(1)} className="mt-6 text-sm text-ink-soft hover:text-copper">
            ← Volver
          </button>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 className="font-display text-2xl mb-4">¿Cuándo?</h2>

          <label className="block text-sm font-medium text-ink-soft mb-2">Elegí una fecha</label>
          <input
            type="date"
            value={date}
            min={todayISO()}
            max={maxDateISO()}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-ink/20 bg-white px-4 py-2 mb-6"
          />

          {loadingSlots && <p className="text-ink-soft">Buscando horarios disponibles...</p>}

          {!loadingSlots && slots && slots.length === 0 && (
            <p className="text-ink-soft">No hay horarios disponibles ese día. Probá con otra fecha.</p>
          )}

          {!loadingSlots && slots && slots.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-6">
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

          <div className="flex items-center justify-between">
            <button onClick={() => goTo(2)} className="text-sm text-ink-soft hover:text-copper">
              ← Volver
            </button>
            <button
              disabled={!selectedTime}
              onClick={() => goTo(4)}
              className="rounded-full bg-copper px-6 py-2.5 text-sm font-semibold text-cream disabled:opacity-40 hover:bg-copper-dark"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <form onSubmit={handleSubmitContactStep}>
          <h2 className="font-display text-2xl mb-4">Tus datos</h2>

          <div className="grid gap-4 sm:grid-cols-2 mb-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-soft mb-1">Nombre y apellido</label>
              <input
                required
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">Teléfono</label>
              <input
                required
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">Email</label>
              <input
                required
                type="email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-ink-soft mb-1">Notas (opcional)</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
                rows={2}
              />
            </div>
          </div>

          {depositPreview != null && (
            <p className="text-sm text-ink-soft mb-4">
              Para confirmar el turno se solicita una seña aproximada de <strong>{formatMoney(depositPreview)}</strong>{' '}
              (30% del servicio). El monto final se calcula en el siguiente paso.
            </p>
          )}

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => goTo(3)} className="text-sm text-ink-soft hover:text-copper">
              ← Volver
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-copper px-6 py-2.5 text-sm font-semibold text-cream disabled:opacity-40 hover:bg-copper-dark"
            >
              {submitting ? 'Reservando...' : 'Reservar y continuar'}
            </button>
          </div>
        </form>
      )}

      {step === 5 && booking && (
        <div>
          <h2 className="font-display text-2xl mb-4">Confirmá tu turno con una seña</h2>

          <div className="rounded-2xl border border-ink/10 bg-white/60 p-5 mb-6 text-sm space-y-1">
            <p>
              <strong>Servicio:</strong> {booking.serviceName}
            </p>
            <p>
              <strong>Profesional:</strong> {booking.professionalName}
            </p>
            <p>
              <strong>Fecha:</strong> {new Date(booking.startAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
            <p className="pt-2 text-copper-dark font-semibold">Seña a pagar ahora: {formatMoney(booking.depositAmount)}</p>
          </div>

          <p className="text-xs text-ink-soft mb-4">
            Este es un pago simulado para la demo: no se procesa ninguna tarjeta real. Ingresá cualquier número de 16
            dígitos.
          </p>

          <form onSubmit={handlePay} className="max-w-sm space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">Número de tarjeta</label>
              <input
                required
                inputMode="numeric"
                placeholder="4111 1111 1111 1111"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full rounded-lg border border-ink/20 bg-white px-4 py-2"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream disabled:opacity-40 hover:bg-ink/90"
            >
              {submitting ? 'Procesando pago...' : `Pagar seña de ${formatMoney(booking.depositAmount)}`}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
