import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { User, Cloud, HardDrive, LogIn } from 'lucide-react';
import { getLoggedInUser, getStoredTokenFromAuth, getStoredMicrosoftTokenFromAuth } from '../services/authStorage';
import { getOneDriveProfile, listNoodimeisterFilesFromOneDrive } from '../services/oneDrive';

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [googleToken, setGoogleToken] = useState(null);
  const [microsoftToken, setMicrosoftToken] = useState(null);
  const [oneDriveProfile, setOneDriveProfile] = useState({ state: 'idle', data: null, error: null });
  const [oneDriveFiles, setOneDriveFiles] = useState({ state: 'idle', data: [], error: null });

  useEffect(() => {
    try {
      setUser(getLoggedInUser());
    } catch {
      setUser(null);
    }
    try {
      setGoogleToken(getStoredTokenFromAuth());
    } catch {
      setGoogleToken(null);
    }
    try {
      setMicrosoftToken(getStoredMicrosoftTokenFromAuth());
    } catch {
      setMicrosoftToken(null);
    }
  }, []);

  useEffect(() => {
    if (!microsoftToken) {
      setOneDriveProfile({ state: 'idle', data: null, error: null });
      setOneDriveFiles({ state: 'idle', data: [], error: null });
      return;
    }
    let cancelled = false;
    (async () => {
      setOneDriveProfile({ state: 'loading', data: null, error: null });
      const profile = await getOneDriveProfile(microsoftToken);
      if (cancelled) return;
      if (!profile.ok) {
        setOneDriveProfile({ state: 'error', data: null, error: profile.error });
      } else {
        setOneDriveProfile({ state: 'success', data: profile, error: null });
      }

      setOneDriveFiles({ state: 'loading', data: [], error: null });
      const files = await listNoodimeisterFilesFromOneDrive(microsoftToken);
      if (cancelled) return;
      if (!files.ok) {
        setOneDriveFiles({ state: 'error', data: [], error: files.error });
      } else {
        setOneDriveFiles({ state: 'success', data: files.files, error: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [microsoftToken]);

  const providerLabel =
    user?.provider === 'google'
      ? 'Google'
      : user?.provider === 'microsoft'
      ? 'Microsoft (OneDrive)'
      : 'E-mail / muu';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      <header className="flex-shrink-0 border-b border-amber-200/60 bg-white/70 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <img src="/logo.png" alt="NoodiMeister" className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/tood" className="text-amber-700 hover:text-amber-900 font-medium">
              Minu tööd
            </Link>
            <Link to="/" className="text-amber-700 hover:text-amber-900 font-medium">
              Esileht
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border-2 border-amber-200 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white px-8 py-6 flex items-center gap-3">
            <User className="w-6 h-6" />
            <div>
              <h1 className="text-2xl font-bold" style={{ fontFamily: 'Georgia, serif' }}>
                Minu konto
              </h1>
              <p className="text-slate-200 text-sm mt-1">
                Vaata, kuhu NoodiMeister saab sinu faile salvestada ja kust neid lugeda (kohalik fail, Google Drive, OneDrive).
              </p>
            </div>
          </div>

          <div className="p-8 space-y-6">
            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <User className="w-5 h-5 text-amber-700" /> Kasutaja
              </h2>
              {user ? (
                <div className="text-sm text-amber-800 space-y-1">
                  <p>
                    <span className="font-semibold">E-mail:</span> {user.email}
                  </p>
                  <p>
                    <span className="font-semibold">Nimi:</span> {user.name || '—'}
                  </p>
                  <p>
                    <span className="font-semibold">Sisselogimise viis:</span> {providerLabel}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-amber-800 flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> Pole sisse logitud.{' '}
                  <Link to="/login" className="underline font-medium text-amber-800 hover:text-amber-900">
                    Logi sisse
                  </Link>
                  .
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-amber-700" /> Kohalik fail
              </h2>
              <p className="text-sm text-amber-800">
                NoodiMeister saab alati salvestada faili sinu arvutisse (ilma kontota). See töötab sõltumata Google'ist või Microsoftist.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-sky-600" /> Google Drive
              </h2>
              {googleToken ? (
                <p className="text-sm text-amber-800">
                  Oled andnud loa Google Drive'i jaoks. Minu tööde vaates saad näha ja avada oma Google Drive'i NoodiMeisteri faile.
                </p>
              ) : (
                <p className="text-sm text-amber-800">
                  Google Drive'i pole veel ühendatud. Logi sisse Google'i nupuga, et salvestada ja laadida faile Google Drive'i.
                </p>
              )}
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-semibold text-amber-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-700" /> OneDrive (Microsoft)
              </h2>
              {!microsoftToken && (
                <p className="text-sm text-amber-800">
                  Microsofti konto pole veel ühendatud. Logi sisse Microsofti nupuga (login/registreeru), et lubada OneDrive'i kasutamine.
                </p>
              )}
              {microsoftToken && (
                <div className="space-y-3 text-sm text-amber-800">
                  {oneDriveProfile.state === 'loading' && <p>Laen Microsofti profiili…</p>}
                  {oneDriveProfile.state === 'error' && (
                    <p className="text-red-700">
                      Profiili lugemine ebaõnnestus: {oneDriveProfile.error}
                    </p>
                  )}
                  {oneDriveProfile.state === 'success' && oneDriveProfile.data && (
                    <div className="border border-amber-200 rounded-lg p-3 bg-amber-50/70">
                      <p>
                        <span className="font-semibold">OneDrive'i konto:</span>{' '}
                        {oneDriveProfile.data.displayName || oneDriveProfile.data.mail || '—'}
                      </p>
                    </div>
                  )}

                  {oneDriveFiles.state === 'loading' && <p>Laen OneDrive'i NoodiMeisteri faile…</p>}
                  {oneDriveFiles.state === 'error' && (
                    <p className="text-red-700">
                      OneDrive'i failide lugemine ebaõnnestus: {oneDriveFiles.error}
                    </p>
                  )}
                  {oneDriveFiles.state === 'success' && (
                    <>
                      {oneDriveFiles.data.length === 0 ? (
                        <p className="text-sm text-amber-800">
                          OneDrive'is ei leitud veel ühtegi NoodiMeisteri faili (nimi sisaldab ".noodimeister"). Tulevikus saad siit neid salvestada ja laadida.
                        </p>
                      ) : (
                        <div className="space-y-1">
                          <p className="font-semibold text-amber-900">NoodiMeisteri failid OneDrive'is:</p>
                          <ul className="max-h-40 overflow-y-auto text-sm list-disc list-inside">
                            {oneDriveFiles.data.map((f) => (
                              <li key={f.id}>
                                {f.name}{' '}
                                {f.webUrl && (
                                  <a
                                    href={f.webUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-sky-700 underline ml-1"
                                  >
                                    Ava OneDrive'is
                                  </a>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-xs text-amber-700/80">
                    Märkus: praegu on OneDrive'i tugi lugemise vaates. Salvestamise/üleslaadimise nupud lisame hiljem (sarnaselt Google Drive'ile).
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

