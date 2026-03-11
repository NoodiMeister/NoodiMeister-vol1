/**
 * Administraatori leht – tööriistad tulevad koos makselahendusega (pärast esitlust).
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function AdminGrantSupportPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900 px-6">
      <div className="max-w-md w-full rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-white/10 p-8 text-center shadow-lg">
        <Shield className="w-12 h-12 text-slate-400 dark:text-white/50 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Administraatori tööriistad</h1>
        <p className="text-sm text-slate-600 dark:text-white/70 mb-6">
          Toetuse andmise ja makselahenduse haldamise tööriistad lisatakse pärast esitlust.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors"
        >
          Tagasi avalehele
        </Link>
      </div>
    </div>
  );
}
