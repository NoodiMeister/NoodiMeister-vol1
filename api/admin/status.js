/**
 * GET /api/admin/status?email=...
 * Tagastab: { allowed, hasPasswordSet, mustChangePassword }
 */
import { adminStatus } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const email = (req.query?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }
  try {
    const status = await adminStatus(email);
    return res.status(200).json(status);
  } catch (e) {
    console.error('[admin/status]', e?.message);
    return res.status(500).json({ error: 'Server error' });
  }
}
