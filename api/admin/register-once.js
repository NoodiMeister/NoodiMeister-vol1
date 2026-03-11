/**
 * POST /api/admin/register-once
 * Ühekordne administraatori registreerimine. Ainult üks administraatori konto on lubatud.
 * Body: { secret, email, password }
 * secret peab võrduma ADMIN_SECRET. Pärast edukat registreerimist ei saa keegi teine enam registreeruda.
 */
import { kv } from '@vercel/kv';
import { getPasswordHash, setPassword } from './_lib.js';

const KEY_PRIMARY_EMAIL = 'admin_primary_email';

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
  const secret = body.secret;
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password;

  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    return res.status(500).json({ error: 'ADMIN_SECRET not configured' });
  }
  if (secret !== adminSecret) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  if (!password || String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const hash = await getPasswordHash();
  if (hash) {
    return res.status(400).json({ error: 'Administraator on juba registreeritud. Rohkem kontosid lisada ei saa.' });
  }

  try {
    await kv.set(KEY_PRIMARY_EMAIL, email);
    await setPassword(String(password));
    return res.status(200).json({ ok: true, email });
  } catch (e) {
    console.error('[admin/register-once]', e?.message);
    return res.status(500).json({ error: 'Storage error' });
  }
}
