import { beforeEach, describe, expect, it } from 'vitest';
import { pickRandomPhotoIndex, resetHomePhotoSelection, restoreHomePhotoIndex } from './home-photo-selection';

const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('pickRandomPhotoIndex', () => {
  beforeEach(resetHomePhotoSelection);

  it('restores the photo shown during the previous home visit', () => {
    const first = pickRandomPhotoIndex(photos, -1, () => 0);
    const second = restoreHomePhotoIndex(photos, () => 0.9);

    expect(photos[first]?.id).toBe('a');
    expect(photos[second]?.id).toBe('a');
  });

  it('avoids the currently displayed photo during rotation', () => {
    expect(pickRandomPhotoIndex(photos, 1, () => 0)).toBe(0);
  });

  it('keeps working when the library contains only one photo', () => {
    expect(pickRandomPhotoIndex([{ id: 'only' }], -1, () => 0)).toBe(0);
  });
});
