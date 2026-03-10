/**
 * Traditional notation symbol gallery – one symbol at a time for inspection.
 * Prev/Next to move through all symbols separately.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './SymbolGalleryPage.css';
import { TrebleClefSymbol, BassClefSymbol, JoClefSymbol } from '../components/ClefSymbols';
import {
  WholeNoteSymbol,
  HalfNoteSymbol,
  QuarterNoteSymbol,
  EighthNoteSymbol,
  SixteenthNoteSymbol,
  ThirtySecondNoteSymbol,
} from '../notation/NoteSymbols';
import {
  WholeRestSymbol,
  HalfRestSymbol,
  QuarterRestSymbol,
  EighthRestSymbol,
  SixteenthRestSymbol,
  ThirtySecondRestSymbol,
} from '../notation/RestSymbols';
import { SmuflGlyph } from '../notation/smufl/SmuflGlyph';
import { SMUFL_GLYPH } from '../notation/smufl/glyphs';

const SP = 18; // staff space – large enough to inspect
const VIEW_SIZE = 120; // SVG viewBox size for one symbol

function symbolFilename(id, ext) {
  const safe = String(id).replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'symbol';
  return `${safe}.${ext}`;
}

const SingleSymbolView = React.forwardRef(function SingleSymbolView({ title, children }, ref) {
  return (
    <div className="symbol-gallery__single">
      <svg
        ref={ref}
        viewBox={`${-VIEW_SIZE / 2} ${-VIEW_SIZE / 2} ${VIEW_SIZE} ${VIEW_SIZE}`}
        className="symbol-gallery__single-svg"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g>{children}</g>
      </svg>
      <div className="symbol-gallery__single-title">{title}</div>
    </div>
  );
});

/** Build the flat list of all symbols (each shown separately). */
function buildSymbolList() {
  const c = { x: 0, y: 0 };
  const list = [];

  list.push({ id: 'treble', title: 'Clef: Treble (G)', el: <TrebleClefSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'bass', title: 'Clef: Bass (F)', el: <BassClefSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'c-clef', title: 'Clef: C (Alto/Tenor)', el: <SmuflGlyph x={c.x} y={c.y} glyph={SMUFL_GLYPH.cClef} fontSize={SP * 4} fill="#1a1a1a" /> });
  list.push({ id: 'jo-clef', title: 'Clef: JO (Pedagoogiline notatsioon)', el: <JoClefSymbol x={c.x} y={c.y} height={SP * 4} fill="#000" /> });
  list.push({ id: 'jo-clef-inverted', title: 'Clef: JO inverted (opposite color)', el: <JoClefSymbol x={c.x} y={c.y} height={SP * 4} inverted /> });

  list.push({ id: 'note-whole', title: 'Note: Whole', el: <WholeNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} /> });
  list.push({ id: 'note-half-up', title: 'Note: Half (stem up)', el: <HalfNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp /> });
  list.push({ id: 'note-half-down', title: 'Note: Half (stem down)', el: <HalfNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp={false} /> });
  list.push({ id: 'note-quarter-up', title: 'Note: Quarter (stem up)', el: <QuarterNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp /> });
  list.push({ id: 'note-quarter-down', title: 'Note: Quarter (stem down)', el: <QuarterNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp={false} /> });
  list.push({ id: 'note-eighth-up', title: 'Note: Eighth (stem up)', el: <EighthNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp /> });
  list.push({ id: 'note-eighth-down', title: 'Note: Eighth (stem down)', el: <EighthNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp={false} /> });
  list.push({ id: 'note-16th-up', title: 'Note: 16th (stem up)', el: <SixteenthNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp /> });
  list.push({ id: 'note-16th-down', title: 'Note: 16th (stem down)', el: <SixteenthNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp={false} /> });
  list.push({ id: 'note-32nd-up', title: 'Note: 32nd (stem up)', el: <ThirtySecondNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp /> });
  list.push({ id: 'note-32nd-down', title: 'Note: 32nd (stem down)', el: <ThirtySecondNoteSymbol cx={c.x} cy={c.y} staffSpace={SP} stemUp={false} /> });

  list.push({ id: 'rest-whole', title: 'Rest: Whole', el: <WholeRestSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'rest-half', title: 'Rest: Half', el: <HalfRestSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'rest-quarter', title: 'Rest: Quarter', el: <QuarterRestSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'rest-eighth', title: 'Rest: Eighth', el: <EighthRestSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'rest-16th', title: 'Rest: 16th', el: <SixteenthRestSymbol x={c.x} y={c.y} staffSpace={SP} /> });
  list.push({ id: 'rest-32nd', title: 'Rest: 32nd', el: <ThirtySecondRestSymbol x={c.x} y={c.y} staffSpace={SP} /> });

  return list;
}

