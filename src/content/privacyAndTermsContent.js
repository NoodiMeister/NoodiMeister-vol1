/**
 * Privaatsus- ja kasutustingimuste tekstid (üks allikas: /privaatsus, /tingimused, Teave leht).
 */

import { LOCALE_STORAGE_KEY, DEFAULT_LOCALE } from '../i18n.js';

export const PRIVACY_BODY = {
  et: [
    '1. Mida Noodimeister töötleb',
    'Noodimeister töötleb kasutaja kontoga seotud põhiandmeid (nt e-post, nimi, sisselogimise pakkuja), et võimaldada sisselogimist ja kasutajakogemuse isikupärastamist.',
    'Rakenduses loodud noodifailid salvestatakse kasutaja valiku alusel: kas kasutaja pilvekontole (Google Drive või Microsoft OneDrive), või kasutaja enda seadmesse/eksportfailina.',
    '2. Sisselogimine ja identiteet',
    'Toetatud sisselogimine: Google OAuth, Microsoft OAuth (Microsoft Entra / Microsoft konto), lokaalne konto (rakenduse sees).',
    'Konto identiteet käsitletakse pakkuja ja e-posti kombinatsioonina (provider + email), et vältida erinevate teenusepakkujate kontode vaikimisi kokkuliitmist.',
    '3. Pilveintegratsioon (Google Drive / OneDrive)',
    'Kui kasutaja ühendab pilvekonto, küsib rakendus OAuth õigusi failide lugemiseks ja/või salvestamiseks. Õigused sõltuvad valitud teenusest ja kasutusvoost (nt lugemine vs kirjutamine).',
    'Noodimeister kasutab OneDrive\'i puhul Microsoft Graph API-d ning teeb päringuid kasutaja enda failiruumi kontekstis (/me/...), näiteks: profiili lugemine (/me), failide/kaustade loetlemine, faili sisu lugemine/salvestamine, kaustade loomine ja failide ümbernimetamine/teisaldamine kasutaja käsul.',
    '4. Kohalik salvestus brauseris',
    'Rakendus salvestab brauseri localStorage\'isse tehnilisi seansiandmeid, näiteks: sisselogitud kasutaja profiili põhiinfo, OAuth access tokeni ja kehtivusaja, antud õiguste (scope) info, kasutaja eelistused (nt salvestuskausta eelistused).',
    'Need andmed asuvad kasutaja brauseris. Väljalogimisel eemaldatakse autentimis- ja tokeniandmed rakenduse salvestusest.',
    '5. Turvapraktikad',
    'Andmevahetus pilveteenustega toimub HTTPS ühenduse kaudu. OAuth vood kasutavad teenusepakkujate ametlikke autentimislahendusi. Tokenite kehtivust kontrollitakse ning aegunud tokenite korral nõutakse uuesti autentimist. Pilvefailide uuendamisel kasutatakse konfliktikontrolli, et vältida vaikimisi ülekirjutamist olukorras, kus fail on vahepeal mujal muudetud.',
    '6. Admin-funktsioonid',
    'Rakenduses on piiratud administraatori API-d (nt toe haldus), mis on kaitstud administraatori autentimisega. Need funktsioonid ei ole mõeldud tavakasutaja tööde sirvimiseks ega õpetaja/õpilase failisisu töötlemiseks.',
    '7. Mida me ei väida',
    'Noodimeister ei väida käesoleval hetkel, et teenus oleks sertifitseeritud Microsofti ametlikus rakenduste galeriis ega et kõik avaliku sektori nõuded oleksid automaatselt täidetud. Asutuse tenantisse lubamine toimub alati asutuse riskihinnangu alusel.',
    '8. Kontakt',
    'Andmekaitse- ja turvaküsimustes palume ühendust võtta: Rakendust haldab La Stravaganza OÜ, Reg.kood: 17007727, Rakenduse haldaja e-post: info@la-stravaganza.com, Arendaja: Raido Lill.',
  ],
  en: [
    '1. What Noodimeister processes',
    'Noodimeister processes core data linked to your account (for example email, name, and sign-in provider) to enable authentication and personalise the experience.',
    'Scores created in the app are saved as you choose: to your cloud account (Google Drive or Microsoft OneDrive), or to your device as an export file.',
    '2. Sign-in and identity',
    'Supported sign-in: Google OAuth, Microsoft OAuth (Microsoft Entra / Microsoft account), and a local account (in-app).',
    'Account identity is treated as provider + email, so accounts from different providers are not automatically merged.',
    '3. Cloud integration (Google Drive / OneDrive)',
    'When you connect a cloud account, the app requests OAuth permissions to read and/or store files, depending on the service and the workflow.',
    'For OneDrive, Noodimeister uses the Microsoft Graph API in your own file context (/me/...), for example: profile read (/me), list files/folders, read/save file content, create folders, and rename or move files at your request.',
    '4. Local storage in the browser',
    'The app may store session data in browser localStorage, such as: basic profile, OAuth access token and expiry, granted scopes, and preferences (e.g. save-folder choices).',
    'This data stays in your browser. On sign-out, authentication and token data are removed from the app’s storage.',
    '5. Security practices',
    'Data exchange with cloud services uses HTTPS. OAuth flows use the providers’ official sign-in. Token validity is checked; expired tokens require sign-in again. When updating cloud files, the app uses conflict handling to avoid silently overwriting a file that changed elsewhere.',
    '6. Admin features',
    'A limited set of admin APIs (e.g. support management) is protected by admin sign-in. These features are not intended to browse end-user projects or read teacher/pupil file content.',
    '7. What we do not claim',
    'Noodimeister does not claim that the service is certified in Microsoft’s official app gallery, or that all public-sector requirements are automatically met. Allowing the app in an organisation tenant is always a matter of that organisation’s risk assessment.',
    '8. Contact',
    'For data protection and security: La Stravaganza OÜ, registry code 17007727, info@la-stravaganza.com. Developer: Raido Lill.',
  ],
  fi: [
    '1. Mitä Noodimeister käsittelee',
    'Noodimeister käsittelee käyttäjätiliin liittyviä perustietoja (esim. sähköposti, nimi, kirjautumisen tarjoaja), jotta kirjautuminen ja käyttäjäkokemuksen personointi on mahdollista.',
    'Sovelluksessa luodut nuottitiedostot tallennetaan käyttäjän valinnan mukaan joko käyttäjän pilvitilille (Google Drive tai Microsoft OneDrive) tai käyttäjän omalle laitteelle / vientitiedostona.',
    '2. Kirjautuminen ja identiteetti',
    'Tuetut kirjautumistavat: Google OAuth, Microsoft OAuth (Microsoft Entra / Microsoft-tili), paikallinen tili (sovelluksen sisällä).',
    'Tilin identiteetti käsitellään palveluntarjoajan ja sähköpostin yhdistelmänä (provider + email), jotta eri palveluntarjoajien tilejä ei yhdistetä oletuksena.',
    '3. Pilvi-integraatio (Google Drive / OneDrive)',
    'Kun käyttäjä yhdistää pilvitilin, sovellus pyytää OAuth-oikeuksia tiedostojen lukemiseen ja/tai tallentamiseen. Oikeudet riippuvat valitusta palvelusta ja käyttötilanteesta (esim. lukeminen vs kirjoittaminen).',
    'OneDriven kohdalla Noodimeister käyttää Microsoft Graph API:a ja tekee kyselyitä käyttäjän omassa tiedostotilakontekstissa (/me/...), esimerkiksi: profiilin luku (/me), tiedostojen/kansioiden listaus, tiedoston sisällön luku/tallennus, kansioiden luonti sekä tiedostojen uudelleennimeäminen/siirtäminen käyttäjän pyynnöstä.',
    '4. Paikallinen tallennus selaimessa',
    'Sovellus tallentaa selaimen localStorageen teknisiä istuntotietoja, esimerkiksi: kirjautuneen käyttäjän profiilin perustiedot, OAuth access tokenin ja voimassaoloajan, annettujen oikeuksien (scope) tiedot sekä käyttäjän asetuksia (esim. tallennuskansiovalinnat).',
    'Nämä tiedot sijaitsevat käyttäjän selaimessa. Uloskirjautumisen yhteydessä todennus- ja token-tiedot poistetaan sovelluksen tallennuksesta.',
    '5. Tietoturvakäytännöt',
    'Tiedonsiirto pilvipalveluihin tapahtuu HTTPS-yhteydellä. OAuth-virrat käyttävät palveluntarjoajien virallisia todennusratkaisuja. Tokenien voimassaolo tarkistetaan, ja vanhentuneet tokenit vaativat uudelleentodennuksen. Pilvitiedostojen päivityksessä käytetään ristiriitatarkistusta, jotta oletusarvoinen ylikirjoitus vältetään tilanteessa, jossa tiedostoa on muutettu muualla.',
    '6. Ylläpitotoiminnot',
    'Sovelluksessa on rajattuja ylläpitäjän API-toimintoja (esim. tuen hallinta), jotka on suojattu ylläpitäjän todennuksella. Nämä toiminnot eivät ole tarkoitettu tavallisen käyttäjän töiden selaamiseen tai opettajan/oppilaan tiedostosisällön käsittelyyn.',
    '7. Mitä emme väitä',
    'Noodimeister ei tällä hetkellä väitä, että palvelu olisi sertifioitu Microsoftin virallisessa sovellusgalleriassa tai että kaikki julkisen sektorin vaatimukset täyttyisivät automaattisesti. Organisaation tenant-käyttöönotto tapahtuu aina organisaation oman riskiarvion perusteella.',
    '8. Yhteystiedot',
    'Tietosuoja- ja tietoturvakysymyksissä ota yhteyttä: Sovellusta ylläpitää La Stravaganza OÜ, Y-tunnus: 17007727, ylläpidon sähköposti: info@la-stravaganza.com, kehittäjä: Raido Lill.',
  ],
};

