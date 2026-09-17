import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { workingHours, scheduleOverrides, bookings, services } from '../db/schema.js';

const SLOT_STEP_MINUTES = 30; // granularidad de los horarios ofrecidos
const MIN_LEAD_MINUTES = 60; // no se puede reservar con menos de 1hs de anticipación

const ACTIVE_BOOKING_STATUSES = ['pending_deposit', 'confirmed'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function minutesToHHMM(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Parsea 'YYYY-MM-DD' a un Date a medianoche hora local del servidor. */
function parseDateLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Devuelve los rangos horarios (en minutos) en los que trabaja un profesional
 * en una fecha exacta. Si hay una excepción puntual cargada para esa fecha
 * (schedule_overrides), esa manda por completo — ya sea "cerrado" (sin
 * rangos) u "horario especial" (un rango distinto al de la plantilla). Si no
 * hay excepción, se usa la plantilla semanal (working_hours) para ese día de
 * la semana, tal como antes.
 */
export function getHourRangesForDate(professionalId, dateStr, dayOfWeek) {
  const override = db
    .select()
    .from(scheduleOverrides)
    .where(and(eq(scheduleOverrides.professionalId, professionalId), eq(scheduleOverrides.date, dateStr)))
    .get();

  if (override) {
    if (override.isClosed) return [];
    return [{ startMinutes: override.startMinutes, endMinutes: override.endMinutes }];
  }

  return db
    .select()
    .from(workingHours)
    .where(and(eq(workingHours.professionalId, professionalId), eq(workingHours.dayOfWeek, dayOfWeek)))
    .all();
}

/**
 * Calcula los horarios disponibles para un profesional + servicio en una fecha dada.
 * Devuelve un array de strings 'HH:MM' (hora de inicio del turno).
 */
export function getAvailableSlots({ professionalId, serviceId, dateStr, excludeBookingId = null }) {
  const service = db.select().from(services).where(eq(services.id, serviceId)).get();
  if (!service || !service.active) return [];

  const date = parseDateLocal(dateStr);
  const dayOfWeek = date.getDay();

  const hoursToday = getHourRangesForDate(professionalId, dateStr, dayOfWeek);

  if (hoursToday.length === 0) return [];

  const existingBookings = db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.professionalId, professionalId),
        inArray(bookings.status, ACTIVE_BOOKING_STATUSES),
      ),
    )
    .all()
    .filter((b) => b.startAt.slice(0, 10) === dateStr)
    // Al reprogramar un turno, no debe chocar consigo mismo (su propio horario viejo)
    .filter((b) => b.id !== excludeBookingId);

  const now = new Date();
  const isToday = dateStr === `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const earliestMinutesToday = isToday ? now.getHours() * 60 + now.getMinutes() + MIN_LEAD_MINUTES : -Infinity;

  const duration = service.durationMinutes;
  const slots = [];

  for (const range of hoursToday) {
    for (let start = range.startMinutes; start + duration <= range.endMinutes; start += SLOT_STEP_MINUTES) {
      if (start < earliestMinutesToday) continue;

      const slotStart = new Date(date);
      slotStart.setMinutes(start);
      const slotEnd = new Date(date);
      slotEnd.setMinutes(start + duration);

      const overlaps = existingBookings.some((b) => {
        const bStart = new Date(b.startAt);
        const bEnd = new Date(b.endAt);
        return slotStart < bEnd && bStart < slotEnd;
      });

      if (!overlaps) {
        slots.push(minutesToHHMM(start));
      }
    }
  }

  return slots;
}

export function buildDateTime(dateStr, hhmm) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}