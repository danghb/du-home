import { describe, expect, it } from 'vitest';
import {
  movePhotoIndex,
  pickRandomGalleryPhotoIndex,
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
    expect(pickRandomGalleryPhotoIndex(photos, -1, () => 0)).toBe(0);
    expect(restoreGalleryPhotoIndex(photos, () => 0.9)).toBe(0);
    rememberGalleryPhoto(photos, 2);
    expect(restoreGalleryPhotoIndex(photos, () => 0)).toBe(2);
  });

  it('selects six unique random previews without the current photo', () => {
    resetGalleryPhotoSelection();
    const photos = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => ({ id }));
    const previews = selectRandomPhotoPreviews(photos, 3, 6, () => 0);
    expect(previews).toHaveLength(6);
    expect(new Set(previews.map((photo) => photo.id)).size).toBe(6);
    expect(previews.map((photo) => photo.id)).not.toContain('d');
    expect(selectRandomPhotoPreviews(photos, 3, 6, () => 0.9).map((photo) => photo.id))
      .toEqual(previews.map((photo) => photo.id));
  });
});
