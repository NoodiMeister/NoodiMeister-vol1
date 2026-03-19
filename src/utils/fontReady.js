export async function waitForDocumentFonts ({ timeoutMs = 1500 } = {}) {
  if (typeof document === 'undefined' || !document.fonts?.ready) return;

  let timeoutId = null;
  try {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => {
        timeoutId = window.setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId);
  }
}

export function getFontAvailabilityReport () {
  if (typeof document === 'undefined' || !document.fonts?.check) return [];
  return [
    { family: 'Leland', loaded: document.fonts.check('16px "Leland"') || document.fonts.check('16px "Bravura"') },
    { family: 'LelandText', loaded: document.fonts.check('16px "LelandText"') || document.fonts.check('16px "Noto Serif"') },
    { family: 'Bravura', loaded: document.fonts.check('16px "Bravura"') },
    { family: 'Noto Serif', loaded: document.fonts.check('16px "Noto Serif"') },
    { family: 'Noto Sans', loaded: document.fonts.check('16px "Noto Sans"') },
    { family: 'TinWhistleTab', loaded: document.fonts.check('16px "TinWhistleTab"') },
    { family: 'RecorderFont', loaded: document.fonts.check('16px "RecorderFont"') },
  ];
}

export function getMissingFonts () {
  return getFontAvailabilityReport()
    .filter((item) => ['Leland', 'LelandText', 'Bravura', 'Noto Serif', 'Noto Sans'].includes(item.family))
    .filter((item) => !item.loaded)
    .map((item) => item.family);
}

export function supportsDocumentFonts () {
  return typeof document !== 'undefined' && Boolean(document.fonts?.ready && document.fonts?.check);
}
