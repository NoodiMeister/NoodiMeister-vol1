/**
 * Verceli /api/auth/* — kohalik e-post+parool sünk ja parooli taastamine.
 * Kohalikus dev-is peab olema kas NM_DEV_API_PROXY (vite) või vercel dev.
 */

async function postAuth(path, json) {
  const r = await fetch(`/api/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(json),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

/** Esimene registreerimine: loo serveripoolne räsi (parooli taastamiseks). */
export async function syncLocalAccountToServer({ email, password, name }) {
  try {
    return await postAuth('sync-local-account', { email, password, name });
  } catch {
    return { ok: false, status: 0, data: {}, networkError: true };
  }
}

/** Sisselogimine: server on tõde, kui kirje KV-s on. */
export async function verifyLocalLoginOnServer(email, password) {
  try {
    return await postAuth('verify-local-login', { email, password });
  } catch {
    return { ok: false, status: 0, data: {}, networkError: true };
  }
}

export async function requestPasswordReset(email) {
  try {
    return await postAuth('request-password-reset', { email });
  } catch {
    return { ok: false, status: 0, data: {}, networkError: true };
  }
}

export async function resetPasswordWithToken(token, newPassword) {
  try {
    return await postAuth('reset-password', { token, newPassword });
  } catch {
    return { ok: false, status: 0, data: {}, networkError: true };
  }
}
