/**
 * Jagatud abifunktsioonid administraatori API-de jaoks.
 * Parooli räsiks crypto.scrypt; JWT allkiri HMAC-SHA256.
 */
import crypto from 'crypto';
import { kv } from '@vercel/kv';

const KEY_HASH = 'admin_password_hash';
const KEY_SALT = 'admin_password_salt';
const KEY_CHANGED_AT = 'admin_password_changed_at';
const SCRIPT_LEN = 64;
const SALT_LEN = 32;
const JWT_EXPIRY_HOURS = 8;
const PASSWORD_CHANGE_MONTHS = 3;

export function getAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isAdminEmail(email) {
  const e = String(email).trim().toLowerCase();
  return getAdminEmails().includes(e);
}

export async function getPasswordHash() {
  return kv.get(KEY_HASH);
}

export async function getPasswordSalt() {
  return kv.get(KEY_SALT);
}

export async function getPasswordChangedAt() {
  return kv.get(KEY_CHANGED_AT);
}

export async function setPassword(password) {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.scryptSync(password, salt, SCRIPT_LEN);
  await kv.set(KEY_HASH, hash.toString('base64'));
  await kv.set(KEY_SALT, salt.toString('base64'));
  const now = new Date().toISOString().slice(0, 10);
  await kv.set(KEY_CHANGED_AT, now);
}

export function verifyPassword(password, storedHashB64, storedSaltB64) {
  if (!storedHashB64 || !storedSaltB64) return false;
  const salt = Buffer.from(storedSaltB64, 'base64');
  const hash = crypto.scryptSync(password, salt, SCRIPT_LEN);
  const stored = Buffer.from(storedHashB64, 'base64');
  return hash.length === stored.length && crypto.timingSafeEqual(hash, stored);
}

export async function updatePassword(currentPassword, newPassword) {
  const hash = await getPasswordHash();
  const salt = await getPasswordSalt();
  if (!verifyPassword(currentPassword, hash, salt)) return false;
  await setPassword(newPassword);
  return true;
}

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64');
}

export function createJWT(email) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return null;
  const exp = Math.floor(Date.now() / 1000) + JWT_EXPIRY_HOURS * 3600;
  const payload = { email: email.toLowerCase(), exp };
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(sig);
  return `${payloadB64}.${sigB64}`;
}

export function verifyJWT(token) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || !token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const sig = crypto.createHmac('sha256', secret).update(parts[0]).digest();
    const sigB64 = base64UrlEncode(sig);
    if (sigB64 !== parts[1]) return null;
    const payload = JSON.parse(base64UrlDecode(parts[0]).toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.email || null;
  } catch {
    return null;
  }
}

export async function adminStatus(email) {
  const allowed = isAdminEmail(email);
  const hash = await getPasswordHash();
  const hasPasswordSet = !!hash;
  const changedAt = await getPasswordChangedAt();
  let mustChangePassword = false;
  if (hasPasswordSet && changedAt) {
    const d = new Date(changedAt);
    d.setMonth(d.getMonth() + PASSWORD_CHANGE_MONTHS);
    mustChangePassword = new Date() >= d;
  }
  return { allowed, hasPasswordSet, mustChangePassword };
}

export const PASSWORD_CHANGE_MONTHS_EXPORT = PASSWORD_CHANGE_MONTHS;
