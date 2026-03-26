import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import LandingPage from '../pages/LandingPage';

/** Lineaarne crossfade: intro opacity 1→0 ja esileht 0→1 sama kestusega (t=50% mõlemad 0.5). */
export const INTRO_TO_LANDING_CROSSFADE_MS = 1000;

const IntroCrossfadeContext = createContext(null);

export function IntroCrossfadeProvider({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [crossfade, setCrossfade] = useState(null);

  const startCrossfade = useCallback((durationMs = INTRO_TO_LANDING_CROSSFADE_MS) => {
    setCrossfade({ durationMs });
  }, []);

  useEffect(() => {
    if (crossfade && location.pathname !== '/demo-intro') {
      setCrossfade(null);
    }
  }, [location.pathname, crossfade]);

  useEffect(() => {
    if (!crossfade) return undefined;
    const id = window.setTimeout(() => {
      navigate('/landing', { replace: true });
      setCrossfade(null);
    }, crossfade.durationMs);
    return () => window.clearTimeout(id);
  }, [crossfade, navigate]);

  const value = useMemo(() => ({ startCrossfade }), [startCrossfade]);

  return (
    <IntroCrossfadeContext.Provider value={value}>
      {crossfade ? (
        <div
          className="nm-intro-crossfade-underlay"
          style={{ '--nm-demo-crossfade-ms': `${crossfade.durationMs}ms` }}
          aria-hidden
        >
          <div className="nm-intro-crossfade-underlay__scroll">
            <div className="nm-landing--crossfade-in">
              <LandingPage />
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </IntroCrossfadeContext.Provider>
  );
}

export function useIntroCrossfade() {
  const ctx = useContext(IntroCrossfadeContext);
  if (!ctx) {
    throw new Error('useIntroCrossfade must be used within IntroCrossfadeProvider');
  }
  return ctx;
}
