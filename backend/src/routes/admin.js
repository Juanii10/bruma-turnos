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
  bookings,
} from '../db/schema.js';
import { signAdminToken, requireAdminAuth } from '../middleware/auth.js';

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
    const hoursToday = db
      .select()
      .from(workingHours)
      .where(and(eq(workingHours.professionalId, p.id), eq(workingHours.dayOfWeek, dayOfWeek)))
      .all();
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
