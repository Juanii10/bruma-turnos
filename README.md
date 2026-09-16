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

## Sobre el stack

Para este proyecto se usó **Drizzle ORM + SQLite (better-sqlite3)**:
Drizzle es 100% JS/SQL, no depende de binarios externos.

## Pago de seña

El pago de la seña está **simulado**: no se integra ningún gateway de pago
real, solo se valida que el número de tarjeta tenga 16 dígitos.

