/**
 * POST /api/auth/request-password-reset
 * Keha: { email } — vastus alati ühesugune (ei paljasta, kas e-post on olemas).
 */
import crypto from 'crypto';
import {
  parseJsonBody,
  normalizeEmail,
  getUserRecord,
  setResetToken,
  rateLimitReset,
  sendPasswordResetEmail,
} from './_lib.js';

const GENERIC = {
  ok: true,
  message:
    'Kui see e-post on meie juures kohaliku kontoga registreeritud, saadetakse peagi juhised parooli taastamiseks.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await parseJsonBody(req);
  const email = normalizeEmail(body.email);

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  try {
    if (!(await rateLimitReset(email))) {
      return res.status(429).json({ error: 'Too many requests. Try again later.' });
    }

    const rec = await getUserRecord(email);
    if (!rec) {
      return res.status(200).json(GENERIC);
    }

    const token = crypto.randomBytes(32).toString('hex');
    await setResetToken(token, email);
    const sent = await sendPasswordResetEmail(email, token);
    if (!sent.ok) {
      return res.status(503).json({
        error:
          'E-kirja saatmine pole hetkel seadistatud. Võta ühendust toega või proovi hiljem (arendaja: RESEND_API_KEY, RESEND_FROM, NM_PUBLIC_SITE_URL).',
      });
    }
    return res.status(200).json(GENERIC);
  } catch (e) {
    console.error('[auth/request-password-reset]', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
