/**
 * Taktimõõtude tööriistakast: visuaalsed sümbolid (klassikaline ja pedagoogiline režiim).
 */
import React from 'react';

export function MeterIcon({ beats, beatUnit }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <text x="12" y="10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      <text x="12" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beatUnit}</text>
    </svg>
  );
}

/** Pedagoogiline taktimõõt – nimetaja kuvatakse noodi sümbolina. */
export function PedagogicalMeterIcon({ beats, beatUnit }) {
  function getNoteSymbol() {
    switch (beatUnit) {
      case 1:
        return <ellipse cx="12" cy="18" rx="4" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1"/>;
      case 2:
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="none" stroke="currentColor" strokeWidth="1"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
          </>
        );
      case 4:
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
          </>
        );
      case 8:
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
            <path d="M15 24 Q18 23 15 21" fill="currentColor"/>
          </>
        );
      case 16:
        return (
          <>
            <ellipse cx="12" cy="18" rx="3" ry="2" fill="currentColor"/>
            <line x1="15" y1="18" x2="15" y2="24" stroke="currentColor" strokeWidth="1"/>
            <path d="M15 24 Q18 23 15 21 M15 22 Q18 21 15 19" fill="currentColor"/>
          </>
        );
      default:
        return <text x="12" y="21" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beatUnit}</text>;
    }
  }
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5">
      <text x="12" y="10" textAnchor="middle" fontSize="10" fontWeight="bold" fill="currentColor">{beats}</text>
      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.5"/>
      {getNoteSymbol()}
    </svg>
  );
}
