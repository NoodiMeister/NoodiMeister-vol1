/**
 * Sisselogimisejärgne vaade: Minu tööd (failide nimekiri, uue töö loomine, avamine).
 * Kõik moodulid suhtlevad läbi Store/Contexti – sisselogimine säilib.
 */
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNoodimeisterOptional } from '../store/NoodimeisterContext';
import * as authStorage from '../services/authStorage';
import MinuTöödPage from '../pages/MinuTöödPage';

export default function UserDashboard() {
  const navigate = useNavigate();
  const store = useNoodimeisterOptional();

  // Pärast sisselogimist (redirect /tood) uuenda store authStorageist enne redirecti kontrolli
  useEffect(() => {
    if (store) {
      const user = authStorage.getLoggedInUser();
      if (user?.email) store.setUser(user);
    }
  }, [store]);

  // Kas sisselogitud (store või authStorage)
  const userFromStorage = authStorage.getLoggedInUser();
  const isLoggedIn = store ? (store.user?.email || userFromStorage?.email) : userFromStorage?.email;

  // Redirect only in effect to avoid navigate()-during-render (can freeze the page / break buttons)
  useEffect(() => {
    if (store && !isLoggedIn) navigate('/login', { replace: true });
  }, [store, isLoggedIn, navigate]);

  if (store && !isLoggedIn) return null;

  return <MinuTöödPage />;
}
