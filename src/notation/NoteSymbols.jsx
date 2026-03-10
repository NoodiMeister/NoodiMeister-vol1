import React from 'react';
import {
  STAFF_SPACE,
  getNoteheadRx,
  getStemLength,
  getStemThickness,
} from './StaffConstants';
import { getGlyphFontSize } from './musescoreStyle';
import { SmuflGlyph } from './smufl/SmuflGlyph';
import { smuflNoteheadForType, smuflPrecomposedNote } from './smufl/glyphs';

/**
 * SMuFL notehead glyph (Leland). Scale from MuseScore/SMuFL: 4 sp per em.
 */
function NoteHeadGlyph({ cx, cy, staffSpace, type }) {
  const glyph = smuflNoteheadForType(type);
  const fontSize = getGlyphFontSize(staffSpace);
  return (
    <SmuflGlyph
      x={cx}
      y={cy}
      glyph={glyph}
      fontSize={fontSize}
      fill="var(--note-fill, #1a1a1a)"
    />
  );
}

/** Single glyph for full note (note+stem+flag) from Leland – use when not beamed. */
function PrecomposedNoteGlyph({ cx, cy, staffSpace, type, stemUp }) {
  const glyph = smuflPrecomposedNote(type, stemUp, true);
  if (!glyph) return null;
  const fontSize = getGlyphFontSize(staffSpace);
  return (
    <SmuflGlyph
      x={cx}
      y={cy}
      glyph={glyph}
      fontSize={fontSize}
      fill="var(--note-fill, #1a1a1a)"
    />
  );
}

/**
 * Vars: Parandatud asukoht, et vars ja pea liituksid sujuvalt.
 * stemLength: valikuline (talatud nootidel dünaamiline pikkus talani).
 */
function Stem({ cx, cy, staffSpace, stemUp, stemLength }) {
  const rx = getNoteheadRx(staffSpace);
  const stemLen = stemLength != null ? stemLength : getStemLength(staffSpace);
  const strokeW = getStemThickness(staffSpace);

  // MuseScore'i reegel: Üles-vars paremal, alla-vars vasakul
  // Nihutame vart pool stroke-laiust sissepoole, et ühendus oleks puhas
  const x = stemUp ? cx + rx - strokeW / 2 : cx - rx + strokeW / 2;
  const y1 = cy;
  const y2 = stemUp ? cy - stemLen : cy + stemLen;

  return (
    <line
      x1={x}
      y1={y1}
      x2={x}
      y2={y2}
      stroke="var(--note-fill, #1a1a1a)"
      strokeWidth={strokeW}
      strokeLinecap="butt" // "butt" tagab puhta ühenduse noodipeaga
    />
  );
}

/**
 * Lipud (Flags): MuseScore'i stiilis kumerad lipud, alati paremale suunatud.
 * stemLength: valikuline (kui talatud nootidel kasutatakse kohandatud varre pikkust).
 */
function Flags({ cx, cy, staffSpace, stemUp, count = 1, stemLength }) {
  const rx = getNoteheadRx(staffSpace);
  const stemLen = stemLength != null ? stemLength : getStemLength(staffSpace);
  const strokeW = getStemThickness(staffSpace);

  const stemX = stemUp ? cx + rx - strokeW / 2 : cx - rx + strokeW / 2;
  const stemEndY = stemUp ? cy - stemLen : cy + stemLen;

  const elements = [];
  const flagGap = staffSpace * 0.8; // Lippude vahe

  for (let i = 0; i < count; i++) {
    const yOffset = i * flagGap * (stemUp ? 1 : -1);
    const startY = stemEndY + yOffset;

    // MuseScore'i lipp on "S" kujuline ja alati tüvest paremal
    // d-string: M (start) c (relative cubic bezier)
    const curve = stemUp
      ? `M ${stemX} ${startY} c ${staffSpace * 0.8} ${staffSpace * 0.2} ${staffSpace * 1.2} ${staffSpace * 1.5} ${staffSpace * 1.2} ${staffSpace * 2.5}`
      : `M ${stemX} ${startY} c ${staffSpace * 0.8} ${-staffSpace * 0.2} ${staffSpace * 1.2} ${-staffSpace * 1.5} ${staffSpace * 1.2} ${-staffSpace * 2.5}`;

    elements.push(
      <path
        key={i}
        d={curve}
        fill="none"
        stroke="var(--note-fill, #1a1a1a)"
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
    );
  }
  return <g>{elements}</g>;
}

// --- Eksporditavad sümbolid ---

export function WholeNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE }) {
  return <NoteHeadGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="whole" />;
}

export function HalfNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true }) {
  return (
    <PrecomposedNoteGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="half" stemUp={stemUp} />
  );
}

export function QuarterNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true, stemLength }) {
  const usePrecomposed = stemLength == null;
  if (usePrecomposed) {
    return <PrecomposedNoteGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="quarter" stemUp={stemUp} />;
  }
  return (
    <g>
      <NoteHeadGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="quarter" />
      <Stem cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} stemLength={stemLength} />
    </g>
  );
}

export function EighthNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true, stemLength, hideFlags }) {
  const usePrecomposed = !hideFlags && stemLength == null;
  if (usePrecomposed) {
    return <PrecomposedNoteGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="eighth" stemUp={stemUp} />;
  }
  return (
    <g>
      <QuarterNoteSymbol cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} stemLength={stemLength} />
      {!hideFlags && <Flags cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} count={1} stemLength={stemLength} />}
    </g>
  );
}

export function SixteenthNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true, stemLength, hideFlags }) {
  const usePrecomposed = !hideFlags && stemLength == null;
  if (usePrecomposed) {
    return <PrecomposedNoteGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="sixteenth" stemUp={stemUp} />;
  }
  return (
    <g>
      <QuarterNoteSymbol cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} stemLength={stemLength} />
      {!hideFlags && <Flags cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} count={2} stemLength={stemLength} />}
    </g>
  );
}

/** Kuuskümnendiknoot (3 lippu) – Leland/SMuFL. */
export function ThirtySecondNoteSymbol({ cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true, stemLength, hideFlags }) {
  const usePrecomposed = !hideFlags && stemLength == null;
  if (usePrecomposed) {
    return <PrecomposedNoteGlyph cx={cx} cy={cy} staffSpace={staffSpace} type="thirtySecond" stemUp={stemUp} />;
  }
  return (
    <g>
      <QuarterNoteSymbol cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} stemLength={stemLength} />
      {!hideFlags && <Flags cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} count={3} stemLength={stemLength} />}
    </g>
  );
}

/**
 * Peamine komponent, mis valib õige sümboli.
 * hideFlags / stemLength: talatud nootidel – lipud peidetud, vars ulatub talani.
 */
export function NoteSymbol({ type, cx = 0, cy = 0, staffSpace = STAFF_SPACE, stemUp = true, stemLength, hideFlags }) {
  const props = { cx, cy, staffSpace, stemUp, stemLength, hideFlags };
  switch (type) {
    case 'whole':
      return <WholeNoteSymbol cx={cx} cy={cy} staffSpace={staffSpace} />;
    case 'half':
      return <HalfNoteSymbol cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} />;
    case 'eighth':
      return <EighthNoteSymbol {...props} />;
    case 'sixteenth':
      return <SixteenthNoteSymbol {...props} />;
    case 'thirtySecond':
      return <ThirtySecondNoteSymbol {...props} />;
    case 'quarter':
    default:
      return <QuarterNoteSymbol cx={cx} cy={cy} staffSpace={staffSpace} stemUp={stemUp} stemLength={stemLength} />;
  }
}

export default NoteSymbol;
