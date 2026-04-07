/**
 * svg2pdf.js ignores SVG @font-face; SMuFL <text> (Leland/Bravura) would fall back to Times and show
 * garbage for PUA codepoints. Register the same Bravura outlines jsPDF expects (base64 in VFS for OTF).
 */
import bravuraOtfUrl from '@vexflow-fonts/bravura/bravura.otf?url';

const VFS_NAME = 'Bravura.otf';

let cachedBase64Promise = null;

function arrayBufferToBase64 (buffer) {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  let binary = '';
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function getBravuraOtfBase64 () {
  if (!cachedBase64Promise) {
    cachedBase64Promise = fetch(bravuraOtfUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`Bravura OTF fetch failed (${r.status})`);
        return r.arrayBuffer();
      })
      .then(arrayBufferToBase64)
      .catch((err) => {
        cachedBase64Promise = null;
        throw err;
      });
  }
  return cachedBase64Promise;
}

/** svg2pdf/jsPDF may request these style keys for <text>; all map to the same Bravura face. */
const SMUFL_JSPDF_STYLE_VARIANTS = ['normal', 'bold', 'italic', 'bolditalic'];

function ensureLelandStyleVariants (pdf) {
  const list = pdf.getFontList?.() || {};
  const have = list.Leland || [];
  for (const style of SMUFL_JSPDF_STYLE_VARIANTS) {
    if (have.indexOf(style) < 0) {
      pdf.addFont(VFS_NAME, 'Leland', style, 'Identity-H');
    }
  }
  const haveBr = list.Bravura || [];
  for (const style of SMUFL_JSPDF_STYLE_VARIANTS) {
    if (haveBr.indexOf(style) < 0) {
      pdf.addFont(VFS_NAME, 'Bravura', style, 'Identity-H');
    }
  }
}

/** @param {object} pdf jsPDF instance */
export async function registerSmuflFontsForJsPdf (pdf) {
  if (!pdf || typeof pdf.addFileToVFS !== 'function' || typeof pdf.addFont !== 'function') return;
  const b64 = await getBravuraOtfBase64();
  if (!pdf.existsFileInVFS(VFS_NAME)) {
    pdf.addFileToVFS(VFS_NAME, b64);
  }
  ensureLelandStyleVariants(pdf);
}
