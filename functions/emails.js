// ─── ZELDTRADE — Emails transactionnels (Brevo SMTP) ─────────────────────────
// v0.9.284 — Pipeline d'emails custom pour CONTOURNER le verrou Firebase :
// Firebase a désactivé la personnalisation du corps/sujet des templates d'auth
// (mesure anti-phishing). On génère donc le lien d'action via l'Admin SDK
// (generateEmailVerificationLink / generatePasswordResetLink) côté index.js, et
// on envoie NOTRE propre HTML stylé via Brevo SMTP (domaine authentifié
// DKIM/SPF/DMARC → délivrabilité fiable).
//
// nodemailer + SMTP Brevo : login `ab7a14001@smtp-brevo.com`, mot de passe =
// secret BREVO_SMTP_PASS (clé `xsmtpsib-…`). From = noreply@zeldtrade.com.

const nodemailer = require('nodemailer');

const SMTP_HOST  = 'smtp-relay.brevo.com';
const SMTP_PORT  = 587;
const SMTP_USER  = 'ab7a14001@smtp-brevo.com';
const FROM_NAME  = 'ZeldTrade';
const FROM_EMAIL = 'noreply@zeldtrade.com';  // domaine authentifié Brevo
const REPLY_TO   = 'support@zeldtrade.com';

// Échappe les valeurs injectées dans le HTML (defense-in-depth — le pseudo est
// déjà sanitizé au signup, mais on ne fait jamais confiance à l'entrée).
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Coquille commune (dark + glow violet, sans emoji). `inner` = contenu de la carte.
function _shell(title, inner) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
</head>
<body style="margin:0;padding:0;background:#0d1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e6edf3;line-height:1.6">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#0d1117">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="560" style="max-width:560px;background:#161b22;border:1px solid #30363d;border-radius:14px;overflow:hidden">
  <tr><td align="center" style="padding:36px 24px 18px;background:linear-gradient(135deg,#1c2128 0%,#161b22 100%);border-bottom:1px solid #30363d">
    <div style="display:inline-block;width:54px;height:54px;border-radius:14px;background:linear-gradient(135deg,#a78bfa,#7c3aed);box-shadow:0 6px 20px rgba(124,58,237,0.4);line-height:54px;text-align:center;font-size:26px;font-weight:700;color:#fff;letter-spacing:-1px">Z</div>
    <h1 style="margin:16px 0 4px;font-size:22px;font-weight:700;color:#e6edf3;letter-spacing:-0.5px">ZeldTrade</h1>
    <p style="margin:0;font-size:13px;color:#8b949e">Journal de trading prop firm</p>
  </td></tr>
