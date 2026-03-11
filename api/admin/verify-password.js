/**
 * POST /api/admin/verify-password
 * Body: { email, password }
 * Kui parool õige (või esialgne seadistamine): tagastab { ok: true, token }.
 * Esialgne seadistamine: kui parooli pole, vaja ka body.secret === ADMIN_SECRET.
 */
import { isAdminEmail, getPasswordHash, getPasswordSalt, verifyPassword, setPassword, createJWT, adminStatus } from './_lib.js';

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = await parseBody(req);
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;

  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }
  if (!isAdminEmail(email)) {
    return res.status(403).json({ error: 'Not an administrator' });
  }

  const hash = await getPasswordHash();
  const salt = await getPasswordSalt();
  const hasPasswordSet = !!hash;

  if (!hasPasswordSet) {
    const secret = process.env.ADMIN_SECRET;
    if (!secret || body.secret !== secret) {
      return res.status(400).json({ error: 'Initial setup requires secret (ADMIN_SECRET)' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    await setPassword(String(password));
    const token = createJWT(email);
    return res.status(200).json({ ok: true, token });
  }

  if (!password) {
    return res.status(400).json({ error: 'password required' });
  }
  if (!verifyPassword(String(password), hash, salt)) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = createJWT(email);
  const status = await adminStatus(email);
  return res.status(200).json({ ok: true, token, mustChangePassword: status.mustChangePassword });
}
