import { PublicClientApplication } from '@azure/msal-browser';
import { getMicrosoftRedirectUri } from '../utils/microsoftRedirectUri';

const clientId = String((typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_CLIENT_ID) || '').trim();
const tenantId = String((typeof import.meta !== 'undefined' && import.meta.env?.VITE_MICROSOFT_TENANT_ID) || 'common').trim() || 'common';

let pcaPromise = null;

/**
 * Üks MSAL PublicClientApplication kogu rakenduses (CloudLogin, redirect tagasitulek, token refresh).
 * Kasutame npm @azure/msal-browser — ei sõltu alcdn.msauth.net CDN-ist (mõnikord blokeeritud).
 */
export async function getMsalPublicClientApplication() {
  if (typeof window === 'undefined') return null;
  if (!clientId) return null;
  if (!pcaPromise) {
    pcaPromise = (async () => {
      const redirectUri = getMicrosoftRedirectUri();
      const authority = `https://login.microsoftonline.com/${encodeURIComponent(tenantId || 'common')}`;
      const instance = new PublicClientApplication({
        auth: {
          clientId,
          authority,
          redirectUri,
        },
        cache: {
          cacheLocation: 'localStorage',
          storeAuthStateInCookie: false,
        },
      });
      await instance.initialize();
      return instance;
    })();
  }
  try {
    return await pcaPromise;
  } catch (e) {
    pcaPromise = null;
    throw e;
  }
}
