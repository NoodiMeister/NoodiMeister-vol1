/**
 * Kordusmärkide (playback) loogika: repeat start/end, volta, segno, coda.
 * Tagastab mängitava taktide/noodide jada, arvestades kordusi.
 */

/**
 * Arvuta playback-jada (taktide indeksid) measures ja repeat-märkide põhjal.
 * @param {Array} measures - taktid (võivad sisaldada repeatStart, repeatEnd, volta1, volta2, segno, coda)
 * @returns {number[]} taktide indeksid järjekorras, nagu neid mängitakse
 */
export function getPlaybackMeasureOrder(measures) {
  if (!measures?.length) return [];
  const order = [];
  let i = 0;
  let inFirstEnding = false;
  let inSecondEnding = false;
  while (i < measures.length) {
    const m = measures[i];
    if (m.repeatEnd && inFirstEnding) {
      inFirstEnding = false;
      inSecondEnding = true;
      i = findRepeatStart(measures, i) ?? 0;
      continue;
    }
    if (m.repeatEnd && inSecondEnding) {
      inSecondEnding = false;
      i++;
      continue;
    }
    if (m.repeatStart && !inFirstEnding && !inSecondEnding) {
      inFirstEnding = true;
    }
    order.push(i);
    i++;
  }
  return order;
}

function findRepeatStart(measures, beforeIndex) {
  for (let j = beforeIndex - 1; j >= 0; j--) {
    if (measures[j].repeatStart) return j;
  }
  return null;
}

/**
 * Tagastab noodid playback-jadas (repeat/volta arvestatud). 
 * Lihtne versioon: kui taktid on repeatStart/repeatEnd vahel, mängi neid kaks korda.
 */
export function getNotesInPlaybackOrder(measures, notesByMeasure) {
  const order = getPlaybackMeasureOrder(measures);
  const result = [];
  let beatOffset = 0;
  for (const measureIdx of order) {
    const notes = notesByMeasure[measureIdx] || [];
    notes.forEach((n) => result.push({ ...n, beat: beatOffset + (n.beat ?? 0) }));
    const measure = measures[measureIdx];
    const beats = measure?.beatCount ?? 4;
    beatOffset += beats;
  }
  return result;
}
