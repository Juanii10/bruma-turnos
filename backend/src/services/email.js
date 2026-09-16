import nodemailer from 'nodemailer';

let transporter = null;
let smtpConfigured = false;

function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    smtpConfigured = true;
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT || 587),
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Envía un mail. Si no hay SMTP configurado (variables SMTP_* en .env),
 * cae en modo simulado: solo lo imprime por consola. Así el proyecto
 * corre "out of the box" sin necesitar credenciales reales de mail.
 */
export async function sendEmail({ to, subject, html, text }) {
  const t = getTransporter();

  if (!smtpConfigured || !t) {
    console.log('\n📧 [EMAIL SIMULADO] (configurá SMTP_HOST/SMTP_USER/SMTP_PASS en .env para enviar mails reales)');
    console.log(`   Para: ${to}`);
    console.log(`   Asunto: ${subject}`);
    console.log(`   ${text || html?.replace(/<[^>]+>/g, ' ')}\n`);
    return { simulated: true };
  }

  const from = process.env.SMTP_FROM || `"BRUMA" <${process.env.SMTP_USER}>`;
  const info = await t.sendMail({ from, to, subject, html, text });
  return { simulated: false, messageId: info.messageId };
}

export function formatMoney(amountArs) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amountArs);
}

export function formatDateTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function bookingConfirmationEmail({ businessName, customerName, serviceName, professionalName, startAt, depositAmount, cancelUrl }) {
  const when = formatDateTime(startAt);
  const subject = `Turno confirmado en ${businessName} — ${when}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2>¡Turno confirmado! ✂️</h2>
      <p>Hola ${customerName}, tu turno en <strong>${businessName}</strong> quedó confirmado:</p>
      <ul>
        <li><strong>Servicio:</strong> ${serviceName}</li>
        <li><strong>Profesional:</strong> ${professionalName}</li>
        <li><strong>Fecha y hora:</strong> ${when}</li>
        <li><strong>Seña abonada:</strong> ${formatMoney(depositAmount)}</li>
      </ul>
      <p>Si necesitás cancelar o reprogramar, <a href="${cancelUrl}">hacé click acá</a>.</p>
    </div>
  `;
  return { subject, html };
}

export function bookingReminderEmail({ businessName, customerName, serviceName, professionalName, startAt }) {
  const when = formatDateTime(startAt);
  const subject = `Recordatorio: tu turno en ${businessName} es pronto`;
  const html = `
    <div style="font-family: sans-serif; max-width: 480px;">
      <h2>¡Te esperamos! 💈</h2>
      <p>Hola ${customerName}, te recordamos tu turno en <strong>${businessName}</strong>:</p>
      <ul>
        <li><strong>Servicio:</strong> ${serviceName}</li>
        <li><strong>Profesional:</strong> ${professionalName}</li>
        <li><strong>Fecha y hora:</strong> ${when}</li>
      </ul>
    </div>
  `;
  return { subject, html };
}
