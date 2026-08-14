import { describe, expect, it } from 'vitest';
import { calculateViewportScale, canvasTransform, parseDisplayOrientation } from './display-orientation';

describe('display orientation', () => {
  it('uses portrait unless a supported URL orientation is requested', () => {
    expect(parseDisplayOrientation('')).toBe('portrait');
    expect(parseDisplayOrientation('?orientation=landscape')).toBe('landscape');
    expect(parseDisplayOrientation('?orientation=landscape-reverse')).toBe('landscape-reverse');
    expect(parseDisplayOrientation('?orientation=invalid')).toBe('portrait');
  });

  it('fits the rotated design canvas to a landscape viewport', () => {
    expect(calculateViewportScale(1920, 1080, 'landscape')).toBe(1);
    expect(calculateViewportScale(1080, 1920, 'portrait')).toBe(1);
    expect(canvasTransform(1, 'landscape')).toBe('scale(1) rotate(90deg)');
    expect(canvasTransform(1, 'landscape-reverse')).toBe('scale(1) rotate(-90deg)');
  });
});
