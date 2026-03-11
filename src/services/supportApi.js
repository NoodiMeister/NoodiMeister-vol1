/**
 * Toetuse API: Stripe Checkout loomine ja toetuse staatuse lugemine.
 * Base URL tuleb keskkonnamuutujast või sama origin.
 */

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}

/**
 * Loob Stripe Checkout Session ja tagastab suunamise URLi.
 * @param {number} months - kuude arv (1–60)
 * @param {string} email - kasutaja e-mail
 * @returns {Promise<{ url: string } | { error: string }>}
 */
export async function createCheckoutSession(months, email) {
  const base = getApiBase();
  if (!base) return { error: 'API base URL not configured' };

  const res = await fetch(`${base}/api/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ months, email }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error || res.statusText || 'Request failed' };
  if (data.url) return { url: data.url };
  return { error: data.error || 'No checkout URL' };
}

/**
 * Küsib toetuse kehtivuse e-maili järgi.
 * @param {string} email
 * @returns {Promise<{ supportUntil: string | null }>}
 */
export async function getSupportStatus(email) {
  const base = getApiBase();
  if (!base || !email) return { supportUntil: null };

  try {
    const res = await fetch(`${base}/api/support-status?email=${encodeURIComponent(email)}`, {
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    return { supportUntil: data.supportUntil ?? null };
  } catch {
    return { supportUntil: null };
  }
}