${inner}
  <tr><td style="padding:28px 32px 32px;border-top:1px solid #30363d">
    <p style="margin:0 0 6px;font-size:12px;color:#8b949e;text-align:center">
      <strong style="color:#a78bfa">ZeldTrade</strong> — Journal de trading pour traders prop firm
    </p>
    <p style="margin:0;font-size:11px;color:#6e7681;text-align:center">
      <a href="https://zeldtrade.com" style="color:#8b949e;text-decoration:none">zeldtrade.com</a>
      &nbsp;&middot;&nbsp;
      <a href="https://discord.gg/w4khB67hSa" style="color:#8b949e;text-decoration:none">Discord</a>
      &nbsp;&middot;&nbsp;
      <a href="https://zeldtrade.com/privacy" style="color:#8b949e;text-decoration:none">Confidentialité</a>
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function _cta(link, label) {
  return `  <tr><td align="center" style="padding:0 32px 8px">
    <a href="${esc(link)}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#5b21b6);color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.2px;box-shadow:0 6px 20px rgba(124,58,237,0.35);text-align:center">${esc(label)}</a>
  </td></tr>
  <tr><td style="padding:24px 32px 8px">
    <p style="margin:0 0 8px;font-size:13px;color:#8b949e;text-align:center">Le bouton ne marche pas&nbsp;? Copie-colle ce lien dans ton navigateur&nbsp;:</p>
    <p style="margin:0;font-size:11.5px;color:#6e7681;text-align:center;word-break:break-all;font-family:'SF Mono',Menlo,Consolas,monospace;background:#0d1117;border:1px solid #21262d;border-radius:6px;padding:8px 10px">${esc(link)}</p>
  </td></tr>`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

function verificationEmail({ displayName, email, link }) {
  const inner = `  <tr><td style="padding:36px 32px 8px">
    <h2 style="margin:0 0 14px;font-size:22px;color:#e6edf3;font-weight:600;letter-spacing:-0.3px">Bonjour ${esc(displayName)},</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#c9d1d9">Bienvenue dans la communauté ZeldTrade. Plus qu'une étape&nbsp;: <strong style="color:#a78bfa">vérifie ton adresse email</strong> pour débloquer ton compte.</p>
    <p style="margin:0 0 4px;font-size:14px;color:#8b949e">Email à vérifier&nbsp;:</p>
    <p style="margin:0 0 28px;font-size:14px;color:#c9d1d9;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:10px 14px;font-family:'SF Mono',Menlo,Consolas,monospace;word-break:break-all">${esc(email)}</p>
  </td></tr>
${_cta(link, 'Vérifier mon email')}
  <tr><td style="padding:24px 32px 0">
    <div style="background:#0d1117;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:14px 16px">
      <p style="margin:0 0 6px;font-size:13px;color:#e6edf3;font-weight:600">Pourquoi cette vérification&nbsp;?</p>
      <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.6">On s'assure que tu peux récupérer ton compte si tu perds ton mot de passe — et on évite les faux comptes spam.</p>
    </div>
  </td></tr>
  <tr><td style="padding:18px 32px 4px">
    <p style="margin:0;font-size:12px;color:#6e7681;text-align:center;line-height:1.6">Ce n'est pas toi qui t'es inscrit&nbsp;? Ignore ce mail, le compte ne sera pas activé.</p>
  </td></tr>`;
  return {
    subject: 'Vérifie ton adresse email — ZeldTrade',
    html: _shell('Vérifie ton email — ZeldTrade', inner),
  };
}

function resetEmail({ email, link }) {
  const inner = `  <tr><td style="padding:36px 32px 8px">
    <h2 style="margin:0 0 14px;font-size:22px;color:#e6edf3;font-weight:600;letter-spacing:-0.3px">Réinitialisation du mot de passe</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#c9d1d9">Une demande de réinitialisation a été faite pour ton compte ZeldTrade. Clique ci-dessous pour <strong style="color:#a78bfa">choisir un nouveau mot de passe</strong>.</p>
    <p style="margin:0 0 4px;font-size:14px;color:#8b949e">Compte concerné&nbsp;:</p>
    <p style="margin:0 0 28px;font-size:14px;color:#c9d1d9;background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:10px 14px;font-family:'SF Mono',Menlo,Consolas,monospace;word-break:break-all">${esc(email)}</p>
  </td></tr>
${_cta(link, 'Réinitialiser mon mot de passe')}
  <tr><td style="padding:24px 32px 0">
    <div style="background:#0d1117;border-left:3px solid #7c3aed;border-radius:0 8px 8px 0;padding:14px 16px">
      <p style="margin:0 0 6px;font-size:13px;color:#e6edf3;font-weight:600">Ce lien expire bientôt</p>
      <p style="margin:0;font-size:13px;color:#8b949e;line-height:1.6">Pour ta sécurité, ce lien n'est valable qu'un temps limité. Passé ce délai, refais une demande depuis la page de connexion.</p>
    </div>
  </td></tr>
  <tr><td style="padding:18px 32px 4px">
    <p style="margin:0;font-size:12px;color:#6e7681;text-align:center;line-height:1.6">Tu n'es pas à l'origine de cette demande&nbsp;? Ignore ce mail, ton mot de passe reste inchangé.</p>
  </td></tr>`;
  return {
    subject: 'Réinitialise ton mot de passe — ZeldTrade',
    html: _shell('Réinitialise ton mot de passe — ZeldTrade', inner),
  };
}

// ─── Envoi via Brevo SMTP ────────────────────────────────────────────────────

let _transporter = null;
function _getTransporter(pass) {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false,            // STARTTLS sur 587
    auth: { user: SMTP_USER, pass },
  });
  return _transporter;
}

async function sendEmail({ pass, to, toName, subject, html }) {
  if (!pass) throw new Error('BREVO_SMTP_PASS manquant');
  const transporter = _getTransporter(pass);
  await transporter.sendMail({
    from:    `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to:      toName ? `"${String(toName).replace(/"/g, '')}" <${to}>` : to,
    replyTo: REPLY_TO,
    subject,
    html,
  });
}

module.exports = { verificationEmail, resetEmail, sendEmail };
