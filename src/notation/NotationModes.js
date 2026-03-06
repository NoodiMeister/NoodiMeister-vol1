/**
 * Notatsioonirežiimide konstandid – kolm isoleeritud vaadet.
 * Ei impordi Figurenotes ega Pedagoogilist loogikat; vaated kasutavad neid eraldi.
 */

/** Globaalsed vaate režiimid (ViewSwitcher valib nende põhjal). */
export const VIEW_TRADITIONAL = 'TRADITIONAL';
export const VIEW_FIGURENOTES = 'FIGURENOTES';
export const VIEW_PEDAGOGICAL = 'PEDAGOGICAL';

export const NOTATION_VIEW_MODES = [VIEW_TRADITIONAL, VIEW_FIGURENOTES, VIEW_PEDAGOGICAL];

/** Instrumendi/rea režiim (T/F/P) – iga joonestik võib oma režiimiga. */
export const MODE_TRADITIONAL = 'traditional';
export const MODE_FIGURENOTES = 'figurenotes';
export const MODE_PEDAGOGICAL = 'pedagogical';

export const INSTRUMENT_NOTATION_MODES = [MODE_TRADITIONAL, MODE_FIGURENOTES, MODE_PEDAGOGICAL];

export function isTraditionalView(viewMode) {
  return viewMode === VIEW_TRADITIONAL;
}

export function isFigurenotesView(viewMode) {
  return viewMode === VIEW_FIGURENOTES;
}

export function isPedagogicalView(viewMode) {
  return viewMode === VIEW_PEDAGOGICAL;
}

/** Kas režiim on traditsiooniline (Leland, noodivõtmed). */
export function isTraditionalMode(mode) {
  return mode === MODE_TRADITIONAL;
}

/** Kas režiim on figuurnotatsioon (absoluutne C=punane ruut, rütm = laius). */
export function isFigurenotesMode(mode) {
  return mode === MODE_FIGURENOTES;
}

/** Kas režiim on pedagoogiline (liikuv JO-võti, värvid JO suhtes). */
export function isPedagogicalMode(mode) {
  return mode === MODE_PEDAGOGICAL;
}
