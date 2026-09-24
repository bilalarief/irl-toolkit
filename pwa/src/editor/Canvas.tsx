import { useEffect, useRef, useState } from 'react';
import type { EditorScene, EditorItem } from '../protocol/types';
import { obsToEditor } from '../coordinate/convert';

export function Canvas({
  scene,
  selectedId,
  onSelect,
  onMove,
}: {
  scene: EditorScene | null;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onMove: (id: number, x: number, y: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 360, h: 202 });

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

    const onPointerMove = (ev: PointerEvent) => {
      const dxObs = ((ev.clientX - startX) * obsCanvas.width) / editorCanvas.width;
      const dyObs = ((ev.clientY - startY) * obsCanvas.height) / editorCanvas.height;
      onMove(item.sceneItemId, origX + dxObs, origY + dyObs);
    };
    const onUp = () => {
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
      </div>
      <div className="canvas-meta">
        {scene.name} · {scene.canvasWidth}×{scene.canvasHeight} · {scene.items.length} items
      </div>
    </div>
  );
}
