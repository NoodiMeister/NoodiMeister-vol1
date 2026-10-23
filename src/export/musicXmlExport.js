/**
 * MusicXML (score-partwise) eksport Noodimeistri skoorist.
 * Vastab import-voole: noodid, pausid, helistik, taktimõõt, eeltakt, multi-staff (brace), laulusõnad, akordisümbolid.
 */
import { getAccidentalForPitchInKey } from '../utils/notationConstants.js';
import { KEY_SIGNATURE_COUNT_BY_KEY } from '../notation/keySignatureStandard.js';
import { measureLengthInQuarterBeats } from '../musical/timeSignature.js';
import { buildMeasuresWithProps } from '../musical/measureProperties.js';

const DIVISIONS = 8; // 1/32 = 1 division unit
const EPS = 1e-6;

const DURATION_LABEL_TO_TYPE = {
  '1/1': 'whole',
  '1/2': 'half',
  '1/4': 'quarter',
  '1/8': 'eighth',
  '1/16': '16th',
  '1/32': '32nd',
};

const INSTRUMENT_DISPLAY = {
  piano: 'Piano',
  'electric-piano': 'Electric Piano',
  organ: 'Organ',
  harpsichord: 'Harpsichord',
  accordion: 'Accordion',
  celesta: 'Celesta',
  violin: 'Violin',
  viola: 'Viola',
  cello: 'Cello',
  'double-bass': 'Double Bass',
  voice: 'Voice',
  flute: 'Flute',
  recorder: 'Recorder',
  clarinet: 'Clarinet',
  oboe: 'Oboe',
  bassoon: 'Bassoon',
  trumpet: 'Trumpet',
  trombone: 'Trombone',
  tuba: 'Tuba',
  'french-horn': 'French Horn',
  saxophone: 'Saxophone',
  guitar: 'Guitar',
  'single-staff-treble': 'Staff',
  'single-staff-bass': 'Staff',
};

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeExportFileNameStem(raw) {
  const s = String(raw || '')
    .normalize('NFC')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, 120);
}

function stripProjectFileNameForExport(name) {
  return String(name || '').replace(/\.(nm|noodimeister|json|musicxml|xml|pdf)$/i, '').trim();
}

