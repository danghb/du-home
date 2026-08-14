let lastHomePhotoId: string | null = null;

export function restoreHomePhotoIndex(
  photos: Array<{ id: string }>,
  random = Math.random,
) {
  if (!photos.length) return -1;
  const rememberedIndex = photos.findIndex((photo) => photo.id === lastHomePhotoId);
  return rememberedIndex >= 0 ? rememberedIndex : pickRandomPhotoIndex(photos, -1, random);
}

export function pickRandomPhotoIndex(
  photos: Array<{ id: string }>,
  currentIndex = -1,
  random = Math.random,
) {
  if (!photos.length) return -1;

  const currentId = photos[currentIndex]?.id ?? lastHomePhotoId;
  const candidates = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => photos.length === 1 || photo.id !== currentId);
  const selected = candidates[Math.floor(random() * candidates.length)]
    ?? { photo: photos[0]!, index: 0 };

  lastHomePhotoId = selected.photo.id;
  return selected.index;
}

export function resetHomePhotoSelection() {
  lastHomePhotoId = null;
}
