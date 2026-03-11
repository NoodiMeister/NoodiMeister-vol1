/**
 * Administraatori endpoint: anna täisfunktsioon (toetus) konkreetsetele e-mailidele.
 * Autentimine: X-Admin-Secret (ADMIN_SECRET) VÕI Authorization: Bearer <JWT> (pärast parooli sisestamist).
 */
import { kv } from '@vercel/kv';
import { verifyJWT, isAdminEmailAsync } from './_lib.js';

const KEY_PREFIX = 'support:';
const NOTE_PREFIX = 'support_note:';
const KEY_SUPPORT_INDEX = 'support_index';

function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

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

  const body = await parseBody(req);
  let emails = body.emails;
  if (Array.isArray(emails)) {
    emails = emails.map((e) => normalizeEmail(e)).filter((e) => e && e.includes('@'));
  } else if (typeof emails === 'string') {
    emails = emails.split(/[\n,;]+/).map((e) => normalizeEmail(e)).filter((e) => e && e.includes('@'));
  } else {
    return res.status(400).json({ error: 'emails required (array or string)' });
  }

  if (emails.length === 0) {
    return res.status(400).json({ error: 'At least one valid email required' });
  }

  const supportUntil = typeof body.supportUntil === 'string' ? body.supportUntil.trim() : '';
  const dateMatch = supportUntil.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return res.status(400).json({ error: 'supportUntil required (YYYY-MM-DD)' });
  }
  const [, y, m, d] = dateMatch;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (isNaN(date.getTime())) {
    return res.status(400).json({ error: 'Invalid date' });
  }
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  try {
    let index = await kv.get(KEY_SUPPORT_INDEX);
    if (!Array.isArray(index)) index = [];
    const indexSet = new Set(index.map((e) => String(e).trim().toLowerCase()).filter((e) => e));
    for (const email of emails) {
      await kv.set(KEY_PREFIX + email, supportUntil);
      if (note) await kv.set(NOTE_PREFIX + email, note);
      indexSet.add(email);
    }
    await kv.set(KEY_SUPPORT_INDEX, [...indexSet]);
    return res.status(200).json({
      ok: true,
      granted: emails.length,
      supportUntil,
      emails,
    });
  } catch (e) {
    console.error('[admin/grant-support]', e?.message);
    return res.status(500).json({ error: 'Storage error' });
  }
}
