# BRUMA — Sistema de turnos para peluquería/barbería

Proyecto de portfolio: sistema de reserva de turnos online para un salón de
belleza/barbería ficticio ("BRUMA"), pensado como pieza de venta para
clientes freelance reales (peluquerías, barberías, consultorios, estudios,
etc. — cualquier negocio que trabaje con turnos).

## Qué incluye

**Sitio público** (Astro + React + Tailwind)
- Home, Servicios, Equipo
- Flujo de reserva en 5 pasos: servicio → profesional (o "cualquiera
  disponible") → fecha/hora → datos de contacto → pago de seña (simulado)
- Página de estado del turno (ver detalle / cancelar) vía link enviado por mail

**Backend** (Node.js + Express)
- Cálculo de disponibilidad real por profesional, servicio y horario de trabajo
- Reservas como invitado (sin cuenta), con seña para confirmar y evitar
  faltazos
- Vencimiento automático de reservas pendientes de seña (15 min)
- Mails de confirmación y recordatorio (24hs antes) — en modo simulado por
  consola si no hay SMTP configurado, para poder probar todo el flujo sin
  necesitar una cuenta de mail real
- Panel de administración con autenticación (JWT): turnos, servicios,
  profesionales (con horarios y servicios que ofrece cada uno) y estadísticas
  básicas (ocupación, servicios más pedidos)

## Sobre el stack (una diferencia con NULA)

NULA usa Prisma como ORM. Para este proyecto se usó **Drizzle ORM +
SQLite (better-sqlite3)** en su lugar: Prisma necesita descargar un binario
del "query engine" desde un servidor propio de Prisma, y esa descarga
estuvo bloqueada en el entorno donde arme y probé este proyecto — no depende
de tu conexión, es una política de red del sandbox. Drizzle es 100% JS/SQL,
no depende de binarios externos, y el resultado es equivalente: schema
como código, queries tipadas, y una migración simple.

Para producción con Postgres (Neon, como en NULA) el cambio es chico:
1. `npm install pg` (o usar el driver serverless de Neon)
2. En `src/db/client.js`, cambiar el import de `drizzle-orm/better-sqlite3`
   por `drizzle-orm/node-postgres` (o `drizzle-orm/neon-http`) y conectar
   con `DATABASE_URL` en vez de un archivo.
3. En `src/db/schema.js`, cambiar el import de `drizzle-orm/sqlite-core`
   por `drizzle-orm/pg-core` (los nombres de columnas son casi idénticos).
4. Adaptar el `CREATE TABLE` de `src/db/migrate.js` a sintaxis de Postgres
   (tipos `SERIAL`/`BOOLEAN` en vez de `INTEGER AUTOINCREMENT`/`INTEGER`).

## Correr el proyecto localmente

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate   # crea las tablas (SQLite en ./data/bruma.db)
npm run seed       # carga datos de ejemplo (servicios, profesionales, admin)
npm run dev        # http://localhost:3001
```

Admin de prueba: **admin@bruma.test** / **bruma2026** (cambiá esto antes de
usar el proyecto con un cliente real).

### Frontend

```bash
cd frontend
cp .env.example .env   # PUBLIC_API_URL apuntando al backend
npm install
npm run dev             # http://localhost:4321
```

## Mails reales (opcional)

Completá `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` en
`backend/.env` con una cuenta SMTP real (Gmail con contraseña de aplicación,
SendGrid, Resend, etc.). Sin esas variables, el sistema simula el envío
imprimiendo el mail por consola — así podés probar el flujo completo sin
depender de credenciales de mail.

## Deploy sugerido (mismo patrón que NULA)

- **Backend** → Render (o Railway/Fly.io). Variables de entorno: las de
  `.env.example` + `DATABASE_URL` si migrás a Postgres.
- **Base de datos** → Neon (Postgres) si migrás desde SQLite, siguiendo los
  pasos de arriba.
- **Frontend** → Vercel. Es un sitio 100% estático (`npm run build` genera
  `dist/`), con `PUBLIC_API_URL` apuntando a la URL del backend en Render.

## Pago de seña (importante)

El pago de la seña está **simulado**: no se integra ningún gateway de pago
real, solo se valida que el número de tarjeta tenga 16 dígitos. Para un
cliente real en Argentina, el paso natural sería integrar **Mercado Pago
Checkout Pro/API** en `backend/src/routes/public.js` (el endpoint
`POST /bookings/:id/pay` es el único lugar que habría que tocar).

## Estructura

```
bruma-turnos/
├── backend/
│   ├── src/
│   │   ├── db/          # schema, migración, seed
│   │   ├── routes/       # public.js (reservas), admin.js (panel)
│   │   ├── services/     # disponibilidad, mail, cron jobs
│   │   ├── middleware/    # auth admin (JWT)
│   │   └── app.js, server.js
│   └── data/bruma.db     # base SQLite (se regenera con migrate+seed)
└── frontend/
    └── src/
        ├── pages/         # rutas públicas + /admin/*
        ├── components/    # islands de React (booking wizard, admin, etc.)
        └── layouts/
```
