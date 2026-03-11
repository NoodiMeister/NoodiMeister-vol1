/**
 * GET /api/admin/registration-status
 * Tagastab: { alreadyDone, adminEmail? }
 * alreadyDone = true kui administraator on juba ühekordselt registreeritud (rohkem registreerimist ei saa).
 */
import { kv } from '@vercel/kv';
import { getPasswordHash } from './_lib.js';

const KEY_PRIMARY_EMAIL = 'admin_primary_email';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const hash = await getPasswordHash();
    const alreadyDone = !!hash;
    let adminEmail = null;
    if (alreadyDone) {
      const primary = await kv.get(KEY_PRIMARY_EMAIL);
      if (primary && typeof primary === 'string') adminEmail = primary.trim();
    }
    return res.status(200).json({ alreadyDone, adminEmail });
  } catch (e) {
    console.error('[admin/registration-status]', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
