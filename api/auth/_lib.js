/**
 * Kohaliku e-post+parool konto serveripool: KV võtmed, scrypt räsi, rate limit, Resend.
 */
import crypto from 'crypto';
import { kv } from '@vercel/kv';

export const PREFIX_USER = 'nm:auth:local:';
export const PREFIX_RESET = 'nm:auth:pwreset:';
export const PREFIX_RL_RESET = 'nm:auth:rl:reset:';
export const PREFIX_RL_SYNC = 'nm:auth:rl:sync:';

const SCRIPT_LEN = 64;
const SALT_LEN = 32;
const RESET_TTL_SEC = 60 * 60;
const RL_WINDOW_SEC = 60 * 60;
const RL_MAX_RESET_PER_EMAIL = 5;
const RL_MAX_SYNC_PER_IP = 30;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(String(password), salt, SCRIPT_LEN);
  return { hashB64: hash.toString('base64'), saltB64: salt.toString('base64') };
}

export function verifyPasswordScrypt(password, hashB64, saltB64) {
  if (!hashB64 || !saltB64) return false;
  try {
    const salt = Buffer.from(saltB64, 'base64');
    const hash = crypto.scryptSync(String(password), salt, SCRIPT_LEN);
    const stored = Buffer.from(hashB64, 'base64');
    return hash.length === stored.length && crypto.timingSafeEqual(hash, stored);
  } catch {
    return false;
  }
}

export async function getUserRecord(email) {
  const e = normalizeEmail(email);
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return kv.get(PREFIX_USER + e);
}

export async function setUserRecord(email, record) {
  const e = normalizeEmail(email);
  if (!e) return;
  await kv.set(PREFIX_USER + e, record);
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}

export async function setResetToken(plainToken, email) {
  const key = PREFIX_RESET + hashResetToken(plainToken);
  const exp = Date.now() + RESET_TTL_SEC * 1000;
  await kv.set(key, { email: normalizeEmail(email), exp }, { ex: RESET_TTL_SEC });
}

export async function consumeResetToken(plainToken) {
  const key = PREFIX_RESET + hashResetToken(plainToken);
  const data = await kv.get(key);
  await kv.del(key);
  if (!data || !data.email) return null;
  if (data.exp && Date.now() > data.exp) return null;
  return normalizeEmail(data.email);
}

export async function rateLimitReset(email) {
  const e = normalizeEmail(email);
  const k = PREFIX_RL_RESET + e;
  const n = await kv.incr(k);
  if (n === 1) await kv.expire(k, RL_WINDOW_SEC);
  return n <= RL_MAX_RESET_PER_EMAIL;
}

export async function rateLimitSync(ip) {
  const safe = String(ip || 'x').replace(/[^a-z0-9.:_-]/gi, '_').slice(0, 80);
  const k = PREFIX_RL_SYNC + safe;
  const n = await kv.incr(k);
  if (n === 1) await kv.expire(k, RL_WINDOW_SEC);
  return n <= RL_MAX_SYNC_PER_IP;
}

export function getClientIp(req) {
  const xf = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (xf) return xf;
  return req.socket?.remoteAddress || 'unknown';
}

export function getPublicSiteUrl() {
  const explicit = (process.env.NM_PUBLIC_SITE_URL || '').trim().replace(/\/$/, '');
  if (explicit) return explicit;
  const v = (process.env.VERCEL_URL || '').trim();
  if (v) return `https://${v.replace(/^https?:\/\//, '')}`;
  return 'http://localhost:5197';
}

export async function sendPasswordResetEmail(toEmail, plainToken) {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) {
    console.error('[auth] RESEND_API_KEY puudub — taastamiskirja ei saadeta.');
    return { ok: false, reason: 'no_mailer' };
  }
  const from = (process.env.RESEND_FROM || '').trim() || 'Noodimeister <onboarding@resend.dev>';
  const base = getPublicSiteUrl();
  const link = `${base}/parool/uus?token=${encodeURIComponent(plainToken)}`;
  const subject = 'Noodimeister — parooli taastamine';
  const html = `
    <p>Tere,</p>
    <p>Said taotluse Noodimeistri konto parooli taastamiseks. Kui see olid sina, ava allolev link (kehtib umbes 1 tund):</p>
    <p><a href="${link}">${link}</a></p>
    <p>Kui sa ei taotlenud taastamist, ignoreeri seda kirja.</p>
    <p>— Noodimeister</p>
  `.trim();

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to: [toEmail], subject, html }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    console.error('[auth] Resend error', r.status, t);
    return { ok: false, reason: 'resend', status: r.status };
  }
  return { ok: true };
}

export async function parseJsonBody(req) {
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
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}
