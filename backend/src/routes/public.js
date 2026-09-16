import { Router } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  businessSettings,
  services,
  professionals,
  professionalServices,
  bookings,
} from '../db/schema.js';
import { getAvailableSlots, buildDateTime } from '../services/availability.js';
import { generateToken } from '../utils/token.js';
import { sendEmail, bookingConfirmationEmail } from '../services/email.js';

export const publicRouter = Router();

function getSettings() {
  return db.select().from(businessSettings).get();
}

publicRouter.get('/business', (req, res) => {
  const settings = getSettings();
  if (!settings) return res.status(404).json({ error: 'Negocio no configurado' });
  res.json(settings);
});

publicRouter.get('/services', (req, res) => {
  const rows = db.select().from(services).where(eq(services.active, true)).all();
  res.json(rows);
});

publicRouter.get('/professionals', (req, res) => {
  const { serviceId } = req.query;
  let rows = db.select().from(professionals).where(eq(professionals.active, true)).all();

  if (serviceId) {
    const links = db
      .select()
      .from(professionalServices)
      .where(eq(professionalServices.serviceId, Number(serviceId)))
      .all();
    const allowedIds = new Set(links.map((l) => l.professionalId));
    rows = rows.filter((p) => allowedIds.has(p.id));
  }

  res.json(rows);
});

publicRouter.get('/availability', (req, res) => {
  const { serviceId, professionalId, date } = req.query;

  if (!serviceId || !date) {
    return res.status(400).json({ error: 'Faltan parámetros: serviceId y date son requeridos' });
  }

  const svcId = Number(serviceId);

  if (professionalId && professionalId !== 'any') {
    const slots = getAvailableSlots({ professionalId: Number(professionalId), serviceId: svcId, dateStr: date });
    return res.json({ slots });
  }

  // "Cualquiera disponible": unión de horarios de todos los profesionales que ofrecen el servicio
  const links = db.select().from(professionalServices).where(eq(professionalServices.serviceId, svcId)).all();
  const activeProfessionals = db.select().from(professionals).where(eq(professionals.active, true)).all();
  const eligibleIds = new Set(links.map((l) => l.professionalId));
  const eligibleProfessionals = activeProfessionals.filter((p) => eligibleIds.has(p.id));

  const slotSet = new Set();
  for (const p of eligibleProfessionals) {
    const slots = getAvailableSlots({ professionalId: p.id, serviceId: svcId, dateStr: date });
    slots.forEach((s) => slotSet.add(s));
  }

  res.json({ slots: Array.from(slotSet).sort() });
});

