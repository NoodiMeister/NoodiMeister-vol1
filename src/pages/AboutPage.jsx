import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppLogo } from '../components/AppLogo';
import { PRIVACY_BODY } from '../content/privacyAndTermsContent';
import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE } from '../i18n';

function getLocale() {
  try {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

const CONTENT = {
  et: {
    pageTitle: 'Teave',
    backToApp: 'Tagasi rakendusse',
    tocTitle: 'Sisukord',
    sections: [
      {
        id: 'esileht',
        title: 'Esileht',
        body: [
          'Noodimeister on veebil põhinev noodigraafika programm, mille oluline ülesanne on olla vajalikuks töövahendiks motiveerivate õppevahendite loomiseks. Programmi on võimalik kasutada nii tasuta demo versioonina kuni 8 taktini kui ka tavakasutajana oma isikliku e-posti aadressi kasutades kui ka avaliku sektori kui ka erasektoriga seotud e-posti aadressidega. Rakendust on võimalik siduda pilve salvestuskeskkondadega, kuhu rakendusega seotud failid salvestada. Rakendus on loodud Eestis.',
          'Rakendust haldab La Stravaganza OÜ.',
          'Reg.kood: 17007727',
          'Rakenduse haldaja e-post: info@la-stravaganza.com',
          'Arendaja: Raido Lill',
        ],
      },
      {
        id: 'metoodikad',
        title: 'Kasutatavad metoodikad',
        body: [
          'Noodimeister toetab mitut metoodilist tööviisi: traditional, figurenotes ja pedagogical. Režiimid on eraldatud, et sama sisend annaks igas režiimis ennustatava tulemuse.',
          'Arenduses lähtume kasutajateekondadest (õpetaja sisestab -> korrigeerib -> salvestab -> ekspordib) ning võrdleme notatsioonikäitumist vajadusel MuseScore/Finale/Sibelius tüüpi standarditega.',
        ],
      },
      {
        id: 'andmekaitse-turvalisus',
        title: 'Andmekaitse ja turvalisus',
        body: PRIVACY_BODY.et,
      },
    ],
  },
  en: {
    pageTitle: 'About',
    backToApp: 'Back to app',
    tocTitle: 'Contents',
    sections: [
      {
        id: 'home',
        title: 'Home',
        body: [
          'Noodimeister is an educational notation and teaching tool operated by the Noodimeister service provider. The product is built to support the teacher workflow: fast input, clear rendering, and reliable export.',
          'Legal service provider details are published on public pages (for example contact, terms, privacy) so schools and institutions can clearly identify accountability and support contacts.',
        ],
      },
      {
        id: 'methodologies',
        title: 'Methodologies',
        body: [
          'Noodimeister supports multiple methodologies: traditional, figurenotes, and pedagogical. Modes are intentionally separated so the same input remains predictable within each mode.',
          'Development follows user journeys (teacher inputs -> edits -> saves -> exports) and, when needed, behavior is compared against notation standards used in tools like MuseScore, Finale, and Sibelius.',
        ],
      },
      {
        id: 'data-protection-security',
        title: 'Data protection and security',
        body: PRIVACY_BODY.en,
      },
    ],
  },
  fi: {
    pageTitle: 'Tietoa',
    backToApp: 'Takaisin sovellukseen',
    tocTitle: 'Sisällysluettelo',
    sections: [
      {
        id: 'etusivu',
        title: 'Etusivu',
        body: [
          'Noodimeister on verkkopohjainen nuotinnusohjelma, jonka tärkein tehtävä on toimia hyödyllisenä työkaluna motivoivien oppimateriaalien luomisessa. Ohjelmaa voi käyttää ilmaisena demo-versiona enintään 8 tahtiin asti sekä tavallisena käyttäjänä henkilökohtaisella sähköpostiosoitteella tai julkisen ja yksityisen sektorin sähköpostiosoitteilla.',
          'Sovellus voidaan liittää pilvitallennusympäristöihin, joihin sovellukseen liittyvät tiedostot tallennetaan. Sovellus on kehitetty Virossa.',
          'Sovellusta ylläpitää La Stravaganza OÜ.',
          'Y-tunnus: 17007727',
          'Sovelluksen ylläpidon sähköposti: info@la-stravaganza.com',
          'Kehittäjä: Raido Lill',
        ],
      },
      {
        id: 'menetelmat',
        title: 'Käytettävät menetelmät',
        body: [
          'Noodimeister tukee useita työskentelymenetelmiä: traditional, figurenotes ja pedagogical. Tilat on erotettu toisistaan, jotta sama syöte tuottaa ennakoitavan tuloksen jokaisessa tilassa.',
          'Kehityksessä lähdetään käyttäjäpoluista (opettaja syöttää -> muokkaa -> tallentaa -> vie) ja nuotinnuskäyttäytymistä verrataan tarvittaessa MuseScoren, Finalen ja Sibeliuksen kaltaisiin standardeihin.',
        ],
      },
      {
        id: 'tietosuoja-tietoturva',
        title: 'Tietosuoja ja tietoturva',
        body: PRIVACY_BODY.fi,
      },
    ],
  },
};

export default function AboutPage() {
  const [locale] = useState(getLocale);
  const normalizedLocale = String(locale || '').toLowerCase();
  const content = useMemo(() => {
    if (normalizedLocale.startsWith('et')) return CONTENT.et;
    if (normalizedLocale.startsWith('fi')) return CONTENT.fi;
    return CONTENT.en;
  }, [normalizedLocale]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:bg-black">
      <header className="sticky top-0 z-20 border-b border-amber-200/60 dark:border-white/20 bg-white/80 dark:bg-black/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center">
            <AppLogo variant="header" alt="NoodiMeister" />
          </Link>
          <Link
            to="/app"
            className="inline-flex items-center rounded-lg border border-amber-300 dark:border-white/30 px-3 py-2 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
          >
            {content.backToApp}
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <h1 className="text-3xl sm:text-4xl font-bold text-amber-900 dark:text-white mb-6 sm:mb-8" style={{ fontFamily: 'Georgia, serif' }}>
          {content.pageTitle}
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-6 sm:gap-8 items-start">
          <aside className="md:sticky md:top-24 rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200 mb-3">
              {content.tocTitle}
            </h2>
            <nav className="space-y-2">
              {content.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-amber-900 dark:text-white hover:bg-amber-100 dark:hover:bg-white/10 transition-colors"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <section className="space-y-6">
            {content.sections.map((section) => (
              <article
                key={section.id}
                id={section.id}
                className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-white/80 dark:bg-zinc-900 p-5 sm:p-6 scroll-mt-24"
              >
                <h2 className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-white mb-3">
                  {section.title}
                </h2>
                <div className="space-y-3 text-sm sm:text-base leading-relaxed text-amber-900/95 dark:text-white/90">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}
