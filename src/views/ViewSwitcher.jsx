/**
 * ViewSwitcher – valib kolm isoleeritud notatsioonivaadet.
 * TRADITIONAL: Leland (SMuFL), noodivõtmed 4× staffSpace, õigel positsioonil.
 * FIGURENOTES: absoluutne süsteem (C=punane ruut), rütm = kujundi laius (ScaleX).
 * PEDAGOGICAL: liikuv JO-võti (TraditionalNotationView + notationMode vabanotatsioon), värvid JO suhtes (PedagogicalLogic).
 * Ei seosta Figurenotes ja Pedagoogilist loogikat – eraldi failid.
 */
import React from 'react';
import { VIEW_TRADITIONAL, VIEW_FIGURENOTES, VIEW_PEDAGOGICAL } from '../notation/NotationModes';

/**
 * Tagastab vaate tüübi globaalse notationStyle ja notationMode põhjal.
 * notationStyle 'FIGURENOTES' → FIGURENOTES; notationMode 'vabanotatsioon' → PEDAGOGICAL; muul juhul TRADITIONAL.
 */
export function getViewModeFromNotation(notationStyle, notationMode) {
  if (notationStyle === 'FIGURENOTES') return VIEW_FIGURENOTES;
  if (notationMode === 'vabanotatsioon') return VIEW_PEDAGOGICAL;
  return VIEW_TRADITIONAL;
}

/**
 * Ühe rea/staff vaate valik (staff.notationMode).
 */
export function getViewModeForStaff(staffNotationMode, fallbackStyle, fallbackMode) {
  if (staffNotationMode === 'figurenotes') return VIEW_FIGURENOTES;
  if (staffNotationMode === 'pedagogical') return VIEW_PEDAGOGICAL;
  return getViewModeFromNotation(fallbackStyle, fallbackMode);
}

/**
 * Kas praegu kuvatakse figuurnotatsiooni vaade (grid, absoluutsed värvid).
 */
export function isFigurenotesView(notationStyle) {
  return notationStyle === 'FIGURENOTES';
}

/**
 * Kas praegu kuvatakse pedagoogiline vaade (JO-võti, relatiivsed värvid).
 */
export function isPedagogicalView(notationMode) {
  return notationMode === 'vabanotatsioon';
}

export default { getViewModeFromNotation, getViewModeForStaff, isFigurenotesView, isPedagogicalView };
