/**
 * Sisselogimisejärgne vaade: Minu tööd (failide nimekiri, uue töö loomine, avamine).
 * Kõik moodulid suhtlevad läbi Store/Contexti – sisselogimine säilib.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import * as authStorage from '../services/authStorage';
import MinuTöödPage from '../pages/MinuTöödPage';

export default function UserDashboard() {
  const navigate = useNavigate();
  const store = useNoodimeisterOptional();
  const [showWelcome, setShowWelcome] = useState(false);

  // Pärast sisselogimist (redirect /tood) uuenda store authStorageist enne redirecti kontrolli
  useEffect(() => {
    if (store) {
      const user = authStorage.getLoggedInUser();
      if (user?.email) store.setUser(user);
    }
  }, [store]);

  // Tere tulemast / õnnestumise teade pärast sisselogimist või registreerumist
  useEffect(() => {
    try {
      if (sessionStorage.getItem('noodimeister-show-welcome') === '1') {
        sessionStorage.removeItem('noodimeister-show-welcome');
        setShowWelcome(true);
      }
    } catch (_) {}
  }, []);

  // Kas sisselogitud (store või authStorage)
  const userFromStorage = authStorage.getLoggedInUser();
  const isLoggedIn = store ? (store.user?.email || userFromStorage?.email) : userFromStorage?.email;

  // Redirect only in effect to avoid navigate()-during-render (can freeze the page / break buttons)
  useEffect(() => {
    if (store && !isLoggedIn) navigate('/login', { replace: true });
  }, [store, isLoggedIn, navigate]);

  if (store && !isLoggedIn) return null;

  return (
    <>
      {showWelcome && (
        <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-3">
          <div className="flex items-center gap-3 rounded-xl bg-emerald-600 text-white shadow-lg border border-emerald-700 px-4 py-3 max-w-md">
            <CheckCircle2 className="w-6 h-6 flex-shrink-0" aria-hidden />
            <p className="font-medium text-sm sm:text-base">Tere tulemast! Oled sisse logitud.</p>
            <button
              type="button"
              onClick={() => setShowWelcome(false)}
              className="ml-1 p-1 rounded-lg hover:bg-emerald-500/80 transition-colors"
              aria-label="Sulge"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      <MinuTöödPage />
    </>
  );
}
