/**
 * Coordinate conversion: OBS (1920x1080) ↔ Editor (phone canvas)
 * Keeps conversion explicit and isolated per detailed-prompt:12
 */

export interface Canvas {
  width: number;
  height: number;
}

export function obsToEditor(
  obsX: number,
  obsY: number,
  obsW: number,
  obsH: number,
  obsCanvas: Canvas,
  editorCanvas: Canvas
) {
  const sx = editorCanvas.width / obsCanvas.width;
  const sy = editorCanvas.height / obsCanvas.height;
  return {
    x: obsX * sx,
    y: obsY * sy,
    width: obsW * sx,
    height: obsH * sy,
  };
}

export function editorToObs(
  edX: number,
  edY: number,
  edW: number,
  edH: number,
  obsCanvas: Canvas,
  editorCanvas: Canvas
) {
  const sx = obsCanvas.width / editorCanvas.width;
  const sy = obsCanvas.height / editorCanvas.height;
  return {
    x: edX * sx,
    y: edY * sy,
    width: edW * sx,
    height: edH * sy,
  };
}

// Single point conversion (for position)
export function obsToEditorPoint(x: number, y: number, obsCanvas: Canvas, editorCanvas: Canvas) {
  return {
    x: (x * editorCanvas.width) / obsCanvas.width,
    y: (y * editorCanvas.height) / obsCanvas.height,
  };
}
export function editorToObsPoint(x: number, y: number, obsCanvas: Canvas, editorCanvas: Canvas) {
  return {
    x: (x * obsCanvas.width) / editorCanvas.width,
    y: (y * obsCanvas.height) / editorCanvas.height,
  };
}
