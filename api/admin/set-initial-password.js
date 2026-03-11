/**
 * POST /api/admin/set-initial-password
 * Body: { email, secret, newPassword }
 * Ainult kui parooli pole veel seatud; secret peab võrduma ADMIN_SECRET.
 */
import { isAdminEmail, getPasswordHash, setPassword, createJWT } from './_lib.js';

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
  const secret = body.secret;
  const newPassword = body.newPassword;

  if (!email || !isAdminEmail(email)) {
    return res.status(403).json({ error: 'Not an administrator' });
  }
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  const hash = await getPasswordHash();
  if (hash) {
    return res.status(400).json({ error: 'Password already set; use change-password' });
  }
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  await setPassword(String(newPassword));
  const token = createJWT(email);
  return res.status(200).json({ ok: true, token });
}
