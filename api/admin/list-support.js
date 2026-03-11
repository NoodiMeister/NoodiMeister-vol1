/**
 * GET /api/admin/list-support
 * Tagastab kõik toetuse saanud kontod (e-mail, supportUntil, note).
 * Autentimine: Authorization: Bearer <JWT> või X-Admin-Secret.
 */
import { kv } from '@vercel/kv';
import { verifyJWT, isAdminEmailAsync } from './_lib.js';

const KEY_PREFIX = 'support:';
const NOTE_PREFIX = 'support_note:';
const KEY_SUPPORT_INDEX = 'support_index';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.ADMIN_SECRET;
  const bearer = req.headers['authorization']?.replace(/^Bearer\s+/i, '');
  const adminHeader = req.headers['x-admin-secret'];

  let authorized = false;
  if (bearer) {
    const email = verifyJWT(bearer);
    if (email && (await isAdminEmailAsync(email))) authorized = true;
  }
  if (!authorized && secret && adminHeader === secret) authorized = true;
  if (!authorized) {
    return res.status(401).json({ error: 'Invalid or missing admin authentication' });
  }

  try {
    let index = await kv.get(KEY_SUPPORT_INDEX);
    if (!Array.isArray(index)) index = [];
    const list = [];
    for (const email of index) {
      const e = String(email).trim().toLowerCase();
      if (!e) continue;
      const supportUntil = await kv.get(KEY_PREFIX + e);
      const note = await kv.get(NOTE_PREFIX + e);
      list.push({
        email: e,
        supportUntil: typeof supportUntil === 'string' ? supportUntil : null,
        note: typeof note === 'string' ? note : null,
      });
    }
    list.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    return res.status(200).json({ list });
  } catch (e) {
    console.error('[admin/list-support]', e?.message);
    return res.status(500).json({ error: 'Storage error' });
  }
}
