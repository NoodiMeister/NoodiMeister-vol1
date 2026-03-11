/**
 * Figurenotes symbol gallery – one symbol at a time for inspection.
 * Prev/Next to move through all Figurenotes shapes, octave styles, rest Z, and duration blocks.
 */
import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './SymbolGalleryPage.css';
import { FIGURE_NOTE_COLORS, getShapePathsByOctave, getFigureStyle } from '../constants/FigureNotesLibrary';

const FIGURE_BLOCK_GRAY = '#9ca3af';
const DURATION_TO_MULTIPLIER = {
  '1/32': 0.25, '1/16': 0.5, '1/8': 0.5, '1/4': 1, '1/2': 2, '1/1': 4,
};

const VIEW_SIZE = 120;
const SHAPE_VIEW = 100; // Figurenotes shapes are defined in 0 0 100 100

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

/** One Figurenotes symbol: shape by octave (2=X, 3=square, 4=circle, 5=triangle), color by note (C–B). */
function FigurenotesShapeCell({ noteName, octave }) {
  const style = getFigureStyle(noteName, octave ?? 4);
  const paths = getShapePathsByOctave(octave ?? 4);
  const scale = VIEW_SIZE / SHAPE_VIEW;
  return (
    <g transform={`translate(${-SHAPE_VIEW / 2}, ${-SHAPE_VIEW / 2}) scale(${scale})`}>
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill={style.fill}
          stroke={style.stroke ?? 'none'}
          strokeWidth={style.strokeWidth ?? 0}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

/** Rest "Z" as in FigurenotesView. */
function FigurenotesRestZ() {
  const size = 48;
  return (
    <text x={0} y={size * 0.2} textAnchor="middle" fontSize={size} fontWeight="bold" fill="#1a1a1a" fontFamily="serif">
      Z
    </text>
  );
}

/** Duration block icon (same as FigurenotesBlockIcon) centered and scaled in inspection view. */
function FigurenotesBlockCell({ duration }) {
  const d = duration && (duration === 'rest' || duration === 'dotted' ? '1/4' : duration);
  const mult = DURATION_TO_MULTIPLIER[d] ?? 1;
  const boxW = 24;
  const boxH = 20;
  const blockW = Math.max(8, Math.min(20, (boxW * mult) / Math.ceil(mult)));
  const count = Math.ceil(mult);
  const scale = VIEW_SIZE / Math.max(boxW, boxH);
  return (
    <g transform={`translate(${-boxW / 2}, ${-boxH / 2}) scale(${scale})`}>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={2 + i * (blockW + 2)}
          y={2}
          width={blockW}
          height={boxH - 4}
          rx={1}
          fill={FIGURE_BLOCK_GRAY}
          stroke="#C7BAB7"
          strokeWidth="0.8"
        />
      ))}
    </g>
  );
}

const OCTAVE_LABELS = { 2: 'X', 3: 'square', 4: 'circle', 5: 'triangle' };

/** Build the flat list of all Figurenotes symbols. 4 octaves × 7 notes = 28, then Rest Z and duration blocks. */
function buildFigurenotesSymbolList() {
  const list = [];

  // 4 octaves × 7 notes: shape by octave, color by note
  [2, 3, 4, 5].forEach((oct) => {
    Object.keys(FIGURE_NOTE_COLORS).forEach((note) => {
      list.push({
        id: `octave-${oct}-${note}`,
        title: `Octave ${oct} (${OCTAVE_LABELS[oct]}) – ${note}`,
        el: <FigurenotesShapeCell noteName={note} octave={oct} />,
      });
    });
  });

  // Rest Z
  list.push({
    id: 'rest-z',
    title: 'Rest: Z',
    el: <FigurenotesRestZ />,
  });

  // Duration blocks (toolbox style)
  ['1/4', '1/2', '1/1', '1/8', '1/16', '1/32'].forEach((dur) => {
    list.push({
      id: `block-${dur.replace('/', '-')}`,
      title: `Duration block: ${dur}`,
      el: <FigurenotesBlockCell duration={dur} />,
    });
  });

  return list;
}

const FIGURENOTES_SYMBOL_LIST = buildFigurenotesSymbolList();

/** Sanitize symbol id for use in filenames. */
function symbolFilename(id, ext) {
  const safe = String(id).replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'symbol';
  return `${safe}.${ext}`;
}

const PNG_SIZE = 400;

export default function FigurenotesSymbolGalleryPage() {
  const svgRef = React.useRef(null);
  const [pngPreviewUrl, setPngPreviewUrl] = React.useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const indexFromUrl = parseInt(searchParams.get('i'), 10);
  const index =
    Number.isFinite(indexFromUrl) && indexFromUrl >= 0 && indexFromUrl < FIGURENOTES_SYMBOL_LIST.length
      ? indexFromUrl
      : 0;

  const current = FIGURENOTES_SYMBOL_LIST[index];
  const hasPrev = index > 0;
  const hasNext = index < FIGURENOTES_SYMBOL_LIST.length - 1;

  // Update PNG preview when symbol changes
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
        ctx.fillStyle = '#fff';
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
  }, [index]);

  const go = (newIndex) => {
    const i = Math.max(0, Math.min(FIGURENOTES_SYMBOL_LIST.length - 1, newIndex));
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
      ctx.fillStyle = '#fff';
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

  return (
    <div className="symbol-gallery">
      <header className="symbol-gallery__header">
        <h1>Figurenotes – symbol inspection</h1>
        <p>One symbol at a time. Use Prev/Next or the list to inspect each.</p>
        <Link to="/app" className="symbol-gallery__back">← Back to app</Link>
        {' · '}
        <Link to="/gallery" className="symbol-gallery__back">Traditional gallery</Link>
      </header>

      <div className="symbol-gallery__view">
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
          {index + 1} / {FIGURENOTES_SYMBOL_LIST.length}
        </span>
        <button type="button" disabled={!hasNext} onClick={() => go(index + 1)} aria-label="Next symbol">
          Next →
        </button>
      </nav>

      <div className="symbol-gallery__index">
        <p className="symbol-gallery__index-title">Jump to symbol:</p>
        <ul className="symbol-gallery__index-list">
          {FIGURENOTES_SYMBOL_LIST.map((s, i) => (
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