export const TERMS_BODY = {
  et: [
    '1. Üldine',
    'Need kasutustingimused kehtivad Noodimeisteri veebirakenduse (edaspidi „teenus”) kasutamisel. Teenust osutab La Stravaganza OÜ (edaspidi „teenuseosutaja”), registrisse kantud Eesti Vabariigis, registrikood 17007727, kontakt: info@la-stravaganza.com. Rakendust arendab Raido Lill.',
    '2. Teenuse sisu',
    'Noodimeister on veebis töötav noodigraafika ja õpetamistööriist (sh eri notatsioonirežiimid). Täpne funktsionaalsus sõltub teenuse arendushetkest; demoversioonis võidakse teatud funktsioone piirata.',
    '3. Konto ja kasutajakohustused',
    'Konto loomisega või teenuse kasutamisega nõustud, et oled teadlik vastutusest, mis tuleneb sisselogimisest. Kasutad teenust eesmärgipäraselt, ei tee kuritarvitusi ega püüa moonutada teiste kasutajate või serveri terviklikkust.',
    '4. Sisu ja hoiustamine',
    'Loodud noodiprojektide salvestuskoht (kohaliku seadme, eksportfail, Google Drive, Microsoft OneDrive jms) on sinu valik vastavalt rakenduse pakkumistele. Pilveteenustega (Google, Microsoft) kehtivad nende teenuste tingimused ja nende privaatsuspoliitikad; Noodimeister on OAuth kaudu nende teenustega seotud ainult nii, nagu eraldi on kirjeldatud (vt ka privaatsusleht).',
    '5. Intellektuaalomand',
    'Noodimeisteri tarkvara, sh kasutajaliides ja märkide joonistus, kuulub teenuseosutajale või talle litsentsi andnud isikutele. Sina säilitad omandiõiguse sisule, mida oled loojana sisestanud (kui seadus ei sätesta teisiti), ning vastutad loodud materjalide sisu eest.',
    '6. Garantiid ja vastuutus',
    'Teenust pakutakse „nagu on” ulatuses, mida toode võimaldab. Kui oled tundliku õiguse, kooli- või tervisandmete puhul, hinda organisatsiooni nõudeid eraldi. Noodimeister ega La Stravaganza OÜ vastuta kaudse kahju, saamata jäänud tulu ega tarkvara vigade tagajärjel tekkinud otsesete või kaudsete tagajärgede eest, ulatuses, mida seadus lubab piirata.',
    '7. Muudatused',
    'Teenust, hinda ja neid tingimusi võidakse ajapikku muuta. Uuendustest teavitatakse võimalusel lehel /teave või (olulise muutuse korral) muul mõistlikul viisil. Tarbijal ja muul kasutajal jäävad kehtima seadusjärgse õigusega ettenähtud kaitse.',
    '8. Kohaldatav õigus, vaided ja kontakt',
    'Nende tingimuste suhtes kohaldatakse Eesti Vabariigi õigust, arvestades tarbijakaitsele ja muule seadusega kaitstud normistikule. Vaidlused püütakse lahendada läbirääkimistega. Kontakt: info@la-stravaganza.com',
  ],
  en: [
    '1. General',
    'These terms govern use of the Noodimeister web application (the “service”), provided by La Stravaganza OÜ (“provider”), registered in the Republic of Estonia, registry code 17007727, contact: info@la-stravaganza.com. The application is developed by Raido Lill.',
    '2. The service',
    'Noodimeister is a web-based notation and teaching tool (including multiple notation modes). Features may evolve over time; a demo or trial may limit certain features.',
    '3. Your account and conduct',
    'By creating an account or using the service, you accept responsibility for activities under your sign-in. You use the service lawfully, without abuse, and without attempting to harm other users, data, or infrastructure.',
    '4. Your content and storage',
    'Where to store projects (this device, export file, Google Drive, Microsoft OneDrive, etc.) is your choice within what the app offers. Third-party cloud services apply their own terms and privacy policies; Noodimeister connects via OAuth as described in our privacy information.',
    '5. Intellectual property',
    'Noodimeister’s software, UI, and visual rendering belong to the provider or its licensors. You keep rights in content you create, subject to applicable law, and you are responsible for the material you enter.',
    '6. Warranties and liability',
    'The service is provided “as is” within the product’s current capabilities. Institutions handling sensitive or regulated data should make their own assessment. To the maximum extent allowed by law, the provider is not liable for indirect loss, loss of profit, or consequences of software defects, except where liability cannot be excluded by mandatory law.',
    '7. Changes',
    'The provider may change the service, these terms, or commercial terms. Material updates may be announced on /teave or in-app. Continued use may, where and as required by law, constitute acceptance of new terms, without prejudice to your mandatory consumer rights.',
    '8. Law and contact',
    'Estonian law governs, without limiting mandatory consumer protections. Disputes should first be resolved in good faith; if needed, the competent court or consumer body in your jurisdiction. Contact: info@la-stravaganza.com',
  ],
  fi: [
    '1. Yleistä',
    'Nämä käyttöehdot koskevat Noodimeister-verkkosovelluksen (”palvelu”) käyttöä. Palvelun tarjoaa La Stravaganza OÜ (Viro, Y-tunnus 17007727, yhteys: info@la-stravaganza.com). Kehitys: Raido Lill.',
    '2. Palvelu',
    'Noodimeister on verkossa toimiva nuotinnus- ja opetustyökalu. Ominaisuudet voivat muuttua; demossa osa voi olla rajoitettu.',
    '3. Tili ja käytös',
    'Luomalla tilin ja käyttämällä palvelua sitoudut lailliseen, vastuulliseen käyttöön ilman väärinkäyttöä ja ilman pyrkimystä haitata muita.',
    '4. Sisällöt ja tallennus',
    'Mihin teokset tallennetaan (laite, vienti, Google Drive, OneDrive) riippuu valinnoistasi; kolmansien osapuolten palveluihin sovelletaan niiden ehtoja. OAuth-kuvauksen löydät tietosuojasivulta.',
    '5. Immateriaalioikeudet',
    'Noodimeister-ohjelmisto ja näyttö kuuluvat toimittajalle tai lisenssinantajille. Luomaasi aineistoa hallitsevat lakisääteiset oikeudet; vastaat itse aineistosta.',
    '6. Vastuunrajoitus',
    'Palvelu on tarjolla “sellaisenaan”. Mahdollisimman laajasti lain salliessaan toimittaja ei vastaa epäsuorista vahingoista tai katoavasta voitosta, muuten kuin pakottava laki edellyttää.',
    '7. Muutokset',
    'Toimittaja voi muuttaa palvelua ja ehtoja; merkittävistä muutoksista voidaan ilmoittaa /teave-sivulla. Pakottavat kuluttajaoikeudet säilyvät.',
    '8. Sovellettava laki ja yhteystiedot',
    'Eesti oikeus sovelletaan, rajoittamatta pakotettavia kuluttajasääntöjä. Erimielisyydet ensisijaisesti neuvotteluin, tarvittaessa toimivaltaiset viranomaiset/tuomioistuin. Sähköposti: info@la-stravaganza.com',
  ],
};

