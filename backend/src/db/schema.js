import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// --- Negocio (config singleton) ---
export const businessSettings = sqliteTable('business_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  currency: text('currency').notNull().default('ARS'),
  depositPercentage: integer('deposit_percentage').notNull().default(30),
  address: text('address'),
  phone: text('phone'),
  instagram: text('instagram'),
  openingNote: text('opening_note'),
});

// --- Administradores ---
export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('admin'), // 'admin' | 'owner'
  createdAt: text('created_at').notNull(),
});

// --- Profesionales ---
export const professionals = sqliteTable('professionals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  bio: text('bio'),
  photoUrl: text('photo_url'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

// --- Servicios ---
export const services = sqliteTable('services', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  durationMinutes: integer('duration_minutes').notNull(),
  price: integer('price').notNull(), // en pesos, sin decimales
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
});

// --- Relación profesional <-> servicio (qué servicios ofrece cada uno) ---
export const professionalServices = sqliteTable('professional_services', {
  professionalId: integer('professional_id').notNull().references(() => professionals.id, { onDelete: 'cascade' }),
  serviceId: integer('service_id').notNull().references(() => services.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.professionalId, table.serviceId] }),
}));

// --- Horarios de trabajo por profesional ---
// dayOfWeek: 0 = domingo ... 6 = sábado. start/end en minutos desde medianoche.
export const workingHours = sqliteTable('working_hours', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  professionalId: integer('professional_id').notNull().references(() => professionals.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  startMinutes: integer('start_minutes').notNull(),
  endMinutes: integer('end_minutes').notNull(),
});

// --- Turnos ---
export const bookings = sqliteTable('bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  professionalId: integer('professional_id').notNull().references(() => professionals.id),
  serviceId: integer('service_id').notNull().references(() => services.id),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerEmail: text('customer_email').notNull(),
  startAt: text('start_at').notNull(), // ISO string
  endAt: text('end_at').notNull(), // ISO string
  status: text('status').notNull().default('pending_deposit'),
  // pending_deposit | confirmed | cancelled | completed | no_show | expired
  depositAmount: integer('deposit_amount').notNull(),
  depositStatus: text('deposit_status').notNull().default('pending'), // pending | paid
  depositPaidAt: text('deposit_paid_at'),
  cancelToken: text('cancel_token').notNull(),
  reminderSentAt: text('reminder_sent_at'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});
