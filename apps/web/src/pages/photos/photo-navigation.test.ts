import { describe, expect, it } from 'vitest';
import {
  movePhotoIndex,
  pickRandomGalleryPhotoIndex,
  resetGalleryPhotoSelection,
  selectRandomPhotoPreviews,
} from './photo-navigation';

describe('photo navigation', () => {
  it('wraps in both directions', () => {
    expect(movePhotoIndex(5, 1, 6)).toBe(0);
    expect(movePhotoIndex(0, -1, 6)).toBe(5);
  });

  it('chooses a different random photo when revisiting the gallery', () => {
    resetGalleryPhotoSelection();
    const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(pickRandomGalleryPhotoIndex(photos, -1, () => 0)).toBe(0);
    expect(pickRandomGalleryPhotoIndex(photos, -1, () => 0)).toBe(1);
  });

  it('selects six unique random previews without the current photo', () => {
    const previews = selectRandomPhotoPreviews(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 3, 6, () => 0);
    expect(previews).toHaveLength(6);
    expect(new Set(previews).size).toBe(6);
    expect(previews).not.toContain('d');
  });
});
