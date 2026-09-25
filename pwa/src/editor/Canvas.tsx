import { useEffect, useRef, useState } from 'react';
import type { EditorScene, EditorItem } from '../protocol/types';
import { obsToEditor } from '../coordinate/convert';

interface CanvasProps {
  scene: EditorScene | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (id: number, x: number, y: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onResetRotation: (id: number) => void;
  thumbs?: Record<number, string>;
}

export function Canvas({
  scene,
  selectedId,
  onSelect,
  onMove,
  onEdit,
  onDelete,
  onResetRotation,
  thumbs,
}: CanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 844, h: 390 });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setWrapSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const editorCanvas = { width: wrapSize.w, height: wrapSize.h };
  const obsCanvas = scene
    ? { width: scene.canvasWidth, height: scene.canvasHeight }
    : { width: 1920, height: 1080 };

  const handlePointerDown = (e: React.PointerEvent, item: EditorItem) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    onSelect(item.sceneItemId);

    const startX = e.clientX;
    const startY = e.clientY;
    const origX = item.x;
    const origY = item.y;
    const itemW = item.width * item.scaleX;
    const itemH = item.height * item.scaleY;

    const onPointerMove = (ev: PointerEvent) => {
      const dxObs = ((ev.clientX - startX) * obsCanvas.width) / editorCanvas.width;
      const dyObs = ((ev.clientY - startY) * obsCanvas.height) / editorCanvas.height;
      let nx = origX + dxObs;
      let ny = origY + dyObs;

      // Snap logic (Instagram Stories style)
      const SNAP = 24; // OBS px threshold
      let snapX: number | null = null;
      let snapY: number | null = null;
      let guideX: number | null = null;
      let guideY: number | null = null;

      const trySnap = (val: number, targetPos: number, guidePos: number) => {
        if (Math.abs(val - targetPos) < SNAP) {
          if (snapX === null || Math.abs(val - targetPos) < Math.abs(val - (snapX ?? Infinity))) {
            snapX = targetPos;
            guideX = guidePos;
          }
          return targetPos;
        }
        return val;
      };
      const trySnapY = (val: number, targetPos: number, guidePos: number) => {
        if (Math.abs(val - targetPos) < SNAP) {
          if (snapY === null || Math.abs(val - targetPos) < Math.abs(val - (snapY ?? Infinity))) {
            snapY = targetPos;
            guideY = guidePos;
          }
          return targetPos;
        }
        return val;
      };

      const candX: Array<[number, number]> = [
        [0, 0],
        [obsCanvas.width / 2 - itemW / 2, obsCanvas.width / 2],
        [obsCanvas.width - itemW, obsCanvas.width],
      ];
      const candY: Array<[number, number]> = [
        [0, 0],
        [obsCanvas.height / 2 - itemH / 2, obsCanvas.height / 2],
        [obsCanvas.height - itemH, obsCanvas.height],
      ];

      if (scene) {
        for (const other of scene.items) {
          if (other.sceneItemId === item.sceneItemId) continue;
          const ow = other.width * other.scaleX;
          const oh = other.height * other.scaleY;
          candX.push([other.x, other.x]);
          candX.push([other.x + ow / 2 - itemW / 2, other.x + ow / 2]);
          candX.push([other.x + ow - itemW, other.x + ow]);
          candY.push([other.y, other.y]);
          candY.push([other.y + oh / 2 - itemH / 2, other.y + oh / 2]);
          candY.push([other.y + oh - itemH, other.y + oh]);
        }
      }

      for (const [sPos, gPos] of candX) nx = trySnap(nx, sPos, gPos);
      for (const [sPos, gPos] of candY) ny = trySnapY(ny, sPos, gPos);

      if (snapX !== null || snapY !== null) {
        setGuides({
          x: guideX !== null ? (guideX * editorCanvas.width) / obsCanvas.width : null,
          y: guideY !== null ? (guideY * editorCanvas.height) / obsCanvas.height : null,
        });
      } else {
        setGuides({ x: null, y: null });
      }

      onMove(item.sceneItemId, snapX !== null ? snapX : nx, snapY !== null ? snapY : ny);
    };

    const onUp = () => {
      setGuides({ x: null, y: null });
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onUp);
  };

  const selectedItem = scene?.items.find((i) => i.sceneItemId === selectedId) ?? null;
  const selectedCoords = selectedItem
    ? obsToEditor(selectedItem.x, selectedItem.y, selectedItem.width * selectedItem.scaleX, selectedItem.height * selectedItem.scaleY, obsCanvas, editorCanvas)
    : null;

  return (
    <div
      ref={wrapRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={() => onSelect(null)}
    >
      {/* Render All Scene Items as labeled boxes (positions/sizes from OBS).
          When the plugin has screenshotted an overlay, its image is shown
          inside the box; otherwise just the source name. */}
      {scene?.items.map((it) => {
        const { x, y, width, height } = obsToEditor(it.x, it.y, it.width * it.scaleX, it.height * it.scaleY, obsCanvas, editorCanvas);
        const isSelected = selectedId === it.sceneItemId;
        const thumb = thumbs?.[it.sceneItemId];

        return (
          <div
            key={it.sceneItemId}
            onPointerDown={(e) => {
              e.stopPropagation();
              handlePointerDown(e, it);
            }}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: Math.max(28, width),
              height: Math.max(24, height),
              transform: `rotate(${it.rotation}deg)`,
              transformOrigin: 'top left',
              opacity: it.visible ? 1 : 0.35,
              border: isSelected ? '2px solid #fac800' : '1px solid rgba(255,255,255,0.2)',
              backgroundColor: isSelected ? 'rgba(250, 200, 0, 0.08)' : 'rgba(0,0,0,0.18)',
              backgroundImage: thumb ? `url(${thumb})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              boxSizing: 'border-box',
              cursor: 'grab',
              zIndex: isSelected ? 20 : 5,
            }}
          >
            {/* Tag on Top-Left */}
            {isSelected ? (
              <div
                style={{
                  position: 'absolute',
                  left: -1,
                  top: -1,
                  background: '#fac800',
                  color: '#111',
                  fontSize: 13,
                  fontWeight: 600,
                  padding: '3px 8px',
                  borderRadius: '3px 0 4px 0',
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {it.sourceName}
              </div>
            ) : (
              <div
                style={{
                  position: 'absolute',
                  left: 4,
                  top: 4,
                  background: 'rgba(0,0,0,0.55)',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 5px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                  pointerEvents: 'none',
                }}
              >
                {it.sourceName}
              </div>
            )}
          </div>
        );
      })}

      {/* Selected Item Corner Handles & Floating Toolbar (toolbar pinned inside canvas) */}
      {selectedItem && selectedCoords && (() => {
        const TOOLBAR_W = 38;
        const TOOLBAR_H = 168;
        const selW = Math.max(28, selectedCoords.width);
        const selH = Math.max(24, selectedCoords.height);
        // Prefer right side, else left — then hard-clamp into canvas so
        // fullscreen overlays (box == canvas) still show the toolbar inside.
        const wantRight = selectedCoords.x + selW + 12;
        const wantLeft = selectedCoords.x - TOOLBAR_W - 12;
        const maxX = Math.max(8, wrapSize.w - TOOLBAR_W - 8);
        let toolbarX = wantRight;
        if (wantRight > maxX) toolbarX = wantLeft;
        toolbarX = Math.max(8, Math.min(maxX, toolbarX));
        // Fullscreen fallback: dock top-right inside canvas
        if (selW >= wrapSize.w - 16 && selH >= wrapSize.h - 16) {
          toolbarX = Math.max(8, wrapSize.w - TOOLBAR_W - 8);
        }
        const desiredY = selectedCoords.y + selH / 2 - TOOLBAR_H / 2;
        const maxY = Math.max(8, wrapSize.h - TOOLBAR_H - 8);
        const toolbarY = Math.max(8, Math.min(maxY, desiredY));
        return (
        <>
        <div
          style={{
            position: 'absolute',
            left: selectedCoords.x,
            top: selectedCoords.y,
            width: selW,
            height: selH,
            pointerEvents: 'none',
            zIndex: 25,
          }}
        >
          {/* 4 Figma Handles (16x16, white, 3px #fac800 border) */}
          <div style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 16, borderRadius: 2, background: '#fff', border: '3px solid #fac800', boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', right: -8, top: -8, width: 16, height: 16, borderRadius: 2, background: '#fff', border: '3px solid #fac800', boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', left: -8, bottom: -8, width: 16, height: 16, borderRadius: 2, background: '#fff', border: '3px solid #fac800', boxSizing: 'border-box' }} />
          <div style={{ position: 'absolute', right: -8, bottom: -8, width: 16, height: 16, borderRadius: 2, background: '#fff', border: '3px solid #fac800', boxSizing: 'border-box' }} />
        </div>

          {/* Floating Action Toolbar — canvas-level, always inside viewport */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              left: toolbarX,
              top: toolbarY,
              width: TOOLBAR_W,
              backgroundColor: '#ffffff',
              borderRadius: 10,
              padding: '6px 3px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
              pointerEvents: 'auto',
              zIndex: 30,
              boxSizing: 'border-box',
            }}
          >
            {/* Gear / Settings */}
            <button
              type="button"
              title="Edit Overlay"
              onClick={() => onEdit(selectedItem.sceneItemId)}
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Trash / Delete */}
            <button
              type="button"
              title="Delete Overlay"
              onClick={() => onDelete(selectedItem.sceneItemId)}
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>

            {/* Rotate / Reset */}
            <button
              type="button"
              title="Reset Rotation"
              onClick={() => onResetRotation(selectedItem.sceneItemId)}
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>

            {/* Deselect (for misclicks) */}
            <button
              type="button"
              title="Deselect"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(null);
              }}
              style={{ background: 'none', border: 'none', padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1c1e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </>
        );
      })()}

      {/* Snapping Guides */}
      {guides.x !== null && (
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1.5, background: '#fac800', boxShadow: '0 0 8px rgba(250,200,0,0.8)', left: guides.x, pointerEvents: 'none', zIndex: 18 }} />
      )}
      {guides.y !== null && (
        <div style={{ position: 'absolute', left: 0, right: 0, height: 1.5, background: '#fac800', boxShadow: '0 0 8px rgba(250,200,0,0.8)', top: guides.y, pointerEvents: 'none', zIndex: 18 }} />
      )}
    </div>
  );
}
