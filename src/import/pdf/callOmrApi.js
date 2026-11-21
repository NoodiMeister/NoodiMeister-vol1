/**
 * Client for POST /api/import/omr — browser sends page images + guided constraints.
 */

export async function callOmrApi({ pages, constraints, fileName, textLines } = {}) {
  const body = {
    fileName: String(fileName || '').trim(),
    constraints: constraints || {},
    textLines: Array.isArray(textLines) ? textLines.slice(0, 400) : [],
    pages: (pages || []).map((p) => ({
      pageIndex: p.pageIndex,
      width: p.width,
      height: p.height,
      // Prefer compact payload: strip data: prefix if present for server
      imageDataUrl: p.dataUrl || p.imageDataUrl || null,
    })),
  };

  const res = await fetch('/api/import/omr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const msg = json?.error || json?.message || `OMR API viga (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = json;
    throw err;
  }

  return json;
}
