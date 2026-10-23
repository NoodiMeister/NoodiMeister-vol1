export const HOW_TO_GUIDE_CONTENT = {
  et: {
    pageTitle: 'Kuidas? (How to?)',
    backToApp: 'Tagasi rakendusse',
    intro: 'Kõik peamised kasutajaküsimused koos sammudega, mida saab avada detailse juhendina.',
    openGuide: 'Ava juhend',
    closeGuide: 'Sulge',
    stepsTitle: 'Sammud',
    visualsTitle: 'Visuaalid',
    sections: [
      {
        title: 'Kõige sagedasemad küsimused',
        qa: [
          {
            q: "Kuidas file'i salvestada?",
            steps: [
              'Tee noodilehel vajalikud muudatused.',
              'Vajuta editori salvestamise tegevust (Save/Salvesta).',
              'Vali sihtkoht: lokaalne või pilv (Google Drive / OneDrive).',
              'Konflikti korral eelista uut versiooni/koopiat, mitte vaikset ülekirjutamist.',
            ],
          },
          {
            q: "Kuidas file'i laadida?",
            steps: [
              'Ava “Minu tööd”.',
              'Vali fail nimekirjast või otsi failinime järgi.',
              'Klõpsa failile, et avada see noodilehel.',
              'Pilvefaili puhul kontrolli, et õige konto on aktiivne.',
            ],
          },
          {
            q: 'Kuidas noteerida?',
            steps: [
              'Vali reziim: traditional, figurenotes või pedagogical.',
              'Vali kestus (nt 1-5), seejärel sisesta noot (A-G) või kasuta hiirt.',
              'Kursor liigub ajas edasi; vajadusel muuda kestust enne järgmist nooti.',
              'Parandused tee valiku ja kustutuse abil.',
            ],
            images: [
              { src: '/rhythm-reference-table.svg', caption: 'Rütmiväärtuste visuaal' },
              { src: '/beam-samples/beam-4-8.svg', caption: 'Grupeerimise näidis' },
            ],
          },
          {
            q: 'Kuidas sisestada helitute percussion-pillide rütme (pedagogical)?',
            steps: [
              'Vali instrument Orff rütmipillide hulgast (unpitched percussion).',
              'Vali rütm tööriistakastist (nt 1/4, 1/8, 1/16).',
              'Mac/PC puhul sisesta noot füüsilise klaviatuuri tähtedega A-G.',
              'iPad/tahvel seadmes kasuta nuppu “Sisesta rütm”, mis lisab valitud kestusega noodi kursori asukohta.',
              'Varred kuvatakse nende pillide puhul vaikimisi üles suunas.',
            ],
          },
          {
            q: 'Kuidas paigutust muuta?',
            steps: [
              'Ava paigutuse seaded.',
              'Muuda orientatsiooni, süsteemivahet ja joondusi.',
              'Kontrolli scorepage vaates, et sisu ei kattuks.',
              'Kontrolli sama ka PDF eelvaates.',
            ],
          },
          {
            q: "Kas ja kuidas PDF ja print'da?",
            steps: [
              'Vali Export PDF või Print.',
              'Kontrolli eelvaates lehe servasid, ridu ja pause.',
              'Kui lõikab, kohanda paigutusvalikuid.',
              'Kinnita alles pärast eelvaate kontrolli.',
            ],
          },
          {
            q: 'Kuidas valmis lugu kuulata / noodist taasesitada?',
            steps: [
              'Ava oma töö noodilehel (scorepage), et noodid oleksid nähtavad.',
              'Ülemisel ribal vajuta nuppu „Play“ – lugu hakkab kursori asukohast mängima.',
              'Tempo jaoks sea BPM (Noodigraafika mängija aknas või seotud seadetest).',
              'Rohkemate juhtnuppude jaoks ava „Noodigraafika mängija“ (Play, Paus, Stop, Step).',
              'Peatamiseks vajuta „Stop“ või „Paus“; Stop viib kursori tavaliselt tagasi algusesse.',
              'Pedagoogilises režiimis D (interaktiivne) on lisaks taustheli ja meedia-toolbar; tavaliseks kuulamiseks piisab Play / Noodigraafika mängijast.',
            ],
          },
          {
            q: 'Miks Animation Record nupp on hall ja kuidas see aktiivseks saada?',
            steps: [
              'Animation Record töötab ainult siis, kui Live preview ala on sisse lülitatud.',
              'Lülita nupp “Live preview ala: ON” aktiivseks.',
              'Joonista noodilehele katkendjooneline ristkülik (stseeniala), mida soovid videosse salvestada.',
              'Kui ala on olemas, muutub Record nupp aktiivseks ja salvestus kasutab täpselt seda ala.',
            ],
          },
          {
            q: 'Kuidas laulusõnu lisada? Kuidas lisada rohkem kui 1 rida laulusõnu?',
            steps: [
              'Vali laulusõnade/teksti sisestus.',
              'Klõpsa algusnoodi alla ning sisesta 1. rida.',
              'Lisa 2. (ja järgmised) read eraldi lyrics rea/verse real.',
              'Hoia read eraldi, et need joonduksid samade nootidega.',
            ],
          },
          {
            q: 'Kuidas kasutada Tekst / Text tööriista?',
            steps: [
              'Ava tööriistaribalt “Tekst / Text”.',
              'Lohista noodilehel ala, kuhu tekst peab ilmuma (tekstikast tekib täpselt valitud alasse).',
              'Sisesta sisu (nt kommentaar, juhis, tempo) ja kinnita.',
              'Vajadusel liiguta või skaleeri tekstikasti, et see ei kattuks nootide, akordide ega laulusõnadega.',
              'Kontrolli sama paigutust enne eksporti PDF/Print eelvaates.',
            ],
          },
          {
            q: 'Kuidas akorde lisada?',
            steps: [
              'Vali akordi sisestuse tööriist.',
              'Klõpsa noodi või takti kohale.',
              'Sisesta akordi tähis (nt C, G7, Dm).',
              'Kontrolli, et akordid ei kattuks laulusõnadega.',
            ],
          },
          {
            q: 'Kuidas ja mis põhimõtetel saab transponeerida?',
            steps: [
              'Ava transponeerimise valik.',
              'Vali intervall või sihthelistik.',
              'Rakenda kogu loole või valitud osale.',
              'Põhimõte: intervallisuhted säilivad, helikõrgus nihkub.',
            ],
            images: [
              { src: '/key-signatures-reference-table.svg', caption: 'Helistike tabel' },
              { src: '/reference/key-signature-all-staves.svg', caption: 'Võtmemärkide paigutus' },
            ],
          },
          {
            q: 'Kas ja kuidas saab noodigraafika suurust muuta?',
            steps: [
              'Ava notatsiooni/layout skaleerimise seaded.',
              'Muuda staff/notation scale sammhaaval.',
              'Kontrolli loetavust ja leheküljele mahtumist.',
              'Korda kontrolli PDF eelvaates.',
            ],
          },
          {
            q: 'Kuidas instrumente/hääli lisada?',
            steps: [
              'Ava instrumentide/staffide haldus.',
              'Lisa uus instrument või haal.',
              'Määra järjekord ning roll (meloodia/bass jms).',
              'Kontrolli, et süsteem paigutub korrektselt.',
            ],
          },
          {
            q: 'Kas ja kuidas partituurist teha eraldi partiide vaade?',
            steps: [
              'Vali partituuris soovitud instrument/haal.',
              'Ava partii vaade.',
              'Kontrolli, et õiged taktid ja märked on nähtavad.',
              'Ekspordi või prindi partii eraldi.',
            ],
          },
          {
            q: 'Kuidas taktimõõtu muuta?',
            steps: [
              'Vali taktimõõdu tööriist.',
              'Määra uus taktimõõt (nt 3/4, 6/8).',
              'Rakenda valikule või kogu loole.',
              'Kontrolli taktiridade joondust.',
            ],
            images: [
              { src: '/reference/key-signature-full-table.svg', caption: 'Näidistabel (takt/helistik kontekstis)' },
            ],
          },
          {
            q: 'Kas taktimõõtu saab ka loo keskel muuta?',
            steps: [
              'Jah, saab.',
              'Liiguta kursor takti ette, kust uus taktimõõt algab.',
              'Sisesta uus taktimõõt.',
              'Kontrolli järgneva osa rütmijaotust.',
            ],
          },
          {
            q: "Kas noodimeister.ee-s on võimalik ühe file'i sees luua samale lehele eraldi lugusid (eraldi pealkiri, taktimõõt, helistik)?",
            steps: [
              'Tehniliselt saab ühes failis teha eraldi lõike.',
              'Praktiline soovitus: iga iseseisev lugu hoia eraldi failina.',
              'Kui kasutad üht faili, eralda lood pealkirja ja ruumiga.',
              'Kontrolli enne printi, et plokid ei seguneks.',
            ],
          },
          {
            q: "Kas samale lehele saab paigutada erineva režiimiga noote (traditional, pedagogical Jo-Le-Mi, figuurnotatsioon)?",
            steps: [
              'Reziimid on eraldi loogikaga ja tavaliselt kasutatakse neid eraldi.',
              'Kui vajad võrdlust, kasuta eraldi lõike/versioone.',
              'Hoia igas lõigus üks juhtreziim.',
              'Kontrolli renderit ja eksporti, et segareziim ei lõhuks paigutust.',
            ],
            images: [
              { src: '/reference/handbells-notation-example.svg', caption: 'Alternatiivse notatsioonistiili näide' },
            ],
          },
          {
            q: 'Kas saan mitu eraldi tööd koondada ühte printitavasse töölehte?',
            steps: [
              'Jah. Ava “Minu tööd” alt Lehekoostaja.',
              'Lisa sinna vajalikud .nm tööd plokkidena.',
              'Paiguta plokid mitmele lehele ja lisa vajadusel tekstikaste.',
              'Ekspordi koond-PDF või prindi otse Lehekoostajast.',
            ],
          },
          {
            q: 'Kuidas lisame jooksvalt uusi küsimusi?',
            steps: [
              'Lisa iga uue teema kohta üks Q&A kirje.',
              'Kirjuta 3-4 sammu järjekorras.',
              'Lisa võimalusel 1-2 pilti.',
              'Hoiame seda lehte kui elavat kasutajajuhendit.',
            ],
          },
        ],
      },
    ],
  },
  en: {
    pageTitle: 'How to? (Kuidas?)',
    backToApp: 'Back to app',
    intro: 'Core user questions and practical answers in one place.',
    openGuide: 'Open guide',
    closeGuide: 'Close',
    stepsTitle: 'Steps',
    visualsTitle: 'Visuals',
    sections: [
      {
        title: 'Getting started',
        qa: [
          {
            q: 'How do I start a new score?',
            a: 'On the landing page choose Demo or sign in. Then open “My work” and click “New work”.',
          },
          {
            q: 'Can I use Noodimeister without an account?',
            a: 'Yes, demo mode works without an account. Cloud save and full work management require sign-in.',
          },
        ],
      },
      {
        title: 'Input and notation modes',
        qa: [
          {
            q: 'How do I enter notes with keyboard?',
            a: 'Choose input duration first (for example 1-5), then enter notes with A-G. The cursor advances in time.',
          },
          {
            q: 'How do I enter unpitched percussion rhythms in pedagogical mode?',
            a: 'Select an unpitched Orff percussion instrument and rhythm value first. On Mac/PC use physical keyboard letters A-G; on touch devices use the “Insert rhythm” button.',
          },
          {
            q: 'How do I switch notation mode?',
            a: 'Use the tools to choose traditional, figurenotes, or pedagogical. Modes use separate notation rules.',
          },
          {
            q: 'What if cursor behavior feels incorrect?',
            a: 'Confirm the selected duration and check if any selection is active. Clear selection and retry input.',
          },
        ],
      },
      {
        title: 'Text, works, and import',
        qa: [
          {
            q: 'How do I use the Text tool?',
            a: 'Select “Text”, drag over the exact target area on score page, type the content, then verify it does not overlap notes/chords/lyrics and matches PDF/print preview.',
          },
          {
            q: 'How do I place a text box precisely?',
            a: 'Drag over the target area on the score page. The text box is created exactly in that selected region.',
          },
          {
            q: 'How do I manage files safely?',
            a: 'Use “My work” for rename/move/delete. Avoid editing the same file in multiple tabs at once.',
          },
          {
            q: 'Can I import MusicXML or PDF?',
            a: 'Yes. Import from “My work”, then verify meter, key signature, staff content, and text placements.',
          },
        ],
      },
      {
        title: 'Cloud save, export, and print',
        qa: [
          {
            q: 'How do I save to cloud?',
            a: 'Sign in and connect Google Drive or OneDrive. In conflicts prefer duplicate/version, not silent overwrite.',
          },
          {
            q: 'How do I export PDF or print?',
            a: 'Use export/print in editor and verify preview before final output.',
          },
          {
            q: 'How do I listen to / play back a finished song?',
            steps: [
              'Open your work on the score page so the notes are visible.',
              'In the top bar press “Play” — playback starts from the cursor.',
              'Set BPM for tempo (in the Score player window or related settings).',
              'For more controls open “Noodigraafika mängija” / Score player (Play, Pause, Stop, Step).',
              'Use Pause or Stop to halt; Stop usually returns the cursor to the start.',
              'In pedagogical mode D (interactive) you also get background audio and the media toolbar; for a normal listen, Play / Score player is enough.',
            ],
          },
          {
            q: 'Why is Animation Record greyed out?',
            a: 'Recording is enabled only after turning on Live preview area and drawing the dashed scene rectangle on the score page.',
          },
          {
            q: 'Why does preview look different from score page?',
            a: 'Usually page format/layout settings differ. Check orientation, margins, and system spacing options.',
          },
        ],
      },
      {
        title: 'Account and troubleshooting',
        qa: [
          {
            q: 'How do I reset my password?',
            a: 'Password reset is for local email+password accounts. Google/Microsoft password resets happen in their own services.',
          },
          {
            q: 'What if login fails?',
            a: 'Retry in the same browser, check popup blocking, and ensure correct account. If needed, sign out and start login again.',
          },
          {
            q: 'What if something still does not work?',
            a: 'Refresh and retry the same step. If issue persists, contact info@la-stravaganza.com with short repro steps.',
          },
          {
            q: 'Can I combine multiple finished works into one worksheet PDF?',
            a: 'Yes. Open Page Composer from My Work, add multiple works as blocks, arrange them across pages, then export one combined PDF.',
          },
        ],
      },
    ],
  },
  fi: {
    pageTitle: 'Miten? (How to?)',
    backToApp: 'Takaisin sovellukseen',
    intro: 'Keskeiset käyttäjäkysymykset ja käytännölliset vastaukset.',
    openGuide: 'Avaa ohje',
    closeGuide: 'Sulje',
    stepsTitle: 'Vaiheet',
    visualsTitle: 'Visuaalit',
    sections: [
      {
        title: 'Aloitus',
        qa: [
          {
            q: 'Miten aloitan uuden nuottityön?',
            a: 'Aloitussivulla valitse Demo tai kirjaudu sisään. Avaa sitten “Omat työt” ja valitse “Uusi työ”.',
          },
          {
            q: 'Voinko käyttää palvelua ilman tiliä?',
            a: 'Kyllä, demo toimii ilman tiliä. Pilvitallennus ja laajempi tiedostohallinta vaativat kirjautumisen.',
          },
        ],
      },
      {
        title: 'Syöttö ja tilat',
        qa: [
          {
            q: 'Miten syötän nuotteja näppäimistöllä?',
            a: 'Valitse ensin kesto (esim. 1-5) ja syötä sävelet kirjaimilla A-G. Kursori etenee ajassa.',
          },
          {
            q: 'Miten syötän virittämättömien lyömäsoittimien rytmit pedagogisessa tilassa?',
            a: 'Valitse ensin Orffin virittämätön lyömäsoitin ja rytmiarvo. Mac/PC:llä syötä kirjaimilla A-G, kosketuslaitteella käytä “Lisää rytmi” -painiketta.',
          },
          {
            q: 'Miten vaihdan nuotinnustilaa?',
            a: 'Valitse traditional, figurenotes tai pedagogical. Tilat ovat erillisiä ja käyttävät omia sääntöjään.',
          },
          {
            q: 'Mitä teen, jos kursori liikkuu oudosti?',
            a: 'Tarkista valittu kesto ja mahdollinen aktiivinen valinta. Poista valinta ja kokeile uudelleen.',
          },
        ],
      },
      {
        title: 'Teksti, tiedostot ja tuonti',
        qa: [
          {
            q: 'Miten käytän Text-työkalua?',
            a: 'Valitse “Text”, vedä nuottisivulla tarkka alue, kirjoita sisältö ja varmista lopuksi, ettei tekstilaatikko peitä nuotteja/sointuja/sanoitusta sekä että asettelu vastaa PDF-/tulostusesikatselua.',
          },
          {
            q: 'Miten lisään tekstilaatikon tarkasti?',
            a: 'Vedä hiirellä haluttu alue nuottisivulla. Tekstilaatikko luodaan juuri siihen kohtaan.',
          },
          {
            q: 'Miten hallitsen tiedostoja turvallisesti?',
            a: 'Käytä “Omat työt” näkymää nimeämiseen, siirtämiseen ja poistamiseen. Vältä saman tiedoston muokkausta useassa välilehdessä.',
          },
          {
            q: 'Voinko tuoda MusicXML- tai PDF-tiedoston?',
            a: 'Kyllä. Tuo tiedosto “Omat työt” -näkymästä ja tarkista sen jälkeen tahtilaji, sävellaji, rivit ja tekstit.',
          },
        ],
      },
      {
        title: 'Pilvitallennus, vienti ja tulostus',
        qa: [
          {
            q: 'Miten tallennan pilveen?',
            a: 'Kirjaudu sisään ja yhdistä Google Drive tai OneDrive. Ristiriidassa käytä mieluummin kopiota tai versiota.',
          },
          {
            q: 'Miten vien PDF:n tai tulostan?',
            a: 'Käytä editorin vienti-/tulostustoimintoa ja tarkista esikatselu ennen lopullista tulostusta.',
          },
          {
            q: 'Miten kuuntelen / toistan valmiin kappaleen?',
            steps: [
              'Avaa työ nuottisivulla, jotta nuotit näkyvät.',
              'Yläpalkissa paina “Play” — toisto alkaa kursorin kohdasta.',
              'Aseta tempo BPM:llä (nuottisoittimen ikkunassa tai asetuksissa).',
              'Lisäohjaimia varten avaa “Noodigraafika mängija” / nuottisoitin (Play, Pause, Stop, Step).',
              'Pysäytä Pause- tai Stop-painikkeella; Stop yleensä palauttaa kursorin alkuun.',
              'Pedagogisessa tilassa D (interaktiivinen) on myös taustaääni ja media-toolbar; tavalliseen kuunteluun riittää Play / nuottisoitin.',
            ],
          },
          {
            q: 'Miksi Animation Record on harmaa?',
            a: 'Tallennus aktivoituu vasta, kun Live preview -alue on päällä ja katkoviivainen kohtausalue on piirretty nuottisivulle.',
          },
          {
            q: 'Miksi esikatselu näyttää erilaiselta kuin nuottisivu?',
            a: 'Usein syynä on sivu- tai asetteluasetus. Tarkista suunta, marginaalit ja järjestelmävälit.',
          },
        ],
      },
      {
        title: 'Tili ja ongelmatilanteet',
        qa: [
          {
            q: 'Miten palautan salasanan?',
            a: 'Salasanan palautus koskee paikallista sähköposti+salasana-tiliä. Google/Microsoft-salasanat palautetaan niiden omissa palveluissa.',
          },
          {
            q: 'Mitä teen, jos kirjautuminen epäonnistuu?',
            a: 'Yritä uudelleen samassa selaimessa, tarkista ponnahdusikkunoiden esto ja oikea tili. Tarvittaessa kirjaudu ulos ja aloita alusta.',
          },
          {
            q: 'Mitä jos jokin ei vieläkään toimi?',
            a: 'Päivitä sivu ja toista sama vaihe. Jos ongelma jatkuu, kirjoita osoitteeseen info@la-stravaganza.com.',
          },
          {
            q: 'Voinko yhdistää useita töitä yhdeksi työlehti-PDF:ksi?',
            a: 'Kyllä. Avaa sivukoostaja Omat työt -näkymästä, lisää useita töitä lohkoina, järjestä sivuille ja vie yksi koottu PDF.',
          },
        ],
      },
    ],
  },
};

/** @param {string} [locale] */
export function getHowToGuideContent(locale) {
  const normalized = String(locale || '').toLowerCase();
  if (normalized.startsWith('et')) return HOW_TO_GUIDE_CONTENT.et;
  if (normalized.startsWith('fi')) return HOW_TO_GUIDE_CONTENT.fi;
  return HOW_TO_GUIDE_CONTENT.en;
}

/** Flatten all Q&A entries for matching. */
export function listHowToGuideEntries(locale) {
  const content = getHowToGuideContent(locale);
  const entries = [];
  for (const section of content.sections || []) {
    for (const item of section.qa || []) {
      const steps = Array.isArray(item.steps) && item.steps.length
        ? item.steps
        : (item.a ? [item.a] : []);
      entries.push({
        question: item.q,
        steps,
        images: item.images || [],
        sectionTitle: section.title,
      });
    }
  }
  return entries;
}
