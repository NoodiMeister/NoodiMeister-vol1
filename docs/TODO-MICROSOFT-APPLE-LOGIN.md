# Tomorrow: Microsoft & Apple login (like Google)

Quick handoff so you can continue where you left off.

## Current state

- **Google** works end-to-end in `src/components/CloudLogin.jsx`:
  - Uses `@react-oauth/google` → `useGoogleLogin` with scope `email profile https://www.googleapis.com/auth/drive`
  - On success: gets access token → fetches `https://www.googleapis.com/oauth2/v3/userinfo` → builds `user = { email, name, provider: 'google' }`
  - Saves to storage: `noodimeister-logged-in` (user), `noodimeister-google-token`, `noodimeister-google-token-expiry`
  - Same flow supports both **login** and **register** (register also adds to `noodimeister-users`)
  - Google token is then used for **Google Drive** in `src/services/googleDrive.js`

- **Microsoft** and **Apple** buttons are in the same component; they only show an alert:
  - `handleMicrosoftClick` → alert "Microsofti sisselogimine tuleb tulevikus..."
  - `handleAppleClick` → alert "Apple sisselogimine tuleb tulevikus..."

## What to do (same pattern as Google)

### 1. Microsoft

- **Auth**: Use Microsoft OAuth (e.g. [@azure/msal-browser](https://www.npmjs.com/package/@azure/msal-browser) or [react-aad-msal](https://www.npmjs.com/package/react-aad-msal), or [Microsoft identity platform docs](https://learn.microsoft.com/en-us/entra/identity-platform/)).
- **Config**: Add env vars (e.g. `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID` or redirect URI) in `.env` and `.env.example`.
- **Flow**: On success → get access token → call Microsoft Graph `https://graph.microsoft.com/v1.0/me` (or `/userinfo`) → get `email` and display name → **tester check:** if `getMicrosoftTesterEmails()` (in CloudLogin.jsx) returns a non-empty array, only allow login when `profile.email` is in that list; otherwise show a friendly message and don’t save session. Then build `user = { email, name, provider: 'microsoft' }` → save to same storage keys (`noodimeister-logged-in`, optionally a Microsoft token key if you add OneDrive later). **Tester list:** `.env` / `.env.example` has `VITE_MICROSOFT_TESTER_EMAILS=raido.lill@paikesekool.parnu.ee` (add more comma-separated as needed).
- **Optional later**: OneDrive save/load (like `googleDrive.js`) using the same token.

### 2. Apple

- **Auth**: Use [Sign in with Apple](https://developer.apple.com/sign-in-with-apple/) (JS flow; often via a backend or a lib that wraps the Apple JS SDK).
- **Config**: Apple Developer account, Service ID, and client/redirect config; add e.g. `VITE_APPLE_CLIENT_ID`, `VITE_APPLE_REDIRECT_URI` in `.env.example`.
- **Flow**: On success → get token/id_token → decode or call Apple’s user endpoint → get email (and name on first sign-in only) → build `user = { email, name, provider: 'apple' }` → save to same storage keys.
- **Note**: Apple often requires a backend to exchange the auth code for tokens; check their current docs for pure front-end options.

### 3. Shared plumbing (already there)

- **Storage**: `src/services/authStorage.js` — `getStorageForLogin`, `getStorageForRead`, `getLoggedInUser`, `isLoggedIn`, `clearAuth`. For multiple providers you may add `KEY_MICROSOFT_TOKEN`, `KEY_APPLE_*` if you need provider-specific tokens (e.g. OneDrive).
- **CloudLogin**: Reuse the same post-login steps: `canUseStorageForLogin(stayLoggedIn)`, `getStorageForLogin(stayLoggedIn)`, write user to `KEY_LOGGED_IN`, then `redirectToTood()`. For register mode, append to `noodimeister-users` like Google.
- **Error handling**: Use existing `formatAuthError()` and `onError` callback so errors show consistently.

## Files to touch

| File | Purpose |
|------|--------|
| `src/components/CloudLogin.jsx` | Replace Microsoft/Apple alerts with real OAuth flows; add hooks/callbacks similar to `useGoogleLogin`. |
| `src/services/authStorage.js` | Optionally add keys for Microsoft/Apple tokens (if you add OneDrive or other API use). |
| `.env.example` | Document `VITE_MICROSOFT_*` and `VITE_APPLE_*` (and any backend URL if needed for Apple). |
| `package.json` | Add Microsoft/Apple auth dependencies if you use new packages. |

## Quick test

After implementing:

- **Register**: Click “Registreeru” → use “Microsoft” or “Apple” → should end up logged in and redirected to `/tood`, with user in storage.
- **Login**: Log out, then “Logi sisse” → same provider → same result.
- **Minu tööd**: `/tood` should show the same “Minu tööd” experience (Google Drive list is separate; OneDrive can be added later).

You’re set to add Microsoft and Apple login using the same pattern as the Google Drive example.
