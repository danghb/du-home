import { describe, expect, it } from 'vitest';
import {
  movePhotoIndex,
  nextPhotoIndexInBatch,
  rememberGalleryPhoto,
  resetGalleryPhotoSelection,
  restoreGalleryPhotoIndex,
  selectRandomPhotoPreviews,
} from './photo-navigation';

describe('photo navigation', () => {
  it('wraps in both directions', () => {
    expect(movePhotoIndex(5, 1, 6)).toBe(0);
    expect(movePhotoIndex(0, -1, 6)).toBe(5);
  });

  it('restores the current photo when revisiting the gallery', () => {
    resetGalleryPhotoSelection();
    const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(restoreGalleryPhotoIndex(photos)).toBe(0);
    expect(restoreGalleryPhotoIndex(photos)).toBe(0);
    rememberGalleryPhoto(photos, 2);
    expect(restoreGalleryPhotoIndex(photos)).toBe(2);
  });

  it('advances sequentially and ends after the whole batch', () => {
    expect(nextPhotoIndexInBatch(0, 3)).toBe(1);
    expect(nextPhotoIndexInBatch(1, 3)).toBe(2);
    expect(nextPhotoIndexInBatch(2, 3)).toBeNull();
  });

  it('selects six unique random previews without the current photo', () => {
    resetGalleryPhotoSelection();
    const photos = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => ({ id }));
    const previews = selectRandomPhotoPreviews(photos, 3, 6, () => 0);
    expect(previews).toHaveLength(6);
    expect(new Set(previews.map((photo) => photo.id)).size).toBe(6);
    expect(previews.map((photo) => photo.id)).not.toContain('d');
    expect(selectRandomPhotoPreviews(photos, 4, 6, () => 0.9).map((photo) => photo.id))
      .toEqual(previews.map((photo) => photo.id));
  });
});
