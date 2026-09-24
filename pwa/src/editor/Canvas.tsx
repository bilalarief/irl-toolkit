import { useEffect, useRef, useState } from 'react';
import type { EditorScene, EditorItem } from '../protocol/types';
import { obsToEditor } from '../coordinate/convert';

export function Canvas({
  scene,
  selectedId,
  onSelect,
  onMove,
  thumbnail,
}: {
  scene: EditorScene | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (id: number, x: number, y: number) => void;
  thumbnail?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 360, h: 202 });
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setWrapSize({ w: r.width, h: r.width * (9 / 16) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!scene) {
    return (
      <div ref={wrapRef} className="canvas-wrap">
        <div className="canvas empty">No scene loaded</div>
      </div>
    );
  }

  const editorCanvas = { width: wrapSize.w, height: wrapSize.h };
  const obsCanvas = { width: scene.canvasWidth, height: scene.canvasHeight };

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

      // --- Snap logic (Instagram Stories style) ---
      const SNAP = 24; // OBS px threshold
      let snapX: number | null = null;
      let snapY: number | null = null;
      let guideX: number | null = null;
      let guideY: number | null = null;

      const trySnap = (val: number, target: number, guide: number) => {
        if (Math.abs(val - target) < SNAP) {
          if (snapX === null || Math.abs(val - target) < Math.abs(val - (snapX ?? Infinity))) {
            snapX = target;
            guideX = guide;
          }
          return target;
        }
        return val;
      };
      const trySnapY = (val: number, target: number, guide: number) => {
        if (Math.abs(val - target) < SNAP) {
          if (snapY === null || Math.abs(val - target) < Math.abs(val - (snapY ?? Infinity))) {
            snapY = target;
            guideY = guide;
          }
          return target;
        }
        return val;
      };

      // Snap candidates X
      const candX: Array<[number, number]> = [
        [0, 0],
        [obsCanvas.width / 2 - itemW / 2, obsCanvas.width / 2],
        [obsCanvas.width - itemW, obsCanvas.width],
      ];
      // Snap candidates Y
      const candY: Array<[number, number]> = [
        [0, 0],
        [obsCanvas.height / 2 - itemH / 2, obsCanvas.height / 2],
        [obsCanvas.height - itemH, obsCanvas.height],
      ];
      // Other items' edges/centers
      for (const other of scene.items) {
        if (other.sceneItemId === item.sceneItemId) continue;
        const ow = other.width * other.scaleX;
        const oh = other.height * other.scaleY;
        // other left, center, right
        candX.push([other.x, other.x]);
        candX.push([other.x + ow / 2 - itemW / 2, other.x + ow / 2]);
        candX.push([other.x + ow - itemW, other.x + ow]);
        candY.push([other.y, other.y]);
        candY.push([other.y + oh / 2 - itemH / 2, other.y + oh / 2]);
        candY.push([other.y + oh - itemH, other.y + oh]);
      }

      for (const [snapPos, guidePos] of candX) nx = trySnap(nx, snapPos, guidePos);
      for (const [snapPos, guidePos] of candY) ny = trySnapY(ny, snapPos, guidePos);

      // Update guides in editor coords
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

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ height: wrapSize.h }}>
      <div
        className="canvas"
        style={{ width: wrapSize.w, height: wrapSize.h }}
        onPointerDown={() => onSelect(null)}
      >
        {thumbnail && <img src={thumbnail} alt="OBS preview" className="canvas-thumb" />}
        {scene.items.map((it) => {
          const { x, y, width, height } = obsToEditor(it.x, it.y, it.width * it.scaleX, it.height * it.scaleY, obsCanvas, editorCanvas);
          const selected = selectedId === it.sceneItemId;
          return (
            <div
              key={it.sceneItemId}
              className={`canvas-item ${selected ? 'selected' : ''} ${it.visible ? '' : 'hidden'}`}
              style={{
                left: x,
                top: y,
                width: Math.max(24, width),
                height: Math.max(18, height),
                transform: `rotate(${it.rotation}deg)`,
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePointerDown(e, it);
              }}
            >
              <span className="item-label">{it.sourceName}</span>
            </div>
          );
        })}
        {guides.x !== null && <div className="guide guide-v" style={{ left: guides.x }} />}
        {guides.y !== null && <div className="guide guide-h" style={{ top: guides.y }} />}
      </div>
      <div className="canvas-meta">
        {scene.name} · {scene.canvasWidth}×{scene.canvasHeight} · {scene.items.length} items
      </div>
    </div>
  );
}
