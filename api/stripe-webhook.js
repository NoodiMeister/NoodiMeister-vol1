/**
 * Stripe webhook – checkout.session.completed.
 * Salvestab toetuse kehtivuse Vercel KV: support:<email> = ISO date (support_until).
 */
import Stripe from 'stripe';
import { kv } from '@vercel/kv';

const KEY_PREFIX = 'support:';
const KEY_SUPPORT_INDEX = 'support_index';
const PRICE_PER_MONTH = 5;
const DISCOUNT_12 = 55;

function addMonths(isoDate, months) {
  const d = new Date(isoDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !webhookSecret) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET missing');
    return res.status(500).end();
  }

  const rawBody = await readRawBody(req);
  let event;
  try {
    event = Stripe.webhooks.constructEvent(rawBody, req.headers['stripe-signature'], webhookSecret);
  } catch (e) {
    console.error('[stripe-webhook] signature verification failed', e?.message);
    return res.status(400).send('Webhook signature verification failed');
  }

  if (event.type !== 'checkout.session.completed') {
    return res.status(200).end();
  }

  const session = event.data.object;
  const email = (session.client_reference_id || session.customer_email || session.customer_details?.email || '').trim().toLowerCase();
  if (!email) {
    console.error('[stripe-webhook] no email in session');
    return res.status(200).end();
  }

  let months = parseInt(session.metadata?.months, 10);
  if (!Number.isFinite(months) || months < 1 || months > 60) {
    months = 1;
  }

  const today = new Date().toISOString().slice(0, 10);
  const newUntil = addMonths(today, months);

  try {
    const existing = await kv.get(KEY_PREFIX + email);
    const existingUntil = typeof existing === 'string' ? existing : null;
    const finalUntil = existingUntil && existingUntil > newUntil ? existingUntil : newUntil;
    await kv.set(KEY_PREFIX + email, finalUntil);
    let index = await kv.get(KEY_SUPPORT_INDEX);
    if (!Array.isArray(index)) index = [];
    if (!index.includes(email)) {
      index.push(email);
      await kv.set(KEY_SUPPORT_INDEX, index);
    }
  } catch (e) {
    console.error('[stripe-webhook] kv set failed', e?.message);
    return res.status(500).end();
  }

  return res.status(200).end();
}
