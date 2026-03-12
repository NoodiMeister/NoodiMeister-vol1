import { useEffect } from 'react';

/**
 * Force light theme on public pages (landing, login, register, hinnakiri, toeta).
 * Dark mode is only available after login; public pages always use light.
 */
export function useForceLightTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);
}
