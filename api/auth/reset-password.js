/**
 * POST /api/auth/reset-password
 * Keha: { token, newPassword }
 */
import { parseJsonBody, consumeResetToken, hashPassword, setUserRecord, getUserRecord } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await parseJsonBody(req);
  const token = String(body.token || '').trim();
  const newPassword = body.newPassword;

  if (!token || token.length < 20) {
    return res.status(400).json({ error: 'Invalid or missing token' });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const email = await consumeResetToken(token);
    if (!email) {
      return res.status(400).json({
        error: 'Link on aegunud või juba kasutatud. Taotle uus taastamislink.',
        code: 'invalid_token',
      });
    }

    const existing = await getUserRecord(email);
    const name = existing?.name || email.split('@')[0];
    const { hashB64, saltB64 } = hashPassword(newPassword);
    await setUserRecord(email, {
      passwordHash: hashB64,
      passwordSalt: saltB64,
      name,
      updatedAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true, message: 'Parool on uuendatud. Võid nüüd sisse logida.' });
  } catch (e) {
    console.error('[auth/reset-password]', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
