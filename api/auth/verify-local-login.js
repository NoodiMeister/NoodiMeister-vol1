/**
 * POST /api/auth/verify-local-login
 * Keha: { email, password } → 200 { email, name } | 401 | 404
 */
import { parseJsonBody, normalizeEmail, getUserRecord, verifyPasswordScrypt } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await parseJsonBody(req);
  const email = normalizeEmail(body.email);
  const password = body.password;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password required' });
  }

  try {
    const rec = await getUserRecord(email);
    if (!rec || !rec.passwordHash) {
      return res.status(404).json({ error: 'No server account' });
    }
    if (!verifyPasswordScrypt(password, rec.passwordHash, rec.passwordSalt)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.status(200).json({
      ok: true,
      email,
      name: String(rec.name || email.split('@')[0]),
    });
  } catch (e) {
    console.error('[auth/verify-local-login]', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
