import React, { useMemo, useState } from 'react';

function snapValue(value, size, enabled) {
  if (!enabled || size <= 1) return value;
  return Math.round(value / size) * size;
}

export default function ComposerCanvas({
  page,
  activeBlockId,
  onSelectBlock,
  onPatchBlock,
  grid,
  toolMode,
  onSplitBlock,
}) {
  const [cutGuide, setCutGuide] = useState(null);
  const gridBg = useMemo(() => {
    if (!grid?.enabled) return undefined;
    const size = Math.max(4, Number(grid?.size) || 12);
    return {
      backgroundImage: `linear-gradient(to right, rgba(245,158,11,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,158,11,.18) 1px, transparent 1px)`,
      backgroundSize: `${size}px ${size}px`,
    };
  }, [grid?.enabled, grid?.size]);

  const onDragStart = (e, block) => {
    e.dataTransfer.setData('text/plain', block.id);
  };
  const onDrop = (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (!id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onPatchBlock(id, {
      x: snapValue(x, grid?.size || 12, grid?.snap),
      y: snapValue(y, grid?.size || 12, grid?.snap),
    });
  };

  const getCutRatio = (evt, block) => {
    const rect = evt.currentTarget.getBoundingClientRect();
    if (toolMode === 'scissor-v') return Math.max(0.05, Math.min(0.95, (evt.clientX - rect.left) / rect.width));
    return Math.max(0.05, Math.min(0.95, (evt.clientY - rect.top) / rect.height));
  };

  return (
    <section className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-amber-50/40 dark:bg-zinc-950 p-4 overflow-auto">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className="relative mx-auto border border-amber-300 dark:border-white/30 bg-white shadow"
        style={{
          width: page.width,
          height: page.height,
          ...gridBg,
        }}
      >
        {page.blocks.map((block) => (
          <div
            key={block.id}
            draggable={!block.locked}
            onDragStart={(e) => onDragStart(e, block)}
            onMouseMove={(e) => {
              if (toolMode !== 'scissor-h' && toolMode !== 'scissor-v') return;
              setCutGuide({ blockId: block.id, ratio: getCutRatio(e, e.currentTarget) });
            }}
            onMouseLeave={() => setCutGuide((prev) => (prev?.blockId === block.id ? null : prev))}
            onClick={(e) => {
              onSelectBlock(block.id);
              if (toolMode === 'scissor-h' || toolMode === 'scissor-v') {
                const ratio = getCutRatio(e, e.currentTarget);
                onSplitBlock(block.id, toolMode === 'scissor-v' ? 'vertical' : 'horizontal', ratio);
              }
            }}
            className={`absolute border overflow-hidden ${toolMode === 'move' ? 'cursor-move' : 'cursor-crosshair'} ${activeBlockId === block.id ? 'border-amber-500 shadow-lg' : 'border-amber-200'}`}
            style={{
              left: block.x,
              top: block.y,
              width: block.width,
              height: block.height,
              background: '#fff',
            }}
          >
            {block.type === 'svg' ? (
              <div className="w-full h-full relative overflow-hidden bg-white">
                <div
                  style={{
                    position: 'absolute',
                    width: `${(block.sourceWidth || block.width) * (block.width / (block.slice?.width || block.width))}px`,
                    height: `${(block.sourceHeight || block.height) * (block.height / (block.slice?.height || block.height))}px`,
                    left: `-${(block.slice?.x || 0) * (block.width / (block.slice?.width || block.width))}px`,
                    top: `-${(block.slice?.y || 0) * (block.height / (block.slice?.height || block.height))}px`,
                    transformOrigin: 'top left',
                  }}
                  dangerouslySetInnerHTML={{ __html: block.svgMarkup || '' }}
                />
                {cutGuide?.blockId === block.id && (toolMode === 'scissor-v' || toolMode === 'scissor-h') && (
                  <div
                    className="pointer-events-none absolute"
                    style={toolMode === 'scissor-v'
                      ? {
                        left: `${(cutGuide.ratio || 0.5) * 100}%`,
                        top: 0,
                        bottom: 0,
                        width: 0,
                        borderLeft: '2px dashed #dc2626',
                      }
                      : {
                        top: `${(cutGuide.ratio || 0.5) * 100}%`,
                        left: 0,
                        right: 0,
                        height: 0,
                        borderTop: '2px dashed #dc2626',
                      }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full p-2 text-sm text-amber-900">{block.text || ''}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
