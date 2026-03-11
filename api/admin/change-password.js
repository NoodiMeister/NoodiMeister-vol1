/**
 * POST /api/admin/change-password
 * Header: Authorization: Bearer <JWT>
 * Body: { currentPassword, newPassword }
 */
import { verifyJWT, isAdminEmail, updatePassword, createJWT } from './_lib.js';

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

  const token = req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const email = verifyJWT(token);
  if (!email || !isAdminEmail(email)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  const body = await parseBody(req);
  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword required' });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }

  const ok = await updatePassword(String(currentPassword), String(newPassword));
  if (!ok) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }
  const newToken = createJWT(email);
  return res.status(200).json({ ok: true, token: newToken });
}
