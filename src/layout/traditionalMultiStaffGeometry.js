/**
 * Traditsioonilise mitme noodijoonestiku vertikaalgeomeetria — üks allikas (MuseScore-laadne sp-mudeli analoog).
 *
 * Mõisted:
 * - staffLineSpanPx: ülemise ja alumise noodijoone vahe ((staffLines−1) × staff-space).
 * - interStaffGapPx: kasutaja määratud vahe 1. staffi alumise joone ja 2. staffi ülemise joone vahel (mm/cm → px).
 * - staffStepPx: vertikaalne samm ühe staffi ankrust järgmise staffi ankruni (= span + gap).
 * - systemTotalHeightPx: esimese staffi ülemisest joonest viimase staffi alumise joone kaugus.
 */

import { STAFF_SPACE } from '../notation/StaffConstants';

/**
 * @param {object} opts
 * @param {number} [opts.staffLines=5]
 * @param {number} [opts.staffSpace=STAFF_SPACE]
 * @returns {number}
 */
export function getTraditionalStaffLineSpanPx({ staffLines = 5, staffSpace = STAFF_SPACE } = {}) {
  const n = Math.max(1, Number(staffLines) || 5);
  return Math.max(0, (n - 1) * staffSpace);
}

/**
 * @param {object} opts
 * @param {number} opts.layoutPartsGapMm
 * @param {number} opts.pxPerMm — lehe laius / paberi laius mm
 * @returns {number}
 */
export function getTraditionalInterStaffGapPx({ layoutPartsGapMm, pxPerMm }) {
  const mm = Math.max(0, Number(layoutPartsGapMm) || 0);
  const ppm = Number(pxPerMm);
  if (!Number.isFinite(ppm) || ppm <= 0) return 0;
  return mm * ppm;
}

/**
 * Vertikaalne samm staffist staffini (timelineHeight / perStaffRowStep).
 * @param {number} staffLineSpanPx
 * @param {number} interStaffGapPx
 */
export function getTraditionalStaffStepPx(staffLineSpanPx, interStaffGapPx) {
  const span = Math.max(0, Number(staffLineSpanPx) || 0);
  const gap = Math.max(0, Number(interStaffGapPx) || 0);
  return span + gap;
}

/**
 * computeLayout staffHeight: ühe “rea” kõrgus mitme staffi skooris.
 * @param {object} opts
 * @param {number} opts.stavesCount
 * @param {number} opts.staffLineSpanPx
 * @param {number} opts.interStaffGapPx
 * @param {() => number} opts.getStaffHeight — üksik staff (1 partii)
 */
export function getTraditionalLayoutStaffHeightPx({ stavesCount, staffLineSpanPx, interStaffGapPx, getStaffHeight }) {
  const n = Math.max(1, Number(stavesCount) || 1);
  if (n <= 1) {
    return typeof getStaffHeight === 'function' ? getStaffHeight() : staffLineSpanPx;
  }
  return getTraditionalStaffStepPx(staffLineSpanPx, interStaffGapPx);
}

/**
 * Ühendatud taktijoon / bracket / repeat ulatus: esimesest ülemisest joonest viimase alumise jooneni.
 * Valem: n × step − gap (gap on “vahede” summa, mitte topelt alumise/ülemise joone vahel).
 *
 * @param {number} visibleStaffCount
 * @param {number} staffStepPx
 * @param {number} interStaffGapPx
 */
export function getTraditionalSystemTotalHeightPx(visibleStaffCount, staffStepPx, interStaffGapPx) {
  const n = Math.max(1, Number(visibleStaffCount) || 1);
  const step = Math.max(0, Number(staffStepPx) || 0);
  const gap = Math.max(0, Number(interStaffGapPx) || 0);
  return n * step - gap;
}

/**
 * Traditsioonilise mitme staffi render-geomeetria ühes kohas.
 * Tagastab nii iga staffi baseYOffseti kui ka kogu süsteemi kõrguse.
 *
 * @param {object} opts
 * @param {Array<{staffIdx:number,visibleIndex:number}>} opts.visibleStaffList
 * @param {number} opts.staffStepPx
 * @param {number} opts.interStaffGapPx
 * @param {boolean} [opts.useManualOffsets=false]
 * @param {number[]} [opts.staffYOffsets=[]]
 */
export function computeTraditionalVisibleStaffGeometry({
  visibleStaffList,
  staffStepPx,
  interStaffGapPx,
  useManualOffsets = false,
  staffYOffsets = [],
}) {
  const list = Array.isArray(visibleStaffList) ? visibleStaffList : [];
  const step = Math.max(0, Number(staffStepPx) || 0);
  const gap = Math.max(0, Number(interStaffGapPx) || 0);
  const baseYOffsetByStaffIdx = {};

  list.forEach(({ staffIdx, visibleIndex }) => {
    const manual = useManualOffsets ? (Number(staffYOffsets?.[staffIdx]) || 0) : 0;
    baseYOffsetByStaffIdx[staffIdx] = (Math.max(0, Number(visibleIndex) || 0) * step) + manual;
  });

  return {
    baseYOffsetByStaffIdx,
    systemTotalHeightPx: getTraditionalSystemTotalHeightPx(list.length || 1, step, gap),
  };
}
