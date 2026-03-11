/**
 * Toetuse kehtivus e-maili järgi.
 * GET /api/support-status?email=...
 * Tagastab: { supportUntil: "YYYY-MM-DD" | null }
 */
import { kv } from '@vercel/kv';

const KEY_PREFIX = 'support:';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = (req.query?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'email query required' });
  }

  try {
    const stored = await kv.get(KEY_PREFIX + email);
    const supportUntil = typeof stored === 'string' ? stored : null;
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).json({ supportUntil });
  } catch (e) {
    console.error('[support-status]', e?.message);
    return res.status(500).json({ error: 'Storage error', supportUntil: null });
  }
}