publicRouter.post('/bookings', async (req, res) => {
  const { serviceId, professionalId, date, time, customerName, customerPhone, customerEmail, notes } = req.body || {};

  if (!serviceId || !date || !time || !customerName || !customerPhone || !customerEmail) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const service = db.select().from(services).where(eq(services.id, Number(serviceId))).get();
  if (!service || !service.active) {
    return res.status(404).json({ error: 'Servicio no encontrado' });
  }

  const settings = getSettings();

  let assignedProfessionalId = null;

  if (professionalId && professionalId !== 'any') {
    const candidateId = Number(professionalId);
    const slots = getAvailableSlots({ professionalId: candidateId, serviceId: service.id, dateStr: date });
    if (!slots.includes(time)) {
      return res.status(409).json({ error: 'Ese horario ya no está disponible. Elegí otro.' });
    }
    assignedProfessionalId = candidateId;
  } else {
    const links = db.select().from(professionalServices).where(eq(professionalServices.serviceId, service.id)).all();
    const activeProfessionals = db.select().from(professionals).where(eq(professionals.active, true)).all();
    const eligibleIds = new Set(links.map((l) => l.professionalId));
    const eligibleProfessionals = activeProfessionals.filter((p) => eligibleIds.has(p.id));

    for (const p of eligibleProfessionals) {
      const slots = getAvailableSlots({ professionalId: p.id, serviceId: service.id, dateStr: date });
      if (slots.includes(time)) {
        assignedProfessionalId = p.id;
        break;
      }
    }
    if (!assignedProfessionalId) {
      return res.status(409).json({ error: 'Ese horario ya no está disponible con ningún profesional. Elegí otro.' });
    }
  }

  const professional = db.select().from(professionals).where(eq(professionals.id, assignedProfessionalId)).get();

  const startAt = buildDateTime(date, time);
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);
  const depositAmount = Math.round((service.price * settings.depositPercentage) / 100);
  const cancelToken = generateToken();

  let result;
  try {
    result = db
      .insert(bookings)
      .values({
        professionalId: assignedProfessionalId,
        serviceId: service.id,
        customerName,
        customerPhone,
        customerEmail,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        status: 'pending_deposit',
        depositAmount,
        depositStatus: 'pending',
        cancelToken,
        notes: notes || null,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (err) {
    // La restricción única de la base de datos (idx_bookings_no_double_booking)
    // es quien tiene la última palabra: si dos personas pidieron el mismo
    // turno casi al mismo tiempo, acá es donde se resuelve de verdad —
    // el chequeo de disponibilidad de más arriba es solo una validación
    // rápida, no la fuente de verdad.
    if (String(err.code).startsWith('SQLITE_CONSTRAINT') || /UNIQUE constraint failed/.test(err.message || '')) {
      return res.status(409).json({ error: 'Justo se reservó ese horario. Elegí otro, por favor.' });
    }
    throw err;
  }

  const bookingId = Number(result.lastInsertRowid);

  res.status(201).json({
    id: bookingId,
    cancelToken,
    professionalId: assignedProfessionalId,
    professionalName: professional.name,
    serviceName: service.name,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    depositAmount,
    depositPercentage: settings.depositPercentage,
    businessName: settings.name,
  });
});

publicRouter.get('/bookings/:id', (req, res) => {
  const { token } = req.query;
  const booking = db.select().from(bookings).where(eq(bookings.id, Number(req.params.id))).get();
  if (!booking || booking.cancelToken !== token) {
    return res.status(404).json({ error: 'Turno no encontrado' });
  }

  const service = db.select().from(services).where(eq(services.id, booking.serviceId)).get();
  const professional = db.select().from(professionals).where(eq(professionals.id, booking.professionalId)).get();

  res.json({ ...booking, serviceName: service?.name, professionalName: professional?.name });
});

publicRouter.post('/bookings/:id/pay', async (req, res) => {
  const { token, cardNumber } = req.body || {};
  const bookingId = Number(req.params.id);
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();

  if (!booking || booking.cancelToken !== token) {
    return res.status(404).json({ error: 'Turno no encontrado' });
  }
  if (booking.status !== 'pending_deposit') {
    return res.status(409).json({ error: `El turno ya está en estado "${booking.status}"` });
  }

  // Pago simulado: no se procesa ninguna tarjeta real. Solo validamos formato básico
  // para que la demo se sienta real (16 dígitos).
  const digitsOnly = String(cardNumber || '').replace(/\s/g, '');
  if (!/^\d{16}$/.test(digitsOnly)) {
    return res.status(400).json({ error: 'Número de tarjeta inválido (simulado, probá con 16 dígitos cualquiera)' });
  }

  const now = new Date().toISOString();
  db
    .update(bookings)
    .set({ status: 'confirmed', depositStatus: 'paid', depositPaidAt: now })
    .where(eq(bookings.id, bookingId))
    .run();

  const service = db.select().from(services).where(eq(services.id, booking.serviceId)).get();
  const professional = db.select().from(professionals).where(eq(professionals.id, booking.professionalId)).get();
  const settings = getSettings();

  const { subject, html } = bookingConfirmationEmail({
    businessName: settings.name,
    customerName: booking.customerName,
    serviceName: service.name,
    professionalName: professional.name,
    startAt: booking.startAt,
    depositAmount: booking.depositAmount,
    cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:4321'}/turno/${bookingId}?token=${booking.cancelToken}`,
  });
  await sendEmail({ to: booking.customerEmail, subject, html });

  res.json({ ok: true, status: 'confirmed' });
});

publicRouter.post('/bookings/:id/cancel', (req, res) => {
  const { token } = req.body || {};
  const bookingId = Number(req.params.id);
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();

  if (!booking || booking.cancelToken !== token) {
    return res.status(404).json({ error: 'Turno no encontrado' });
  }
  if (['cancelled', 'completed', 'no_show', 'expired'].includes(booking.status)) {
    return res.status(409).json({ error: `El turno ya está en estado "${booking.status}"` });
  }

  db.update(bookings).set({ status: 'cancelled' }).where(eq(bookings.id, bookingId)).run();
  res.json({ ok: true, status: 'cancelled' });
});
