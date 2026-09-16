import bcrypt from 'bcryptjs';
import { db, sqlite } from './client.js';
import { runMigrations } from './migrate.js';
import {
  businessSettings,
  admins,
  professionals,
  services,
  professionalServices,
  workingHours,
} from './schema.js';

function nowIso() {
  return new Date().toISOString();
}

async function seed() {
  runMigrations();

  const existing = db.select().from(businessSettings).all();
  if (existing.length > 0) {
    console.log('La base ya tiene datos. No se vuelve a sembrar (borrá data/bruma.db para reiniciar).');
    return;
  }

  console.log('Sembrando datos de ejemplo para BRUMA...');

  db.insert(businessSettings).values({
    name: 'BRUMA',
    slug: 'bruma',
    timezone: 'America/Argentina/Buenos_Aires',
    currency: 'ARS',
    depositPercentage: 30,
    address: 'Av. Cabildo 2450, CABA',
    phone: '+54 9 11 5555-1234',
    instagram: '@bruma.estudio',
    openingNote: 'Lunes a sábados de 10 a 19 hs',
  }).run();

  const passwordHash = await bcrypt.hash('bruma2026', 10);
  db.insert(admins).values({
    email: 'admin@bruma.test',
    passwordHash,
    name: 'Admin BRUMA',
    role: 'owner',
    createdAt: nowIso(),
  }).run();

  const profData = [
    { name: 'Sol Medina', bio: 'Especialista en color y coloración creativa. +8 años de experiencia.' },
    { name: 'Fede Cabrera', bio: 'Barbero especializado en cortes clásicos y arreglo de barba.' },
    { name: 'Cami Ruiz', bio: 'Estilista integral, especializada en tratamientos capilares.' },
  ];
  const profIds = [];
  for (const p of profData) {
    const res = db.insert(professionals).values({
      ...p,
      photoUrl: null,
      active: true,
      createdAt: nowIso(),
    }).run();
    profIds.push(Number(res.lastInsertRowid));
  }
  const [solId, fedeId, camiId] = profIds;

  const serviceData = [
    { name: 'Corte clásico', description: 'Corte a tijera o máquina, incluye lavado.', durationMinutes: 45, price: 8000 },
    { name: 'Corte + Barba', description: 'Corte de cabello y perfilado de barba.', durationMinutes: 60, price: 11000 },
    { name: 'Coloración', description: 'Color completo, incluye lavado y secado.', durationMinutes: 120, price: 25000 },
    { name: 'Brushing', description: 'Secado y peinado profesional.', durationMinutes: 40, price: 7000 },
    { name: 'Tratamiento capilar', description: 'Hidratación profunda y reparación.', durationMinutes: 50, price: 15000 },
  ];
  const serviceIds = [];
  for (const s of serviceData) {
    const res = db.insert(services).values({
      ...s,
      active: true,
      createdAt: nowIso(),
    }).run();
    serviceIds.push(Number(res.lastInsertRowid));
  }
  const [corteId, corteBarbaId, colorId, brushingId, tratamientoId] = serviceIds;

  // Qué servicios ofrece cada profesional
  const assignments = [
    [solId, corteId], [solId, corteBarbaId], [solId, colorId], [solId, brushingId], [solId, tratamientoId],
    [fedeId, corteId], [fedeId, corteBarbaId], [fedeId, brushingId],
    [camiId, corteId], [camiId, colorId], [camiId, brushingId], [camiId, tratamientoId],
  ];
  for (const [professionalId, serviceId] of assignments) {
    db.insert(professionalServices).values({ professionalId, serviceId }).run();
  }

  // Horarios: Sol y Cami trabajan Lunes(1) a Sábado(6) 10:00-19:00 (600-1140 min)
  // Fede trabaja Martes(2) a Sábado(6) 11:00-20:00 (660-1200 min)
  for (const day of [1, 2, 3, 4, 5, 6]) {
    db.insert(workingHours).values({ professionalId: solId, dayOfWeek: day, startMinutes: 600, endMinutes: 1140 }).run();
    db.insert(workingHours).values({ professionalId: camiId, dayOfWeek: day, startMinutes: 600, endMinutes: 1140 }).run();
  }
  for (const day of [2, 3, 4, 5, 6]) {
    db.insert(workingHours).values({ professionalId: fedeId, dayOfWeek: day, startMinutes: 660, endMinutes: 1200 }).run();
  }

  console.log('Listo. Datos de ejemplo cargados:');
  console.log('- Admin: admin@bruma.test / bruma2026');
  console.log(`- Profesionales: ${profData.map((p) => p.name).join(', ')}`);
  console.log(`- Servicios: ${serviceData.map((s) => s.name).join(', ')}`);
}

seed()
  .catch((err) => {
    console.error('Error sembrando datos:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    sqlite.close();
  });
