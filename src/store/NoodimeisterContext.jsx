/**
 * Ühtne Store/Context süsteem – sisselogimine ja faili andmed säilivad.
 * Kõik moodulid suhtlevad läbi selle Contexti (auth, teema, praegune fail).
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as authStorage from '../services/authStorage';

const NoodimeisterContext = createContext(null);

export function useNoodimeister() {
  const ctx = useContext(NoodimeisterContext);
  if (!ctx) throw new Error('useNoodimeister must be used within NoodimeisterProvider');
  return ctx;
}

/** Optional: kui Contexti ei kasutata (nt. vana leht), tagastab null. */
export function useNoodimeisterOptional() {
  return useContext(NoodimeisterContext);
}

const STORAGE_KEY = 'noodimeister-data';
const THEME_STORAGE_KEY = 'noodimeister-theme';

/** Default: light. User must change color mode themselves (no system preference). */
function getStoredTheme() {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
    if (raw) {
      const o = JSON.parse(raw);
      return {
        mode: o.mode === 'dark' ? 'dark' : 'light',
        primaryColor: ['orange', 'blue', 'green'].includes(o.primaryColor) ? o.primaryColor : 'orange',
      };
    }
  } catch (_) { /* ignore */ }
  return { mode: 'light', primaryColor: 'orange' };
}

export function NoodimeisterProvider({ children }) {
  const [user, setUserState] = useState(() => authStorage.getLoggedInUser());
  const [theme, setThemeState] = useState(getStoredTheme);
  /** Praegune avatud fail (Google Drive id või null = uus töö). Kasutatakse salvestamise ja navigeerimise jaoks. */
  const [currentFileId, setCurrentFileId] = useState(null);
  const [currentFileName, setCurrentFileName] = useState('');

  const isLoggedIn = !!user?.email;

  /** Täisfunktsioon: sisselogitud kasutajatele. Makselahendus tuleb alles pärast esitlust. */
  const hasFullAccess = isLoggedIn;

  const setUser = useCallback((u) => {
    setUserState(u);
  }, []);

  const logout = useCallback(() => {
    authStorage.clearAuth();
    setUserState(null);
    setCurrentFileId(null);
    setCurrentFileName('');
  }, []);

  useEffect(() => {
    setUserState(authStorage.getLoggedInUser());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch (_) { /* ignore */ }
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.setAttribute('data-theme', theme.mode);
      document.documentElement.setAttribute('data-primary-color', theme.primaryColor);
    }
  }, [theme]);

  const setTheme = useCallback((mode, primaryColor) => {
    setThemeState((prev) => ({
      mode: mode ?? prev.mode,
      primaryColor: primaryColor ?? prev.primaryColor,
    }));
  }, []);

  /** Viimase salvestatud partituuri andmed (localStorage võti) – võimaldab taastamist ja sünkroniseerimist. */
  const getPersistedScoreKey = useCallback(() => STORAGE_KEY, []);

  const value = {
    user,
    setUser,
    isLoggedIn,
    hasFullAccess,
    logout,
    theme,
    setTheme,
    currentFileId,
    setCurrentFileId,
    currentFileName,
    setCurrentFileName,
    getPersistedScoreKey,
  };

  return (
    <NoodimeisterContext.Provider value={value}>
      {children}
    </NoodimeisterContext.Provider>
  );
}
