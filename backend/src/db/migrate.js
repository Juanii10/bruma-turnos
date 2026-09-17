import { sqlite } from './client.js';

// Migración simple: crea las tablas si no existen. No usamos drizzle-kit
// para mantener el setup liviano (ideal para un proyecto chico como este).
export function runMigrations() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
      currency TEXT NOT NULL DEFAULT 'ARS',
      deposit_percentage INTEGER NOT NULL DEFAULT 30,
      address TEXT,
      phone TEXT,
      instagram TEXT,
      opening_note TEXT
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professionals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bio TEXT,
      photo_url TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      price INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS professional_services (
      professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
      PRIMARY KEY (professional_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      start_minutes INTEGER NOT NULL,
      end_minutes INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professional_id INTEGER NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      start_minutes INTEGER,
      end_minutes INTEGER
    );

    -- Como mucho una excepción por profesional y fecha (si se vuelve a
    -- guardar la misma fecha, se reemplaza en vez de duplicarse).
    CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_overrides_professional_date
      ON schedule_overrides(professional_id, date);

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      professional_id INTEGER NOT NULL REFERENCES professionals(id),
      service_id INTEGER NOT NULL REFERENCES services(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_deposit',
      deposit_amount INTEGER NOT NULL,
      deposit_status TEXT NOT NULL DEFAULT 'pending',
      deposit_paid_at TEXT,
      cancel_token TEXT NOT NULL,
      reminder_sent_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_professional_start ON bookings(professional_id, start_at);
    CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

    -- Evita el double-booking a nivel de base de datos: dos turnos "activos"
    -- (pendientes de seña o confirmados) no pueden coexistir para el mismo
    -- profesional en el mismo horario exacto. Es un índice único PARCIAL:
    -- solo aplica a status pending_deposit/confirmed, así que un turno
    -- cancelado/expirado no bloquea que ese horario se reserve de nuevo.
    -- Esta es la protección real contra condiciones de carrera (dos personas
    -- reservando el mismo turno al mismo tiempo) — la validación de
    -- disponibilidad en el código es solo para dar feedback rápido antes de
    -- llegar hasta acá; quien de verdad decide es esta restricción.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_double_booking
      ON bookings(professional_id, start_at)
      WHERE status IN ('pending_deposit', 'confirmed');
  `);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  console.log('Migraciones aplicadas OK ->', process.env.DATABASE_FILE || 'data/bruma.db');
}