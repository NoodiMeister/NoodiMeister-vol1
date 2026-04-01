export function computeStaffGeometry({
  notationStyle,
  staffEntries,
  perStaffRowStep,
  staffYOffsetsByIndex,
  effectiveStaffHeight,
  staffLineSpan,
  layoutPartsGap = 0,
}) {
  const entries = Array.isArray(staffEntries) ? staffEntries : [];
  const useManualStaffOffsets = notationStyle === 'FIGURENOTES';
  const withOffsets = entries.map((entry) => ({
    ...entry,
    baseYOffset: (entry.visibleIndex || 0) * perStaffRowStep
      + (useManualStaffOffsets ? (staffYOffsetsByIndex?.[entry.staffIdx] ?? 0) : 0),
  }));

  if (notationStyle === 'FIGURENOTES') {
    const visibleCount = withOffsets.length;
    const connectedSystemHeight = visibleCount <= 0
      ? staffLineSpan
      : (visibleCount * perStaffRowStep) - layoutPartsGap;
    return {
      staffEntriesWithOffsets: withOffsets,
      connectedSystemHeight,
      connectedBarlineOffsets: {
        y1: Math.max(0, (effectiveStaffHeight / 2) - (staffLineSpan / 2)),
        y2: Math.max(0, (effectiveStaffHeight / 2) + (staffLineSpan / 2)),
      },
    };
  }

  const centerY = effectiveStaffHeight / 2;
  const firstLineY = centerY - (staffLineSpan / 2);
  const lastLineY = centerY + (staffLineSpan / 2);
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  withOffsets.forEach((entry) => {
    const top = (entry.baseYOffset ?? 0) + firstLineY;
    const bottom = (entry.baseYOffset ?? 0) + lastLineY;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  });
  const safeY1 = Number.isFinite(minY) ? minY : firstLineY;
  const safeY2 = Number.isFinite(maxY) ? maxY : lastLineY;

  return {
    staffEntriesWithOffsets: withOffsets,
    connectedSystemHeight: Math.max(staffLineSpan, safeY2 - safeY1),
    connectedBarlineOffsets: { y1: safeY1, y2: safeY2 },
  };
}
