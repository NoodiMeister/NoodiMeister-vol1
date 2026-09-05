/** Ainult sisselogimine / registreerimine — brändi kinnitus piisab. */
export const GOOGLE_SCOPE_IDENTITY = 'openid email profile';

/** Drive kirjutamine + Drive UI. Sensitive (mitte restricted readonly). */
export const GOOGLE_DRIVE_FILE_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.install';

/** Identiteet + Drive, kui küsitakse pilveluba (incremental / teine nõusolek). */
export const GOOGLE_SCOPE_DRIVE = `${GOOGLE_SCOPE_IDENTITY} ${GOOGLE_DRIVE_FILE_SCOPES}`;

/** @deprecated Kasuta GOOGLE_SCOPE_DRIVE — enam ei küsita drive.readonly. */
export const GOOGLE_SCOPE_READ = GOOGLE_SCOPE_DRIVE;

export const GOOGLE_SCOPE_WRITE = GOOGLE_SCOPE_DRIVE;
