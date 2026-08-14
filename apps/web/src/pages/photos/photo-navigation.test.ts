import { describe, expect, it } from 'vitest';
import { movePhotoIndex, selectPhotoPreviews } from './photo-navigation';

describe('photo navigation', () => {
  it('wraps in both directions', () => {
    expect(movePhotoIndex(5, 1, 6)).toBe(0);
    expect(movePhotoIndex(0, -1, 6)).toBe(5);
  });

  it('shows the next six photos and wraps around the library', () => {
    expect(selectPhotoPreviews(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 5)).toEqual([
      'g', 'h', 'a', 'b', 'c', 'd',
    ]);
  });

  it('never repeats the current photo in a small library', () => {
    expect(selectPhotoPreviews(['a', 'b'], 0)).toEqual(['b']);
  });
});
