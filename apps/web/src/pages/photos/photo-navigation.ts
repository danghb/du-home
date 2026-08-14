export function movePhotoIndex(currentIndex: number, offset: number, photoCount: number) {
  if (photoCount <= 0) return 0;
  return (currentIndex + offset + photoCount) % photoCount;
}

let lastGalleryPhotoId: string | null = null;
let lastPreviewPhotoIds: string[] = [];
let lastPreviewMainPhotoId: string | null = null;

export function restoreGalleryPhotoIndex(
  photos: Array<{ id: string }>,
  random = Math.random,
) {
  if (!photos.length) return -1;
  const rememberedIndex = photos.findIndex((photo) => photo.id === lastGalleryPhotoId);
  return rememberedIndex >= 0 ? rememberedIndex : pickRandomGalleryPhotoIndex(photos, -1, random);
}

export function rememberGalleryPhoto(photos: Array<{ id: string }>, index: number) {
  lastGalleryPhotoId = photos[index]?.id ?? null;
}

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

export function selectRandomPhotoPreviews<T extends { id: string }>(
  photos: T[],
  currentIndex: number,
  limit = 6,
  random = Math.random,
) {
  const currentId = photos[currentIndex]?.id ?? null;
  if (currentId === lastPreviewMainPhotoId && lastPreviewPhotoIds.length) {
    const photosById = new Map(photos.map((photo) => [photo.id, photo]));
    const remembered = lastPreviewPhotoIds
      .map((id) => photosById.get(id))
      .filter((photo): photo is T => photo !== undefined && photo.id !== currentId)
      .slice(0, limit);
    if (remembered.length === Math.min(limit, Math.max(photos.length - 1, 0))) return remembered;
  }
  const candidates = photos.filter((_, index) => index !== currentIndex);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
  }
  const selected = candidates.slice(0, Math.min(limit, candidates.length));
  lastPreviewMainPhotoId = currentId;
  lastPreviewPhotoIds = selected.map((photo) => photo.id);
  return selected;
}

export function resetGalleryPhotoSelection() {
  lastGalleryPhotoId = null;
  lastPreviewPhotoIds = [];
  lastPreviewMainPhotoId = null;
}
