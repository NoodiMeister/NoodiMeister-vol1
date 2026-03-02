import React from 'react';
import { Link } from 'react-router-dom';
import { Music2, Check, FileMusic, Infinity, Cloud, UserPlus, LogIn } from 'lucide-react';

const plans = [
  {
    id: 'demo',
    name: 'Demo',
    description: 'Katsetamiseks ilma kontota',
    price: 'Tasuta',
    period: '',
    features: [
      'Kuni 2 rida (8 takti)',
      'Traditsiooniline noodistik ja Figurenotes',
      'Kohalik salvestus (fail arvutisse)',
      'Ideaalne kiireks proovimiseks'
    ],
    cta: 'Proovi demot',
    ctaTo: '/app',
    ctaIcon: FileMusic,
    highlighted: false
  },
  {
    id: 'täis',
    name: 'Registreeritud kasutaja',
    description: 'Täisfunktsioon konto abil',
    price: 'Tasuta',
    period: 'konto eest',
    features: [
      'Piiramatu arv ridu ja takte',
      'Kõik noodistiku ja Figurenotes võimalused',
      'Pilvesalvestus (Google Drive jms)',
      'Projektide haldamine ja taastamine',
      'Salvesta ja jaga oma töid'
    ],
    cta: 'Loo konto',
    ctaTo: '/registreeru',
    ctaIcon: UserPlus,
    highlighted: true
  }
];

export default function HinnakiriPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-amber-200/60 bg-white/70 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
              <Music2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-amber-900" style={{ fontFamily: 'Georgia, serif' }}>
              NoodiMeister
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 font-medium hover:bg-amber-100 transition-colors"
            >
              Avaleht
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 font-medium hover:bg-amber-100 transition-colors"
            >
              <LogIn className="w-4 h-4" /> Logi sisse
            </Link>
            <Link
              to="/registreeru"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-500 shadow-md transition-all"
            >
              <UserPlus className="w-4 h-4" /> Registreeru
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 px-6 py-12 sm:py-16">
        <section className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              Hinnakiri
            </h1>
            <p className="text-lg text-amber-800/90 max-w-xl mx-auto">
              NoodiMeister on registreeritud kasutajatele tasuta. Loo konto ja kasuta täisfunktsioone.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
            {plans.map((plan) => {
              const Icon = plan.ctaIcon;
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl border-2 p-6 sm:p-8 flex flex-col transition-all ${
                    plan.highlighted
                      ? 'border-amber-500 bg-white shadow-lg shadow-amber-200/40 scale-[1.02] sm:scale-105'
                      : 'border-amber-200/60 bg-white/90'
                  }`}
                >
                  {plan.highlighted && (
                    <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-3">
                      Soovitus
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 className="text-xl font-bold text-amber-900" style={{ fontFamily: 'Georgia, serif' }}>
                      {plan.name}
                    </h2>
                    {plan.id === 'täis' && (
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Infinity className="w-4 h-4 text-amber-600" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-amber-700/90 mb-4">{plan.description}</p>
                  <div className="mb-6">
                    <span className="text-2xl font-bold text-amber-900">{plan.price}</span>
                    {plan.period && (
                      <span className="text-amber-700/90 ml-1">{plan.period}</span>
                    )}
                  </div>
                  <ul className="space-y-3 flex-1 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-amber-800 text-sm">
                        <Check className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to={plan.ctaTo}
                    className={`inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-semibold transition-all ${
                      plan.highlighted
                        ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md hover:shadow-lg hover:from-amber-500 hover:to-orange-500'
                        : 'border-2 border-amber-400 bg-white text-amber-800 hover:bg-amber-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

          <div className="mt-10 sm:mt-12 p-6 rounded-2xl bg-white/80 border border-amber-200/60 shadow-sm">
            <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
              <Cloud className="w-5 h-5 text-amber-600" />
              Pilvesalvestus
            </h3>
            <p className="text-sm text-amber-800/90">
              Registreeritud kasutajad saavad projekte salvestada oma pilveteenusesse (praegu Google Drive; tulevikus OneDrive, iCloud jms). Andmeid hoiame privaatselt; pilvesalvestus toimub sinu valitud teenuse kaudu.
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-amber-700/80">
            Küsimused? Kirjuta meile või vaata <Link to="/" className="underline hover:text-amber-800">avalehelt</Link> rohkem infot.
          </p>
        </section>
      </main>

      <footer className="flex-shrink-0 py-6 text-center text-sm text-amber-700/80 border-t border-amber-200/40">
        NoodiMeister — veebis noodistiku loomine.
      </footer>
    </div>
  );
}
