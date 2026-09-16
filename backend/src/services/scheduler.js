import cron from 'node-cron';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db/client.js';
import { bookings, services, professionals, businessSettings } from '../db/schema.js';
import { sendEmail, bookingReminderEmail } from './email.js';

const PENDING_EXPIRY_MINUTES = 15; // tiempo que tiene el cliente para "pagar" la seña
const REMINDER_HOURS_BEFORE = 24;

function expireStalePendingBookings() {
  const cutoff = new Date(Date.now() - PENDING_EXPIRY_MINUTES * 60000).toISOString();
  const stale = db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, 'pending_deposit'), lt(bookings.createdAt, cutoff)))
    .all();

  for (const b of stale) {
    db.update(bookings).set({ status: 'expired' }).where(eq(bookings.id, b.id)).run();
    console.log(`[scheduler] Turno #${b.id} expirado por falta de pago de seña.`);
  }
}

async function sendUpcomingReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60000);

  const candidates = db.select().from(bookings).where(eq(bookings.status, 'confirmed')).all();
  const settings = db.select().from(businessSettings).get();
  if (!settings) return;

  for (const b of candidates) {
    if (b.reminderSentAt) continue;
    const start = new Date(b.startAt);
    if (start >= now && start <= windowEnd) {
      const service = db.select().from(services).where(eq(services.id, b.serviceId)).get();
      const professional = db.select().from(professionals).where(eq(professionals.id, b.professionalId)).get();

      const { subject, html } = bookingReminderEmail({
        businessName: settings.name,
        customerName: b.customerName,
        serviceName: service?.name || '',
        professionalName: professional?.name || '',
        startAt: b.startAt,
      });

      await sendEmail({ to: b.customerEmail, subject, html });
      db.update(bookings).set({ reminderSentAt: new Date().toISOString() }).where(eq(bookings.id, b.id)).run();
      console.log(`[scheduler] Recordatorio enviado para el turno #${b.id}.`);
    }
  }
}

export function startScheduler() {
  // Cada 5 minutos: liberar turnos pendientes de seña que vencieron
  cron.schedule('*/5 * * * *', expireStalePendingBookings);
  // Cada 15 minutos: mandar recordatorios de turnos confirmados próximos
  cron.schedule('*/15 * * * *', () => {
    sendUpcomingReminders().catch((err) => console.error('[scheduler] Error enviando recordatorios:', err));
  });

  console.log('[scheduler] Jobs programados: expiración de pendientes (5 min) y recordatorios (15 min).');
}
