import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { COMPOSER_TEXT_PRESETS, partitionBlocksForRender } from '../../document/composerDocumentModel';

function snapValue(value, size, enabled) {
  if (!enabled || size <= 1) return value;
  return Math.round(value / size) * size;
}

function textBlockStyle(block) {
  return {
    fontFamily: 'Arial, Helvetica, sans-serif',
    fontSize: `${block.fontSize || 14}px`,
    fontWeight: block.fontWeight ?? 400,
    fontStyle: block.fontStyle || 'normal',
    textDecoration: block.textDecoration || 'none',
    textAlign: block.align || 'left',
    color: block.color || '#111827',
    lineHeight: block.lineHeight || 1.4,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  };
}

function ComposerTextBlockView({
  block,
  isActive,
  isEditing,
  toolMode,
  onSelect,
  onStartEdit,
  onPatch,
  onEndEdit,
  onDragStart,
}) {
  const editRef = useRef(null);
  const preset = COMPOSER_TEXT_PRESETS[block.textStyle] || COMPOSER_TEXT_PRESETS.body;
  const displayText = block.text || (isEditing ? '' : preset.placeholder);

  useEffect(() => {
    if (!isEditing || !editRef.current) return;
    if (editRef.current.innerText !== (block.text || '')) {
      editRef.current.innerText = block.text || '';
    }
    editRef.current.focus();
    const range = document.createRange();
    range.selectNodeContents(editRef.current);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [isEditing, block.id]);

  const syncHeight = useCallback(() => {
    const el = editRef.current;
    if (!el) return;
    const nextH = Math.max(32, el.scrollHeight + 8);
    if (Math.abs(nextH - (block.height || 0)) > 4) {
      onPatch({ height: nextH });
    }
  }, [block.height, onPatch]);

  const handleInput = () => {
    const el = editRef.current;
    if (!el) return;
    onPatch({ text: el.innerText || '' });
    syncHeight();
  };

  const handleBlur = () => {
    onEndEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onEndEdit();
    }
  };

  return (
    <div
      draggable={toolMode === 'move' && !isEditing && !block.locked}
      onDragStart={(e) => {
        if (toolMode !== 'move') {
          e.preventDefault();
          return;
        }
        onDragStart?.(e, block);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
        if (toolMode === 'text' && !isEditing) onStartEdit(block.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onSelect(block.id);
        onStartEdit(block.id);
      }}
      className={`absolute border ${isActive ? 'border-amber-500 shadow-lg' : 'border-transparent hover:border-amber-200'} ${toolMode === 'text' ? 'cursor-text' : 'cursor-move'}`}
      style={{
        left: block.x,
        top: block.y,
        width: block.width,
        minHeight: block.height,
        zIndex: 2,
        background: isEditing ? 'rgba(255,251,235,0.95)' : 'transparent',
      }}
    >
      {isEditing ? (
        <div
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full h-full outline-none px-2 py-1"
          style={textBlockStyle(block)}
        />
      ) : (
        <div
          className="w-full h-full px-2 py-1 pointer-events-none select-none"
          style={{
            ...textBlockStyle(block),
            opacity: block.text ? 1 : 0.45,
          }}
        >
          {displayText}
        </div>
      )}
    </div>
  );
}

function ComposerSvgBlockView({
  block,
  activeBlockId,
  toolMode,
  cutGuide,
  onSelectBlock,
  onSplitBlock,
  onDragStart,
  onCutGuide,
  onCutGuideClear,
  zIndex,
}) {
  return (
    <div
      draggable={!block.locked && toolMode === 'move'}
      onDragStart={(e) => onDragStart(e, block)}
      onMouseMove={(e) => {
        if (toolMode !== 'scissor-h' && toolMode !== 'scissor-v') return;
        onCutGuide({ blockId: block.id, ratio: getCutRatioFromEvent(e, toolMode) });
      }}
      onMouseLeave={() => onCutGuideClear(block.id)}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBlock(block.id);
        if (toolMode === 'scissor-h' || toolMode === 'scissor-v') {
          const ratio = getCutRatioFromEvent(e, toolMode);
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
        zIndex,
      }}
    >
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
    </div>
  );
}

