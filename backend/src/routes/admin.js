import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  admins,
  professionals,
  services,
  professionalServices,
  workingHours,
  scheduleOverrides,
  bookings,
} from '../db/schema.js';
import { signAdminToken, requireAdminAuth } from '../middleware/auth.js';
import { getHourRangesForDate } from '../services/availability.js';

export const adminRouter = Router();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------- Auth ----------

adminRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const admin = db.select().from(admins).where(eq(admins.email, email)).get();
  if (!admin) return res.status(401).json({ error: 'Credenciales inválidas' });

  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = signAdminToken(admin);
  res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
});

adminRouter.get('/me', requireAdminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

// Todo lo de abajo requiere estar autenticado como admin
adminRouter.use(requireAdminAuth);

adminRouter.patch('/me/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Ingresá tu contraseña actual y la nueva contraseña' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña tiene que tener al menos 8 caracteres' });
  }

  const admin = db.select().from(admins).where(eq(admins.id, req.admin.sub)).get();
  if (!admin) return res.status(404).json({ error: 'Usuario no encontrado' });

  const ok = await bcrypt.compare(currentPassword, admin.passwordHash);
  if (!ok) return res.status(401).json({ error: 'La contraseña actual no es correcta' });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  db.update(admins).set({ passwordHash }).where(eq(admins.id, admin.id)).run();

  res.json({ ok: true });
});

// ---------- Turnos ----------

adminRouter.get('/bookings', (req, res) => {
  const { date, status, professionalId } = req.query;

  let rows = db.select().from(bookings).all();

  if (date) rows = rows.filter((b) => b.startAt.slice(0, 10) === date);
  if (status) rows = rows.filter((b) => b.status === status);
  if (professionalId) rows = rows.filter((b) => b.professionalId === Number(professionalId));

  rows.sort((a, b) => a.startAt.localeCompare(b.startAt));

  const allServices = db.select().from(services).all();
  const allProfessionals = db.select().from(professionals).all();
  const serviceMap = Object.fromEntries(allServices.map((s) => [s.id, s.name]));
  const professionalMap = Object.fromEntries(allProfessionals.map((p) => [p.id, p.name]));

  const enriched = rows.map((b) => ({
    ...b,
    serviceName: serviceMap[b.serviceId] || '(borrado)',
    professionalName: professionalMap[b.professionalId] || '(borrado)',
  }));

  res.json(enriched);
});

