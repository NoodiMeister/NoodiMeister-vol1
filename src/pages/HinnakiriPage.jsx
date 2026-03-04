import React from 'react';
import { Link } from 'react-router-dom';
import { Music2, Check, FileMusic, Cloud, UserPlus, LogIn, Heart } from 'lucide-react';

const supportPlans = [
  {
    id: '1kuu',
    name: '1 kuu',
    description: 'Ühe kuu toetamine ja täisfunktsioon',
    price: '5',
    currency: '€',
    period: '/kuu',
    features: [
      'Täisfunktsioon 1 kuu',
      'Piiramatu arv ridu ja takte',
      'Pilvesalvestus (Google Drive jms)',
      'Toetad NoodiMeistri arendamist'
    ],
    cta: 'Toeta 1 kuu',
    ctaTo: '/toeta?kuud=1',
    highlighted: false
  },
  {
    id: '2kuud',
    name: '2 kuud',
    description: 'Kaks kuud toetamist ja täisfunktsiooni',
    price: '10',
    currency: '€',
    period: 'kokku',
    features: [
      'Täisfunktsioon 2 kuud',
      'Piiramatu arv ridu ja takte',
      'Pilvesalvestus',
      'Soodsam kui 2× üksiku kuu hinda'
    ],
    cta: 'Toeta 2 kuud',
    ctaTo: '/toeta?kuud=2',
    highlighted: true
  },
  {
    id: '12kuud',
    name: '12 kuud',
    description: 'Aasta toetamine – kõige soodsam',
    price: '55',
    currency: '€',
    period: 'kokku (12 kuud)',
    features: [
      'Täisfunktsioon 12 kuud',
      'Piiramatu arv ridu ja takte',
      'Pilvesalvestus',
      'Parim väärtus toetajale'
    ],
    cta: 'Toeta 12 kuud',
    ctaTo: '/toeta?kuud=12',
    highlighted: false
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
            <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 font-medium hover:bg-amber-100 transition-colors">
              Avaleht
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-amber-800 font-medium hover:bg-amber-100 transition-colors">
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
            <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 mb-3" style={{ fontFamily: 'Georgia, serif' }}>
              Hinnakiri ja toetamine
            </h1>
            <p className="text-lg text-amber-800/90 max-w-2xl mx-auto">
              Igal kasutajal on võimalik NoodiMeistri arendamist toetada vastavalt sellele, mitu kuud soovid rakendust proovida ja katsetada. Toetuse ajal on sul täisfunktsioon; loodud tööd jäävad alles ka pärast toetuse lõppu.
            </p>
          </div>

          {/* Toetamise plaanid */}
          <div className="grid sm:grid-cols-3 gap-6 mb-12">
            {supportPlans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-2xl border-2 p-6 flex flex-col transition-all ${
                  plan.highlighted
                    ? 'border-amber-500 bg-white shadow-lg shadow-amber-200/40 scale-[1.02]'
                    : 'border-amber-200/60 bg-white/90'
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                    Soovitus
                  </div>
                )}
                <h2 className="text-xl font-bold text-amber-900 mb-1" style={{ fontFamily: 'Georgia, serif' }}>
                  {plan.name}
                </h2>
                <p className="text-sm text-amber-700/90 mb-4">{plan.description}</p>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-amber-900">{plan.price}</span>
                  <span className="text-amber-700 font-medium">{plan.currency}</span>
                  <span className="text-amber-700/90 text-sm ml-1">{plan.period}</span>
                </div>
                <ul className="space-y-2 flex-1 mb-6 text-sm text-amber-800">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.ctaTo}
                  className={`inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md hover:from-amber-500 hover:to-orange-500'
                      : 'border-2 border-amber-400 bg-white text-amber-800 hover:bg-amber-50'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  {plan.cta}
                </Link>
              </div>
            ))}
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

          {/* Administraatori erand – mitte avalikult esile, aga dokumendis */}
          <p className="text-center text-xs text-amber-600/80">
            Administraatori kasutaja (info@la-stravaganza.com) ei kuulu kuumakse nõude alla.
          </p>

          <p className="mt-6 text-center text-sm text-amber-700/80">
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