function isUnusableAppLikeExportStem(stem) {
  const s = String(stem || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return true;
  return s === 'noodimeister' || s === 'noodimeistri' || s === 'noodi meister' || s === 'noodimeister-demo' || s === 'nm';
}

/** Allalaadimise failinimi (.musicxml). */
export function getMusicXmlExportFileName(songTitle, cloudFileName, localFileName, untitledLabel = 'score') {
  const fromTitle = sanitizeExportFileNameStem(songTitle);
  if (fromTitle) return `${fromTitle}.musicxml`;
  const fromCloud = sanitizeExportFileNameStem(stripProjectFileNameForExport(cloudFileName));
  if (fromCloud && !isUnusableAppLikeExportStem(fromCloud)) return `${fromCloud}.musicxml`;
  const fromLocal = sanitizeExportFileNameStem(stripProjectFileNameForExport(localFileName));
  if (fromLocal && !isUnusableAppLikeExportStem(fromLocal)) return `${fromLocal}.musicxml`;
  const u = sanitizeExportFileNameStem(untitledLabel) || 'score';
  return `${u}.musicxml`;
}

export function downloadMusicXmlFile(xmlText, fileName) {
  const blob = new Blob([xmlText], { type: 'application/vnd.recordare.musicxml+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'score.musicxml';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function keySignatureToFifths(keySignature) {
  const key = String(keySignature || 'C').trim();
  if (key === 'C') return 0;
  const sharps = KEY_SIGNATURE_COUNT_BY_KEY.sharps[key];
  if (sharps) return sharps;
  const flats = KEY_SIGNATURE_COUNT_BY_KEY.flats[key];
  if (flats) return -flats;
  return 0;
}

function clefToMusicXml(clefType) {
  const c = String(clefType || 'treble').toLowerCase();
  if (c === 'bass') return { sign: 'F', line: 4 };
  if (c === 'alto') return { sign: 'C', line: 3 };
  if (c === 'tenor') return { sign: 'C', line: 4 };
  if (c === 'percussion') return { sign: 'percussion', line: 2 };
  // jo / treble / default
  return { sign: 'G', line: 2 };
}

function durationLabelToType(durationLabel) {
  return DURATION_LABEL_TO_TYPE[String(durationLabel || '1/4')] || 'quarter';
}

function quartersToDivisions(quarters) {
  const q = Number(quarters) || 0;
  return Math.max(0, Math.round(q * DIVISIONS));
}

function materializeNotesWithBeats(notes) {
  let run = 0;
  const out = [];
  for (const n of notes || []) {
    const beat = typeof n?.beat === 'number' ? n.beat : run;
    const dur = Number(n?.duration) || 1;
    out.push({ ...n, beat, duration: dur });
    run = beat + dur;
  }
  return out.sort((a, b) => (a.beat - b.beat) || 0);
}

function groupNotesByStartBeat(timedNotes) {
  const groups = [];
  for (const n of timedNotes) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(last.beat - n.beat) <= EPS) {
      last.notes.push(n);
    } else {
      groups.push({ beat: n.beat, notes: [n] });
    }
  }
  return groups;
}

function restFillSegments(gapQuarters) {
  const ordered = [
    { beats: 4, label: '1/1' },
    { beats: 2, label: '1/2' },
    { beats: 1, label: '1/4' },
    { beats: 0.5, label: '1/8' },
    { beats: 0.25, label: '1/16' },
    { beats: 0.125, label: '1/32' },
  ];
  const out = [];
  let rem = Math.max(0, Number(gapQuarters) || 0);
  while (rem > EPS) {
    const hit = ordered.find((d) => d.beats <= rem + EPS);
    if (!hit) break;
    out.push({ duration: hit.beats, durationLabel: hit.label, isRest: true, isDotted: false });
    rem = Math.round((rem - hit.beats) * 1e6) / 1e6;
    if (out.length > 64) break;
  }
  return out;
}

function partDisplayName(staff) {
  const named = String(staff?.name || '').trim();
  if (named) return named;
  const id = String(staff?.instrumentId || 'piano');
  return INSTRUMENT_DISPLAY[id] || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Grupeeri stavid MusicXML partideks: sama braceGroupId → üks part (mitu staffi).
 */
export function groupStavesIntoParts(staves) {
  const list = Array.isArray(staves) ? staves : [];
  const parts = [];
  const braceSeen = new Map();

  list.forEach((staff) => {
    const braceId = staff?.braceGroupId ? String(staff.braceGroupId) : '';
    if (braceId) {
      if (braceSeen.has(braceId)) {
        const part = braceSeen.get(braceId);
        part.staves.push(staff);
        return;
      }
      const part = {
        partId: `P${parts.length + 1}`,
        name: partDisplayName(staff),
        staves: [staff],
      };
      braceSeen.set(braceId, part);
      parts.push(part);
      return;
    }
    parts.push({
      partId: `P${parts.length + 1}`,
      name: partDisplayName(staff),
      staves: [staff],
    });
  });

  if (!parts.length) {
    parts.push({
      partId: 'P1',
      name: 'Piano',
      staves: [{ instrumentId: 'piano', clefType: 'treble', notes: [] }],
    });
  }
  return parts;
}

function accidentalElement(alter) {
  if (alter === 2) return '<accidental>double-sharp</accidental>';
  if (alter === 1) return '<accidental>sharp</accidental>';
  if (alter === 0) return '<accidental>natural</accidental>';
  if (alter === -1) return '<accidental>flat</accidental>';
  if (alter === -2) return '<accidental>flat-flat</accidental>';
  return '';
}

function renderNoteXml(note, {
  keySignature,
  staffNumber = 1,
  isChord = false,
  voice = 1,
}) {
  const durDiv = Math.max(1, quartersToDivisions(note.duration));
  const type = durationLabelToType(note.durationLabel);
  const dots = note.isDotted ? '<dot/>' : '';
  const staffEl = `<staff>${staffNumber}</staff>`;
  const chordEl = isChord ? '<chord/>' : '';
  const voiceEl = `<voice>${voice}</voice>`;

  if (note.isRest) {
    return [
      '<note>',
      chordEl,
      '<rest/>',
      `<duration>${durDiv}</duration>`,
      voiceEl,
      `<type>${type}</type>`,
      dots,
      staffEl,
      '</note>',
    ].filter(Boolean).join('');
  }

  const step = String(note.pitch || 'C').slice(0, 1).toUpperCase();
  const octave = Number.isFinite(Number(note.octave)) ? Number(note.octave) : 4;
  const keyAlter = getAccidentalForPitchInKey(step, keySignature);
  const hasExplicit = note.accidental !== undefined && note.accidental !== null;
  const alter = hasExplicit ? Number(note.accidental) || 0 : keyAlter;
  const alterEl = alter !== 0 ? `<alter>${alter}</alter>` : '';
  const accidentalEl = hasExplicit ? accidentalElement(Number(note.accidental) || 0) : '';
  const lyricRaw = String(note.lyric || '').trim();
  const lyricEl = lyricRaw
    ? `<lyric number="1"><syllabic>single</syllabic><text>${escapeXml(lyricRaw)}</text></lyric>`
    : '';

  return [
    '<note>',
    chordEl,
    `<pitch><step>${escapeXml(step)}</step>${alterEl}<octave>${octave}</octave></pitch>`,
    `<duration>${durDiv}</duration>`,
    voiceEl,
    `<type>${type}</type>`,
    dots,
    accidentalEl,
    staffEl,
    lyricEl,
    '</note>',
  ].filter(Boolean).join('');
}

function buildStaffMeasureContent(timedNotes, measure, keySignature, staffNumber, voice) {
  const start = measure.startBeat;
  const end = measure.endBeat;
  const inMeasure = timedNotes.filter((n) => n.beat >= start - EPS && n.beat < end - EPS);
  const groups = groupNotesByStartBeat(inMeasure);
  const xmlParts = [];
  let cursor = start;

  for (const group of groups) {
    const gap = group.beat - cursor;
    if (gap > EPS) {
      for (const rest of restFillSegments(gap)) {
        xmlParts.push(renderNoteXml(rest, { keySignature, staffNumber, voice }));
      }
    }
    const primary = group.notes[0];
    const clipDur = Math.min(Number(primary.duration) || 1, Math.max(EPS, end - group.beat));
    xmlParts.push(renderNoteXml(
      { ...primary, duration: clipDur },
      { keySignature, staffNumber, isChord: false, voice },
    ));
    for (let i = 1; i < group.notes.length; i++) {
      const cn = group.notes[i];
      if (cn.isRest) continue;
      xmlParts.push(renderNoteXml(
        { ...cn, duration: clipDur },
        { keySignature, staffNumber, isChord: true, voice },
      ));
    }
    cursor = group.beat + clipDur;
  }

  const tail = end - cursor;
  if (tail > EPS) {
    for (const rest of restFillSegments(tail)) {
      xmlParts.push(renderNoteXml(rest, { keySignature, staffNumber, voice }));
    }
  }

  const writtenDiv = quartersToDivisions(measure.beatCount);
  return { xml: xmlParts.join(''), writtenDiv };
}

function renderHarmonyAtBeat(chord, relativeBeatDiv) {
  const symbol = String(chord?.chord || '').trim();
  if (!symbol) return '';
  const offset = Math.max(0, relativeBeatDiv | 0);
  // Simple root guess from first letter (+ accidental)
  const m = symbol.match(/^([A-Ga-g])([#b]?)/);
  const step = m ? m[1].toUpperCase() : 'C';
  const alter = m?.[2] === '#' ? 1 : m?.[2] === 'b' ? -1 : 0;
  const kindText = symbol.slice(m ? m[0].length : 0) || 'major';
  return [
    '<harmony>',
    offset > 0 ? `<offset>${offset}</offset>` : '',
    `<root><root-step>${escapeXml(step)}</root-step>${alter ? `<root-alter>${alter}</root-alter>` : ''}</root>`,
    `<kind text="${escapeXml(symbol)}">${escapeXml(kindText || 'major')}</kind>`,
    '</harmony>',
  ].filter(Boolean).join('');
}

function barlineXml(measureIndex, totalMeasures, measureRepeatMarks) {
  const marks = measureRepeatMarks?.[measureIndex] || measureRepeatMarks?.[String(measureIndex)] || {};
  const bits = [];
  if (marks.repeatStart) {
    bits.push('<barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
  }
  if (marks.repeatEnd) {
    bits.push('<barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"/></barline>');
  } else if (marks.barlineFinal || measureIndex === totalMeasures - 1) {
    bits.push('<barline location="right"><bar-style>light-heavy</bar-style></barline>');
  } else if (marks.barlineDouble) {
    bits.push('<barline location="right"><bar-style>light-light</bar-style></barline>');
  }
  return bits.join('');
}

/**
 * @param {object} project
 * @returns {string} MusicXML score-partwise document
 */
export function buildMusicXmlFromProject(project = {}) {
  const {
    songTitle = '',
    author = '',
    keySignature = 'C',
    timeSignature = { beats: 4, beatUnit: 4 },
    staves = [],
    chords = [],
    addedMeasures = 0,
    pickupEnabled = false,
    pickupQuantity = 1,
    pickupDuration = '1/4',
    incompleteLastMeasure = false,
    measurePropsByIndex = {},
    measureRepeatMarks = {},
  } = project;

  const parts = groupStavesIntoParts(staves);
  const maxEndBeat = (() => {
    let max = 0;
    for (const staff of staves || []) {
      let run = 0;
      for (const n of staff?.notes || []) {
        const beat = typeof n?.beat === 'number' ? n.beat : run;
        const dur = Number(n?.duration) || 1;
        max = Math.max(max, beat + dur);
        run = beat + dur;
      }
    }
    return max;
  })();

  const measureQuarters = measureLengthInQuarterBeats(timeSignature);
  const minFromNotes = Math.max(1, Math.ceil((maxEndBeat + EPS) / Math.max(0.25, measureQuarters)));
  // Prefer exact measure builder with pickup; estimate total from addedMeasures + content.
  let totalMeasures = Math.max(1, Math.max(1 + (Number(addedMeasures) || 0), minFromNotes));
  // Refine with pickup-aware builder length vs content
  {
    let probe = buildMeasuresWithProps({
      timeSignature,
      totalMeasures,
      pickupEnabled,
      pickupQuantity,
      pickupDuration,
      incompleteLastMeasure,
      measurePropsByIndex,
    });
    while (probe.length && probe[probe.length - 1].endBeat + EPS < maxEndBeat) {
      totalMeasures += 1;
      probe = buildMeasuresWithProps({
        timeSignature,
        totalMeasures,
        pickupEnabled,
        pickupQuantity,
        pickupDuration,
        incompleteLastMeasure,
        measurePropsByIndex,
      });
      if (totalMeasures > 500) break;
    }
  }

  const measures = buildMeasuresWithProps({
    timeSignature,
    totalMeasures,
    pickupEnabled,
    pickupQuantity,
    pickupDuration,
    incompleteLastMeasure,
    measurePropsByIndex,
  });

  const fifths = keySignatureToFifths(keySignature);
  const beats = Number(timeSignature?.beats) || 4;
  const beatUnit = Number(timeSignature?.beatUnit) || 4;
  const title = String(songTitle || '').trim() || 'Untitled';
  const composer = String(author || '').trim();

  const partListXml = parts.map((p) => (
    `<score-part id="${escapeXml(p.partId)}"><part-name>${escapeXml(p.name)}</part-name></score-part>`
  )).join('');

  const partsXml = parts.map((part) => {
    const staffTimed = part.staves.map((s) => materializeNotesWithBeats(s?.notes || []));
    const staffCount = part.staves.length;

    const measuresXml = measures.map((measure, mi) => {
      const attrs = [];
      if (mi === 0) {
        attrs.push(`<divisions>${DIVISIONS}</divisions>`);
        attrs.push(`<key><fifths>${fifths}</fifths></key>`);
        attrs.push(`<time><beats>${beats}</beats><beat-type>${beatUnit}</beat-type></time>`);
        if (staffCount > 1) attrs.push(`<staves>${staffCount}</staves>`);
        part.staves.forEach((staff, si) => {
          const clef = clefToMusicXml(staff?.clefType);
          const numberAttr = staffCount > 1 ? ` number="${si + 1}"` : '';
          attrs.push(
            `<clef${numberAttr}><sign>${clef.sign}</sign><line>${clef.line}</line></clef>`,
          );
        });
      }

      const chunks = [];
      if (attrs.length) chunks.push(`<attributes>${attrs.join('')}</attributes>`);

      // Chord symbols (harmony) on first staff of first part only
      if (part === parts[0]) {
        const inMeasureChords = (chords || [])
          .filter((c) => {
            const b = Number(c?.beatPosition) || 0;
            return b >= measure.startBeat - EPS && b < measure.endBeat - EPS;
          })
          .sort((a, b) => (Number(a.beatPosition) || 0) - (Number(b.beatPosition) || 0));
        for (const c of inMeasureChords) {
          const rel = quartersToDivisions((Number(c.beatPosition) || 0) - measure.startBeat);
          chunks.push(renderHarmonyAtBeat(c, rel));
        }
      }

      let lastWrittenDiv = 0;
      staffTimed.forEach((timed, si) => {
        if (si > 0 && lastWrittenDiv > 0) {
          chunks.push(`<backup><duration>${lastWrittenDiv}</duration></backup>`);
        }
        const { xml, writtenDiv } = buildStaffMeasureContent(
          timed,
          measure,
          keySignature,
          si + 1,
          si + 1,
        );
        chunks.push(xml);
        lastWrittenDiv = writtenDiv;
      });

      chunks.push(barlineXml(mi, measures.length, measureRepeatMarks));

      return `<measure number="${mi + 1}">${chunks.join('')}</measure>`;
    }).join('');

    return `<part id="${escapeXml(part.partId)}">${measuresXml}</part>`;
  }).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">',
    '<score-partwise version="3.1">',
    `<work><work-title>${escapeXml(title)}</work-title></work>`,
    '<identification>',
    composer ? `<creator type="composer">${escapeXml(composer)}</creator>` : '',
    '<encoding><software>Noodimeister</software></encoding>',
    '</identification>',
    `<part-list>${partListXml}</part-list>`,
    partsXml,
    '</score-partwise>',
  ].filter(Boolean).join('');
}