const SYMBOL_LIST = buildSymbolList();
const PNG_SIZE = 400;

export default function SymbolGalleryPage() {
  const svgRef = React.useRef(null);
  const [pngPreviewUrl, setPngPreviewUrl] = React.useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const indexFromUrl = parseInt(searchParams.get('i'), 10);
  const safeIndex =
    Number.isFinite(indexFromUrl) && indexFromUrl >= 0 && indexFromUrl < SYMBOL_LIST.length
      ? indexFromUrl
      : 0;
  const index = safeIndex;
  const current = SYMBOL_LIST[index];
  const hasPrev = index > 0;
  const hasNext = index < SYMBOL_LIST.length - 1;

  const pngBg = current?.id === 'jo-clef-inverted' ? '#1a1a1a' : '#fff';

  React.useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!svgRef.current) return;
      const s = new XMLSerializer().serializeToString(svgRef.current);
      const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        canvas.width = PNG_SIZE;
        canvas.height = PNG_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = pngBg;
        ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
        ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
        setPngPreviewUrl(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    };
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [index, pngBg]);

  const go = (newIndex) => {
    const i = Math.max(0, Math.min(SYMBOL_LIST.length - 1, newIndex));
    setSearchParams({ i: String(i) }, { replace: true });
  };

  const downloadAsSvg = () => {
    if (!svgRef.current) return;
    const s = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([s], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = symbolFilename(current.id, 'svg');
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsRaster = (format) => {
    if (!svgRef.current) return;
    const s = new XMLSerializer().serializeToString(svgRef.current);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(s)));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = current?.id === 'jo-clef-inverted' ? '#1a1a1a' : '#fff';
      ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
      ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const ext = format === 'jpg' ? 'jpg' : 'png';
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = symbolFilename(current.id, ext);
        a.click();
        URL.revokeObjectURL(url);
      }, mime, format === 'jpg' ? 0.92 : undefined);
    };
    img.src = dataUrl;
  };

  if (!current) {
    return (
      <div className="symbol-gallery">
        <header className="symbol-gallery__header">
          <h1>Traditional notation – symbol inspection</h1>
          <p>No symbols to display.</p>
          <Link to="/app" className="symbol-gallery__back">← Back to app</Link>
        </header>
      </div>
    );
  }

  return (
    <div className="symbol-gallery">
      <header className="symbol-gallery__header">
        <h1>Traditional notation – symbol inspection</h1>
        <p>One symbol at a time. Use Prev/Next or the list to inspect each.</p>
        <Link to="/app" className="symbol-gallery__back">← Back to app</Link>
        {' · '}
        <Link to="/gallery/figurenotes" className="symbol-gallery__back">Figurenotes gallery</Link>
      </header>

      <div className="symbol-gallery__view" data-inverted-jo={current.id === 'jo-clef-inverted' ? 'true' : undefined}>
        <SingleSymbolView ref={svgRef} title={current.title}>{current.el}</SingleSymbolView>
      </div>

      {pngPreviewUrl && (
        <div className="symbol-gallery__png-preview">
          <p className="symbol-gallery__png-preview-title">View as PNG (400×400)</p>
          <img src={pngPreviewUrl} alt={`${current.title} as PNG`} className="symbol-gallery__png-preview-img" width={PNG_SIZE} height={PNG_SIZE} />
        </div>
      )}

      <div className="symbol-gallery__downloads">
        <button type="button" onClick={downloadAsSvg} className="symbol-gallery__download-btn">
          Download as SVG
        </button>
        <button type="button" onClick={() => downloadAsRaster('png')} className="symbol-gallery__download-btn">
          Download as PNG
        </button>
        <button type="button" onClick={() => downloadAsRaster('jpg')} className="symbol-gallery__download-btn">
          Download as JPG
        </button>
      </div>

      <nav className="symbol-gallery__nav">
        <button type="button" disabled={!hasPrev} onClick={() => go(index - 1)} aria-label="Previous symbol">
          ← Previous
        </button>
        <span className="symbol-gallery__counter">
          {index + 1} / {SYMBOL_LIST.length}
        </span>
        <button type="button" disabled={!hasNext} onClick={() => go(index + 1)} aria-label="Next symbol">
          Next →
        </button>
      </nav>

      <div className="symbol-gallery__index">
        <p className="symbol-gallery__index-title">Jump to symbol:</p>
        <ul className="symbol-gallery__index-list">
          {SYMBOL_LIST.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={i === index ? 'symbol-gallery__index-item symbol-gallery__index-item--current' : 'symbol-gallery__index-item'}
                onClick={() => go(i)}
              >
                {s.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
