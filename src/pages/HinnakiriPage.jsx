import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, FileMusic, Cloud, UserPlus, LogIn, Heart } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';

const PRICE_PER_MONTH = 5;
const DISCOUNT_12_MONTHS = 55;

function calcTotal(kuud) {
  if (!Number.isFinite(kuud) || kuud < 1 || kuud > 60) return null;
  return kuud === 12 ? DISCOUNT_12_MONTHS : kuud * PRICE_PER_MONTH;
}

export default function HinnakiriPage() {
  const [months, setMonths] = useState(1);
  const total = calcTotal(months);
  const isValid = total !== null;
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-200/60 dark:border-white/20 bg-white/70 dark:bg-black/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <nav className="flex items-center gap-3">
            <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 dark:text-white font-medium hover:bg-amber-100 dark:hover:bg-white/10 transition-colors">
              Avaleht
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 dark:text-white font-medium hover:bg-amber-100 dark:hover:bg-white/10 transition-colors">
              <LogIn className="w-4 h-4" /> Logi sisse
            </Link>
            <Link to="/registreeru" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 shadow-md transition-all">
              <UserPlus className="w-4 h-4" /> Registreeru
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-12 sm:py-16">
        <section className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 dark:text-white mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              Hinnakiri ja toetamine
            </h1>
            <p className="text-lg text-amber-800/90 dark:text-white/90 max-w-2xl mx-auto">
              Igal kasutajal on võimalik NoodiMeistri arendamist toetada vastavalt sellele, mitu kuud soovid rakendust proovida ja katsetada. Toetuse ajal on sul täisfunktsioon; loodud tööd jäävad alles ka pärast toetuse lõppu.
            </p>
          </div>

          {/* Vali toetamise kuude arv */}
          <div className="rounded-2xl border-2 border-amber-500 dark:border-white/30 bg-white dark:bg-zinc-900 shadow-lg shadow-amber-200/40 dark:shadow-none p-6 sm:p-8 mb-12 max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-amber-900 dark:text-white mb-2 text-center" style={{ fontFamily: 'Georgia, serif' }}>
              Vali toetamise periood
            </h2>
            <p className="text-sm text-amber-700/90 dark:text-white/80 text-center mb-6">
              Sisesta, mitu kuud soovid ühekordselt toetada (1–60 kuud). Täisfunktsioon kogu valitud perioodi vältel.
            </p>
            <div className="mb-4">
              <label htmlFor="hinnakiri-kuud" className="block text-sm font-semibold text-amber-900 dark:text-white mb-2">
                Kuude arv
              </label>
              <input
                id="hinnakiri-kuud"
                type="number"
                min={1}
                max={60}
                value={months}
                onChange={(e) => {
                  const v = e.target.value;
                  const n = parseInt(v, 10);
                  if (v === '' || !Number.isFinite(n)) return;
                  setMonths(Math.max(1, Math.min(60, n)));
                }}
                className="w-full px-4 py-3 rounded-xl border-2 border-amber-200 dark:border-white/30 bg-white dark:bg-black/50 text-amber-900 dark:text-white text-lg font-semibold focus:ring-2 focus:ring-amber-500 focus:border-amber-500 dark:focus:ring-white/30 dark:focus:border-white/30"
              />
              <p className="mt-1 text-xs text-amber-700/80">
                {PRICE_PER_MONTH} € kuus. 12 kuud soodushinnaga {DISCOUNT_12_MONTHS} € kokku.
              </p>
            </div>
            <ul className="space-y-2 mb-6 text-sm text-amber-800 dark:text-white">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Piiramatu arv ridu ja takte</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Pilvesalvestus (Google Drive jms)</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Toetad NoodiMeistri arendamist</span>
              </li>
            </ul>
            <div className="rounded-xl bg-amber-50/80 dark:bg-white/10 border border-amber-200/60 dark:border-white/20 p-4 mb-6">
              <p className="text-sm text-amber-800/90 dark:text-white">
                {months} {months === 1 ? 'kuu' : 'kuud'} täisfunktsiooni
              </p>
              <p className="text-2xl font-bold text-amber-900 dark:text-white">
                Kokku: {isValid ? `${total} €` : '—'}
              </p>
              {months === 12 && isValid && (
                <p className="text-xs text-amber-600 mt-1">12 kuud soodushinnaga</p>
              )}
            </div>
            <Link
              to={`/toeta?kuud=${months}`}
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md hover:from-amber-500 hover:to-orange-500 transition-all"
            >
              <Heart className="w-4 h-4" />
              Toeta {months} {months === 1 ? 'kuu' : 'kuud'}
            </Link>
          </div>

          {/* Registreeru tasuta */}
          <div className="rounded-2xl border-2 border-emerald-200/80 bg-white/90 p-6 mb-6">
            <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <UserPlus className="w-5 h-5 text-emerald-600" />
              Registreeru tasuta
            </h3>
            <p className="text-sm text-amber-800/90 mb-3">
              Konto loomine on tasuta. Soovi korral saad hiljem valida toetamise perioodi (1–60 kuud) täisfunktsiooni jaoks.
            </p>
            <Link to="/registreeru" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-emerald-600 text-white hover:bg-emerald-500 text-sm">
              <UserPlus className="w-4 h-4" /> Registreeru tasuta
            </Link>
          </div>

          {/* Demo ilma kontota */}
          <div className="rounded-2xl border-2 border-amber-200/60 bg-white/90 p-6 mb-8">
            <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <FileMusic className="w-5 h-5 text-amber-600" />
              Tasuta demo ilma kontota
            </h3>
            <p className="text-sm text-amber-800/90 mb-2">
              Saad katsetada kuni 2 reani (8 takti) ja salvestada faili arvutisse. Täisfunktsiooni ja pilvesalvestuse jaoks loo konto (tasuta) või vali toetamise periood ülal.
            </p>
            <Link to="/app" className="inline-flex items-center gap-2 text-amber-700 font-medium hover:text-amber-800 text-sm">
              <FileMusic className="w-4 h-4" /> Proovi demot
            </Link>
          </div>

          {/* Mis juhtub, kui toetus lõpeb */}
          <div className="rounded-2xl bg-amber-50/80 border border-amber-200/60 p-6 mb-8">
            <h3 className="font-semibold text-amber-900 mb-2">Kui toetuse periood lõpeb</h3>
            <ul className="text-sm text-amber-800/90 space-y-1">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span><strong>Loodud tööd ei kustutata</strong> – sinu projektid jäävad alles.</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>Kui lisa kuutasu ei tule, <strong>töötad demo režiimis</strong>: saad töid vaadata ja väiksemaid muudatusi teha, kuid suuri muudatusi loodud töödes teostada ei saa. Täisfunktsiooni taastamiseks võid uuesti toetust valida.</span>
              </li>
            </ul>
          </div>

          {/* Pilvesalvestus */}
          <div className="p-6 rounded-2xl bg-white/80 border border-amber-200/60 shadow-sm mb-8">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-amber-600" />
              Pilvesalvestus
            </h3>
            <p className="text-sm text-amber-800/90">
              Toetajad saavad projekte salvestada oma pilveteenusesse (praegu Google Drive; tulevikus OneDrive, iCloud jms). Andmeid hoiame privaatselt; pilvesalvestus toimub sinu valitud teenuse kaudu.
            </p>
          </div>

          {/* Kuidas ja kuhu toetada */}
          <div className="rounded-2xl border-2 border-amber-300/60 dark:border-amber-500/40 bg-amber-50/90 dark:bg-zinc-900/80 p-6 mb-8">
            <h3 className="font-semibold text-amber-900 dark:text-white mb-3">Kuidas toetust teha ja kuhu raha läheb?</h3>
            <p className="text-sm text-amber-800/90 dark:text-white/90 mb-3">
              Toetust saad teha pärast registreerumist või sisselogimist. Makseviisid:
            </p>
            <ul className="text-sm text-amber-800/90 dark:text-white/90 space-y-2 mb-3 list-disc list-inside">
              <li><strong>Kaardiga</strong> – ühekordne makse debit- või krediitkaardiga (Stripe).</li>
              <li><strong>Pangaga</strong> – SEPA, iDEAL, Sofort jms (Stripe Checkout’is, sõltuvalt riigist).</li>
              <li>Soovi korral võid toetada ka <strong>ülekandega</strong> meie pangaarvele (IBAN ja viide e-kirjas).</li>
              <li><strong>Organisatsioonid (nt koolid)</strong> – e-arvega; võta ühendust (info@la-stravaganza.com), saadame arve ja anname nimetatud kontodele täisfunktsiooni.</li>
            </ul>
            <p className="text-sm text-amber-800/90 dark:text-white/90">
              <strong>Kuhu raha läheb?</strong> Toetused lähevad NoodiMeistri arenduse ja ülalpidamise kulude katteks (serverid, domeenid, edasiarendus). Teenust pakub La Stravaganza (info@la-stravaganza.com).
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-amber-700/80">
            Küsimused või ettepanekud rakenduse või kuutasu kohta? Kirjuta meile:{' '}
            <a href="mailto:info@la-stravaganza.com" className="underline hover:text-amber-800 font-medium">info@la-stravaganza.com</a>
            {' '}või vaata <Link to="/" className="underline hover:text-amber-800">avalehelt</Link> rohkem infot.
          </p>
        </section>
      </main>

      <footer className="flex-shrink-0 py-6 text-center text-sm text-amber-700/80 border-t border-amber-200/40">
        NoodiMeister — veebis noodistiku loomine. Küsimused? <a href="mailto:info@la-stravaganza.com" className="underline hover:text-amber-800">info@la-stravaganza.com</a>
      </footer>
    </div>
  );
}
