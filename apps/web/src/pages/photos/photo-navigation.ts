export function movePhotoIndex(currentIndex: number, offset: number, photoCount: number) {
  if (photoCount <= 0) return 0;
  return (currentIndex + offset + photoCount) % photoCount;
}

let lastGalleryPhotoId: string | null = null;

export function pickRandomGalleryPhotoIndex(
  photos: Array<{ id: string }>,
  currentIndex = -1,
  random = Math.random,
) {
  if (!photos.length) return -1;
  const currentId = photos[currentIndex]?.id ?? lastGalleryPhotoId;
  const candidates = photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => photos.length === 1 || photo.id !== currentId);
  const selected = candidates[Math.floor(random() * candidates.length)]
    ?? { photo: photos[0]!, index: 0 };
  lastGalleryPhotoId = selected.photo.id;
  return selected.index;
}

export function selectRandomPhotoPreviews<T>(
  photos: T[],
  currentIndex: number,
  limit = 6,
  random = Math.random,
) {
  const candidates = photos.filter((_, index) => index !== currentIndex);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
  }
  return candidates.slice(0, Math.min(limit, candidates.length));
}

export function resetGalleryPhotoSelection() {
  lastGalleryPhotoId = null;
}
