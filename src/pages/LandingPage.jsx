import React from 'react';
import { Link } from 'react-router-dom';
import { Music2, FileMusic, Cloud, UserPlus, LogIn, PenTool, Save, Share2 } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Music2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-amber-900" style={{ fontFamily: 'Georgia, serif' }}>
              NoodiMeister
            </span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              to="/hinnakiri"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 font-medium hover:bg-amber-100 transition-colors"
            >
              Hinnakiri
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 px-6 py-12 sm:py-16">
        <section className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-amber-900 mb-4" style={{ fontFamily: 'Georgia, serif' }}>
            Kirjuta noote nagu helilooja
          </h1>
          <p className="text-lg sm:text-xl text-amber-800/90 max-w-2xl mx-auto mb-8 leading-relaxed">
            Loo noote traditsioonilise või figuurnotatsiooni järgi. Kasutamiseks mõeldud õpetajatele, õpilastele, aga ka muidu muusikaharrastajatele, kes soovivad oma muusikalise noodiloome annet arendada.
          </p>
          <div className="flex flex-col items-center justify-center gap-4">
            <Link
              to="/app"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold text-lg shadow-lg hover:shadow-xl hover:from-amber-500 hover:to-orange-500 transition-all"
            >
              <FileMusic className="w-5 h-5" /> Demo versioon
            </Link>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-amber-400 bg-white text-amber-800 font-semibold hover:bg-amber-50 transition-colors"
              >
                <LogIn className="w-5 h-5" /> Logi sisse
              </Link>
              <Link
                to="/registreeru"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-amber-400 bg-white text-amber-800 font-semibold hover:bg-amber-50 transition-colors"
              >
                <UserPlus className="w-5 h-5" /> Loo konto
              </Link>
            </div>
          </div>
          <p className="mt-4 text-sm text-amber-700/80">
            Demo versioon: ühe faili piires saad kuni 8 takti proovida. Sisselogitud kasutaja saab kirjutada piiramatult.
          </p>
        </section>

        {/* Kuidas see töötab */}
        <section className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-amber-900 mb-8 text-center" style={{ fontFamily: 'Georgia, serif' }}>
            Kuidas see töötab?
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            <div className="bg-white/80 rounded-2xl p-6 border border-amber-200/60 shadow-sm text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <PenTool className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-amber-900 mb-1">1. Loo noodid</h3>
              <p className="text-sm text-amber-800/80">Vali traditsiooniline noodistik või Figurenotes-võre ja joonista noote tööriistadega.</p>
            </div>
            <div className="bg-white/80 rounded-2xl p-6 border border-amber-200/60 shadow-sm text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Save className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-amber-900 mb-1">2. Vali salvestus</h3>
              <p className="text-sm text-amber-800/80">Salvesta fail arvutisse või logi sisse pilveteenusega (Google jms), et hoida projekte pilves.</p>
            </div>
            <div className="bg-white/80 rounded-2xl p-6 border border-amber-200/60 shadow-sm text-center">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <Share2 className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-semibold text-amber-900 mb-1">3. Jaga või harjuta</h3>
              <p className="text-sm text-amber-800/80">Laadi projekte uuesti üles või jaga linke — ideaalne tunnis ja kodutööna.</p>
            </div>
          </div>
        </section>

        {/* Salvestusvalikud */}
        <section className="max-w-3xl mx-auto mb-12">
          <h2 className="text-2xl font-bold text-amber-900 mb-6 text-center" style={{ fontFamily: 'Georgia, serif' }}>
            Salvestusvalikud
          </h2>
          <div className="bg-white/80 rounded-2xl p-6 sm:p-8 border border-amber-200/60 shadow-sm">
            <ul className="space-y-4 text-amber-800">
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-semibold text-sm">1</span>
                <div>
                  <strong>Kohalik salvestus</strong> — salvesta fail oma arvutisse ilma kontota. Sobib kiireks tööks ja ühe seadme kasutamiseks.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700 font-semibold text-sm">2</span>
                <div>
                  <strong>Konto (e-mail või Google)</strong> — loo konto, et projekte hallata ja soovi korral salvestada pilve (nt Google Drive). Tulevikus toetame ka OneDrive, iCloud ja Dropbox.
                </div>
              </li>
            </ul>
            <p className="mt-4 text-sm text-amber-700/80 border-t border-amber-200/60 pt-4">
              Kasutaja andmeid (logimine, registreerimine, salvestuskeskkonna valikud) hoiame privaatselt; pilvesalvestus toimub sinu valitud teenuse kaudu.
            </p>
          </div>
        </section>

        {/* Features strip */}
        <section className="border-t border-amber-200/60 bg-white/50 py-8">
          <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-center gap-8 sm:gap-12 text-amber-800">
            <span className="flex items-center gap-2 font-medium">
              <FileMusic className="w-5 h-5 text-amber-600" /> Traditsiooniline noodistik & Figurenotes
            </span>
            <span className="flex items-center gap-2 font-medium">
              <Cloud className="w-5 h-5 text-amber-600" /> Kohalik fail · Pilv (Google Drive jms)
            </span>
          </div>
        </section>
      </main>

      <footer className="flex-shrink-0 py-6 text-center text-sm text-amber-700/80 border-t border-amber-200/40">
        NoodiMeister — veebis noodistiku loomine. Kirjuta noote nagu helilooja.
      </footer>
    </div>
  );
}
