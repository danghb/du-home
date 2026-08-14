export type DisplayOrientation = 'portrait' | 'landscape' | 'landscape-reverse';

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

export function parseDisplayOrientation(search: string): DisplayOrientation {
  const value = new URLSearchParams(search).get('orientation');
  if (value === 'landscape' || value === 'landscape-reverse') return value;
  return 'portrait';
}

export function calculateViewportScale(width: number, height: number, orientation: DisplayOrientation) {
  const rotated = orientation !== 'portrait';
  const canvasWidth = rotated ? DESIGN_HEIGHT : DESIGN_WIDTH;
  const canvasHeight = rotated ? DESIGN_WIDTH : DESIGN_HEIGHT;
  return Math.min(width / canvasWidth, height / canvasHeight);
}

export function canvasTransform(scale: number, orientation: DisplayOrientation) {
  if (orientation === 'landscape') return `scale(${scale}) rotate(90deg)`;
  if (orientation === 'landscape-reverse') return `scale(${scale}) rotate(-90deg)`;
  return `scale(${scale})`;
}
