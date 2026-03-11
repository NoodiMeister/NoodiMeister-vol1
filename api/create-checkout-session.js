/**
 * Stripe Checkout Session – toetuse ühekordne makse.
 * POST body: { months: number, email: string }
 * Tagastab: { url: string } (Stripe Checkout URL) või { error: string }
 */
import Stripe from 'stripe';

const PRICE_PER_MONTH_EUR = 5;
const DISCOUNT_12_MONTHS_EUR = 55;

function amountCents(months) {
  if (months === 12) return DISCOUNT_12_MONTHS_EUR * 100;
  return Math.max(1, Math.min(60, months)) * PRICE_PER_MONTH_EUR * 100;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' });
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-11-20.acacia' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const months = typeof body.months === 'number' ? body.months : parseInt(body.months, 10);
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (!Number.isFinite(months) || months < 1 || months > 60) {
    return res.status(400).json({ error: 'months must be 1–60' });
  }
  if (!email) {
    return res.status(400).json({ error: 'email required' });
  }

  const origin = req.headers.origin || req.headers.referer?.replace(/\/$/, '') || 'https://noodimeister.ee';
  const successUrl = `${origin}/toeta?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/toeta?canceled=1`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      client_reference_id: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: {
              name: `NoodiMeister – toetus ${months} ${months === 1 ? 'kuu' : 'kuud'}`,
              description: `Täisfunktsioon ${months} kuud. Toetad NoodiMeistri arendust.`,
            },
            unit_amount: amountCents(months),
          },
        },
      ],
      metadata: { months: String(months) },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('[create-checkout-session]', e?.message);
    return res.status(500).json({ error: e?.message || 'Stripe error' });
  }
}
