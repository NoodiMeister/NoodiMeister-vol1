import React from 'react';

/**
 * Lazy load with retry: kui chunk ei laadi (nt pärast uut deployi vana URLiga),
 * tehakse üks täislehe taaskoormus, et kasutaja saaks uue versiooni.
 * Vältib "Failed to fetch dynamically imported module" ekraani.
 */
const CHUNK_RETRY_KEY = 'nm_chunk_reload_retry';

function isChunkLoadError(err) {
  const msg = (err?.message || String(err)).toLowerCase();
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    (msg.includes('loading chunk') && msg.includes('failed')) ||
    msg.includes('importing a module script failed')
  );
}

/**
 * @param {() => Promise<{ default: React.ComponentType }>} importFn - nt () => import('./Component')
 * @returns {React.LazyExoticComponent}
 */
export function lazyWithRetry(importFn) {
  return React.lazy(async () => {
    try {
      return await importFn();
    } catch (err) {
      if (!isChunkLoadError(err)) throw err;
      try {
        const retried = sessionStorage.getItem(CHUNK_RETRY_KEY);
        if (retried === '1') {
          sessionStorage.removeItem(CHUNK_RETRY_KEY);
          throw err;
        }
        sessionStorage.setItem(CHUNK_RETRY_KEY, '1');
        window.location.reload();
        return new Promise(() => {}); // never resolves – page is reloading
      } catch {
        throw err;
      }
    }
  });
}