function getCutRatioFromEvent(evt, toolMode) {
  const rect = evt.currentTarget.getBoundingClientRect();
  if (toolMode === 'scissor-v') return Math.max(0.05, Math.min(0.95, (evt.clientX - rect.left) / rect.width));
  return Math.max(0.05, Math.min(0.95, (evt.clientY - rect.top) / rect.height));
}

export default function ComposerCanvas({
  page,
  activeBlockId,
  editingBlockId,
  onSelectBlock,
  onPatchBlock,
  onStartEdit,
  onEndEdit,
  grid,
  toolMode,
  onSplitBlock,
  onAddTextAt,
  pendingTextStyle,
}) {
  const [cutGuide, setCutGuide] = useState(null);
  const pageRef = useRef(null);

  const gridBg = useMemo(() => {
    if (!grid?.enabled) return undefined;
    const size = Math.max(4, Number(grid?.size) || 12);
    return {
      backgroundImage: 'linear-gradient(to right, rgba(245,158,11,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(245,158,11,.18) 1px, transparent 1px)',
      backgroundSize: `${size}px ${size}px`,
    };
  }, [grid?.enabled, grid?.size]);

  const onDragStart = (e, block) => {
    if (toolMode !== 'move') return;
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

  const handlePageClick = (e) => {
    if (toolMode !== 'text') return;
    if (e.target !== pageRef.current) return;
    const rect = pageRef.current.getBoundingClientRect();
    const x = snapValue(e.clientX - rect.left, grid?.size || 12, grid?.snap);
    const y = snapValue(e.clientY - rect.top, grid?.size || 12, grid?.snap);
    onAddTextAt?.(x, y, pendingTextStyle || 'body');
  };

  const { backgroundSvg, textBlocks, foregroundSvg } = useMemo(
    () => partitionBlocksForRender(page.blocks || []),
    [page.blocks],
  );

  const renderSvgBlock = (block, zIndex) => (
    <ComposerSvgBlockView
      key={block.id}
      block={block}
      activeBlockId={activeBlockId}
      toolMode={toolMode}
      cutGuide={cutGuide}
      onSelectBlock={onSelectBlock}
      onSplitBlock={onSplitBlock}
      onDragStart={onDragStart}
      onCutGuide={setCutGuide}
      onCutGuideClear={(blockId) => setCutGuide((prev) => (prev?.blockId === blockId ? null : prev))}
      zIndex={zIndex}
    />
  );

  return (
    <section className="rounded-2xl border border-amber-200/70 dark:border-white/20 bg-amber-50/40 dark:bg-zinc-950 p-4 overflow-auto">
      <div
        ref={pageRef}
        onClick={handlePageClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        className={`relative mx-auto border border-amber-300 dark:border-white/30 shadow ${toolMode === 'text' ? 'cursor-text' : ''}`}
        style={{
          width: page.width,
          height: page.height,
          background: page.background || '#ffffff',
          ...gridBg,
        }}
      >
        {backgroundSvg.map((block) => renderSvgBlock(block, 1))}

        {textBlocks.map((block) => (
          <ComposerTextBlockView
            key={block.id}
            block={block}
            isActive={activeBlockId === block.id}
            isEditing={editingBlockId === block.id}
            toolMode={toolMode}
            onSelect={onSelectBlock}
            onStartEdit={onStartEdit}
            onEndEdit={onEndEdit}
            onPatch={(patch) => onPatchBlock(block.id, patch)}
            onDragStart={onDragStart}
          />
        ))}

        {foregroundSvg.map((block) => renderSvgBlock(block, 3))}
      </div>
    </section>
  );
}