adminRouter.patch('/bookings/:id', (req, res) => {
  const { status } = req.body || {};
  const validStatuses = ['pending_deposit', 'confirmed', 'cancelled', 'completed', 'no_show', 'expired'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}` });
  }

  const bookingId = Number(req.params.id);
  const booking = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!booking) return res.status(404).json({ error: 'Turno no encontrado' });

  db.update(bookings).set({ status }).where(eq(bookings.id, bookingId)).run();
  res.json({ ok: true });
});

// ---------- Servicios ----------

adminRouter.get('/services', (req, res) => {
  res.json(db.select().from(services).all());
});

adminRouter.post('/services', (req, res) => {
  const { name, description, durationMinutes, price } = req.body || {};
  if (!name || !durationMinutes || price == null) {
    return res.status(400).json({ error: 'name, durationMinutes y price son requeridos' });
  }
  const result = db
    .insert(services)
    .values({ name, description: description || null, durationMinutes, price, active: true, createdAt: new Date().toISOString() })
    .run();
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

adminRouter.patch('/services/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.select().from(services).where(eq(services.id, id)).get();
  if (!existing) return res.status(404).json({ error: 'Servicio no encontrado' });

  const { name, description, durationMinutes, price, active } = req.body || {};
  db
    .update(services)
    .set({
      name: name ?? existing.name,
      description: description ?? existing.description,
      durationMinutes: durationMinutes ?? existing.durationMinutes,
      price: price ?? existing.price,
      active: active ?? existing.active,
    })
    .where(eq(services.id, id))
    .run();
  res.json({ ok: true });
});

// ---------- Profesionales ----------

function getServiceIdsFor(professionalId) {
  return db
    .select()
    .from(professionalServices)
    .where(eq(professionalServices.professionalId, professionalId))
    .all()
    .map((l) => l.serviceId);
}

function getWorkingHoursFor(professionalId) {
  return db.select().from(workingHours).where(eq(workingHours.professionalId, professionalId)).all();
}

adminRouter.get('/professionals', (req, res) => {
  const rows = db.select().from(professionals).all();
  const enriched = rows.map((p) => ({
    ...p,
    serviceIds: getServiceIdsFor(p.id),
    workingHours: getWorkingHoursFor(p.id),
  }));
  res.json(enriched);
});

adminRouter.post('/professionals', (req, res) => {
  const { name, bio, photoUrl, serviceIds = [], workingHours: hours = [] } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name es requerido' });

  const result = db
    .insert(professionals)
    .values({ name, bio: bio || null, photoUrl: photoUrl || null, active: true, createdAt: new Date().toISOString() })
    .run();
  const id = Number(result.lastInsertRowid);

  for (const serviceId of serviceIds) {
    db.insert(professionalServices).values({ professionalId: id, serviceId: Number(serviceId) }).run();
  }
  for (const h of hours) {
    db.insert(workingHours).values({ professionalId: id, dayOfWeek: h.dayOfWeek, startMinutes: h.startMinutes, endMinutes: h.endMinutes }).run();
  }

  res.status(201).json({ id });
});

adminRouter.patch('/professionals/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.select().from(professionals).where(eq(professionals.id, id)).get();
  if (!existing) return res.status(404).json({ error: 'Profesional no encontrado' });

  const { name, bio, photoUrl, active, serviceIds, workingHours: hours } = req.body || {};
  db
    .update(professionals)
    .set({
      name: name ?? existing.name,
      bio: bio ?? existing.bio,
      photoUrl: photoUrl ?? existing.photoUrl,
      active: active ?? existing.active,
    })
    .where(eq(professionals.id, id))
    .run();

  if (Array.isArray(serviceIds)) {
    db.delete(professionalServices).where(eq(professionalServices.professionalId, id)).run();
    for (const serviceId of serviceIds) {
      db.insert(professionalServices).values({ professionalId: id, serviceId: Number(serviceId) }).run();
    }
  }

  if (Array.isArray(hours)) {
    db.delete(workingHours).where(eq(workingHours.professionalId, id)).run();
    for (const h of hours) {
      db.insert(workingHours).values({ professionalId: id, dayOfWeek: h.dayOfWeek, startMinutes: h.startMinutes, endMinutes: h.endMinutes }).run();
    }
  }

  res.json({ ok: true });
});

// ---------- Excepciones puntuales de horario ----------
// Para profesionales que no manejan un horario semanal fijo: además (o en
// vez) de la plantilla semanal en "workingHours", acá se puede marcar una
// fecha exacta como cerrada o con un horario especial que pisa la plantilla.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

adminRouter.get('/professionals/:id/schedule-overrides', (req, res) => {
  const professionalId = Number(req.params.id);
  const professional = db.select().from(professionals).where(eq(professionals.id, professionalId)).get();
  if (!professional) return res.status(404).json({ error: 'Profesional no encontrado' });

  const today = todayStr();
  const from = req.query.from && DATE_RE.test(req.query.from) ? req.query.from : today;

  const rows = db
    .select()
    .from(scheduleOverrides)
    .where(eq(scheduleOverrides.professionalId, professionalId))
    .all()
    .filter((o) => o.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(rows);
});

adminRouter.put('/professionals/:id/schedule-overrides/:date', (req, res) => {
  const professionalId = Number(req.params.id);
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Fecha inválida, debe ser YYYY-MM-DD' });

  const professional = db.select().from(professionals).where(eq(professionals.id, professionalId)).get();
  if (!professional) return res.status(404).json({ error: 'Profesional no encontrado' });

  const { isClosed, startMinutes, endMinutes } = req.body || {};

  let values;
  if (isClosed) {
    values = { professionalId, date, isClosed: true, startMinutes: null, endMinutes: null };
  } else {
    if (
      !Number.isInteger(startMinutes) ||
      !Number.isInteger(endMinutes) ||
      startMinutes < 0 ||
      endMinutes > 24 * 60 ||
      startMinutes >= endMinutes
    ) {
      return res.status(400).json({ error: 'Para un horario especial, indicá startMinutes y endMinutes válidos (startMinutes < endMinutes)' });
    }
    values = { professionalId, date, isClosed: false, startMinutes, endMinutes };
  }

  const existing = db
    .select()
    .from(scheduleOverrides)
    .where(and(eq(scheduleOverrides.professionalId, professionalId), eq(scheduleOverrides.date, date)))
    .get();

  if (existing) {
    db.update(scheduleOverrides).set(values).where(eq(scheduleOverrides.id, existing.id)).run();
  } else {
    db.insert(scheduleOverrides).values(values).run();
  }

  res.json({ ok: true });
});

adminRouter.delete('/professionals/:id/schedule-overrides/:date', (req, res) => {
  const professionalId = Number(req.params.id);
  const { date } = req.params;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Fecha inválida, debe ser YYYY-MM-DD' });

  db
    .delete(scheduleOverrides)
    .where(and(eq(scheduleOverrides.professionalId, professionalId), eq(scheduleOverrides.date, date)))
    .run();

  res.json({ ok: true });
});

// ---------- Estadísticas ----------

adminRouter.get('/stats', (req, res) => {
  const date = req.query.date || todayStr();

  const allBookings = db.select().from(bookings).all();
  const todayBookings = allBookings.filter((b) => b.startAt.slice(0, 10) === date && b.status !== 'cancelled' && b.status !== 'expired');

  const activeProfessionals = db.select().from(professionals).where(eq(professionals.active, true)).all();
  const dayOfWeek = (() => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).getDay();
  })();

  const occupancyByProfessional = activeProfessionals.map((p) => {
    const hoursToday = getHourRangesForDate(p.id, date, dayOfWeek);
    const availableMinutes = hoursToday.reduce((sum, h) => sum + (h.endMinutes - h.startMinutes), 0);

    const professionalBookings = todayBookings.filter((b) => b.professionalId === p.id);
    const bookedMinutes = professionalBookings.reduce((sum, b) => {
      const start = new Date(b.startAt);
      const end = new Date(b.endAt);
      return sum + (end - start) / 60000;
    }, 0);

    return {
      professionalId: p.id,
      name: p.name,
      availableMinutes,
      bookedMinutes,
      occupancyPct: availableMinutes > 0 ? Math.round((bookedMinutes / availableMinutes) * 100) : null,
      bookingsCount: professionalBookings.length,
    };
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const recentBookings = allBookings.filter((b) => b.createdAt >= thirtyDaysAgo && b.status !== 'cancelled' && b.status !== 'expired');
  const allServices = db.select().from(services).all();
  const serviceMap = Object.fromEntries(allServices.map((s) => [s.id, s.name]));

  const countByService = {};
  for (const b of recentBookings) {
    countByService[b.serviceId] = (countByService[b.serviceId] || 0) + 1;
  }
  const topServices = Object.entries(countByService)
    .map(([serviceId, count]) => ({ serviceId: Number(serviceId), name: serviceMap[serviceId] || '(borrado)', count }))
    .sort((a, b) => b.count - a.count);

  res.json({
    date,
    todayCount: todayBookings.length,
    todayBookings,
    occupancyByProfessional,
    topServices,
  });
});