const TITLES = {
  privacy: {
    et: { page: 'Privaatsus', relatedLink: { href: '/tingimused', label: 'Kasutustingimused' } },
    en: { page: 'Privacy', relatedLink: { href: '/tingimused', label: 'Terms of service' } },
    fi: { page: 'Tietosuoja', relatedLink: { href: '/tingimused', label: 'Käyttöehdot' } },
  },
  terms: {
    et: { page: 'Kasutustingimused', relatedLink: { href: '/privaatsus', label: 'Privaatsus' } },
    en: { page: 'Terms of service', relatedLink: { href: '/privaatsus', label: 'Privacy' } },
    fi: { page: 'Käyttöehdot', relatedLink: { href: '/privaatsus', label: 'Tietosuoja' } },
  },
};

function pickLocale(normalized) {
  if (normalized.startsWith('et')) return 'et';
  if (normalized.startsWith('fi')) return 'fi';
  return 'en';
}

/** Brauseri keelesätte põhine võti: et | en | fi */
export function getContentLocaleKey() {
  try {
    return pickLocale(String(localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE).toLowerCase());
  } catch {
    return 'en';
  }
}

export function getPrivacyPageCopy(normalizedLocale) {
  const key = pickLocale(String(normalizedLocale).toLowerCase());
  return {
    pageTitle: TITLES.privacy[key].page,
    related: TITLES.privacy[key].relatedLink,
    body: PRIVACY_BODY[key],
  };
}

export function getTermsPageCopy(normalizedLocale) {
  const key = pickLocale(String(normalizedLocale).toLowerCase());
  return {
    pageTitle: TITLES.terms[key].page,
    related: TITLES.terms[key].relatedLink,
    body: TERMS_BODY[key],
  };
}
