/**
 * POST /api/auth/sync-local-account
 * Loo serveripoolne kirje ainult kui seda pole (esimene registreerimine / legacy sünk).
 * Keha: { email, password, name? }
 */
import {
  parseJsonBody,
  normalizeEmail,
  hashPassword,
  getUserRecord,
  setUserRecord,
  getClientIp,
  rateLimitSync,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  if (!(await rateLimitSync(ip))) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const body = await parseJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = body.password;
  const name = String(body.name || '').trim() || email.split('@')[0];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const existing = await getUserRecord(email);
    if (existing) {
      return res.status(409).json({ error: 'Account already exists on server', code: 'server_exists' });
    }
    const { hashB64, saltB64 } = hashPassword(password);
    await setUserRecord(email, {
      passwordHash: hashB64,
      passwordSalt: saltB64,
      name,
      updatedAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[auth/sync-local-account]', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
