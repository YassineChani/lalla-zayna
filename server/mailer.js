/**
 * Transactional emails (order confirmation to the customer + alert to the owner).
 *
 * Configure with environment variables (Gmail example):
 *   SMTP_USER = laallazaayna@gmail.com
 *   SMTP_PASS = <Gmail "mot de passe d'application" (16 caractères)>
 * Optional: SMTP_HOST, SMTP_PORT, MAIL_FROM, OWNER_EMAIL
 *
 * If SMTP is not configured, sending is skipped silently (the order is still saved).
 */
const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000
  });
  return transporter;
}

function isConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function itemsRows(order) {
  return (order.items || []).map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #eee;">
        <strong>${esc(i.name)}</strong>${i.color ? `<br><span style="color:#888;font-size:12px;">${esc(i.color)}</span>` : ''}
      </td>
      <td style="padding:10px 0;border-bottom:1px solid #eee;text-align:center;">× ${esc(i.quantity)}</td>
    </tr>`).join('');
}

function shell(title, inner) {
  return `<!doctype html><html><body style="margin:0;background:#f6f3ee;font-family:Arial,Helvetica,sans-serif;color:#222;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:#12100e;padding:22px;text-align:center;border-radius:8px 8px 0 0;">
      <div style="color:#c59b27;font-size:22px;letter-spacing:4px;font-weight:bold;">LALLA ZAYNA</div>
      <div style="color:#bbb;font-size:11px;letter-spacing:2px;margin-top:4px;">MAISON DE HAUTE MAROQUINERIE</div>
    </div>
    <div style="background:#fff;padding:28px;border-radius:0 0 8px 8px;">
      <h2 style="margin-top:0;color:#8d6f1a;">${title}</h2>
      ${inner}
    </div>
    <p style="text-align:center;color:#999;font-size:11px;margin-top:16px;">© Maison LALLA ZAYNA</p>
  </div></body></html>`;
}

function customerHtml(order) {
  const c = order.customer || {};
  return shell('✨ Votre commande est confirmée', `
    <p>Bonjour <strong>${esc(c.fullName)}</strong>,</p>
    <p>Merci pour votre confiance. Nous avons bien reçu votre commande <strong>${esc(order.orderId)}</strong>.
       Notre équipe vous contactera très prochainement pour confirmer la livraison.</p>
    <table style="width:100%;border-collapse:collapse;margin:18px 0;">${itemsRows(order)}</table>
    <p style="font-size:18px;"><strong>Total : ${esc(order.pricing && order.pricing.totalFormatted)}</strong></p>
    <p style="background:#fdfaf3;border:1px solid #ebd9ab;padding:12px;border-radius:6px;">
      🤝 <strong>Paiement à la livraison</strong> — vous réglez à la réception de votre sac.
    </p>
    <p><strong>Livraison :</strong><br>${esc(c.address)}, ${esc(c.city)} (${esc(c.country)})<br>📱 ${esc(c.phone)}</p>`);
}

function ownerHtml(order) {
  const c = order.customer || {};
  return shell('🔔 Nouvelle commande reçue', `
    <p><strong>Commande :</strong> ${esc(order.orderId)}</p>
    <p><strong>Client :</strong> ${esc(c.fullName)}<br>📱 ${esc(c.phone)}<br>✉️ ${esc(c.email)}<br>
       📍 ${esc(c.address)}, ${esc(c.city)} (${esc(c.country)})</p>
    <table style="width:100%;border-collapse:collapse;margin:14px 0;">${itemsRows(order)}</table>
    <p style="font-size:18px;"><strong>Total : ${esc(order.pricing && order.pricing.totalFormatted)}</strong></p>
    <p>Mode de paiement : ${esc(order.payment && order.payment.method)}</p>`);
}

async function send(to, subject, html) {
  const t = getTransporter();
  if (!t || !to) return { skipped: true };
  const from = process.env.MAIL_FROM || `"Maison LALLA ZAYNA" <${process.env.SMTP_USER}>`;
  try {
    await t.sendMail({ from, to, subject, html });
    return { sent: true };
  } catch (err) {
    console.error('[MAIL] send failed:', err.message);
    return { error: err.message };
  }
}

/**
 * Sends both emails. Never throws. Awaited by the caller (serverless functions
 * may be frozen right after the response, so we must finish before replying).
 */
async function sendOrderEmails(order, ownerFallbackEmail) {
  if (!isConfigured()) {
    console.log('[MAIL] SMTP not configured — emails skipped');
    return { skipped: true };
  }
  const owner = process.env.OWNER_EMAIL || ownerFallbackEmail || process.env.SMTP_USER;
  const customerEmail = order.customer && order.customer.email;
  const results = await Promise.all([
    send(customerEmail, `Confirmation de votre commande ${order.orderId} — LALLA ZAYNA`, customerHtml(order)),
    send(owner, `🔔 Nouvelle commande ${order.orderId} — ${order.customer && order.customer.fullName}`, ownerHtml(order))
  ]);
  return { customer: results[0], owner: results[1] };
}

module.exports = { sendOrderEmails, isConfigured };
