export function movePhotoIndex(currentIndex: number, offset: number, photoCount: number) {
  if (photoCount <= 0) return 0;
  return (currentIndex + offset + photoCount) % photoCount;
}

let lastGalleryPhotoId: string | null = null;
let lastPreviewPhotoIds: string[] = [];
let lastPreviewBatchKey: string | null = null;

export function restoreGalleryPhotoIndex(
  photos: Array<{ id: string }>,
) {
  if (!photos.length) return -1;
  const rememberedIndex = photos.findIndex((photo) => photo.id === lastGalleryPhotoId);
  if (rememberedIndex >= 0) return rememberedIndex;
  lastGalleryPhotoId = photos[0]!.id;
  return 0;
}

export function rememberGalleryPhoto(photos: Array<{ id: string }>, index: number) {
  lastGalleryPhotoId = photos[index]?.id ?? null;
}

export function nextPhotoIndexInBatch(currentIndex: number, photoCount: number) {
  if (photoCount <= 0 || currentIndex >= photoCount - 1) return null;
  return Math.max(0, currentIndex + 1);
}

export function selectRandomPhotoPreviews<T extends { id: string }>(
  photos: T[],
  currentIndex: number,
  limit = 6,
  random = Math.random,
) {
  const batchKey = photos.map((photo) => photo.id).join('|');
  if (batchKey === lastPreviewBatchKey && lastPreviewPhotoIds.length) {
    const photosById = new Map(photos.map((photo) => [photo.id, photo]));
    const remembered = lastPreviewPhotoIds
      .map((id) => photosById.get(id))
      .filter((photo): photo is T => photo !== undefined)
      .slice(0, limit);
    if (remembered.length === Math.min(limit, Math.max(photos.length - 1, 0))) return remembered;
  }
  const candidates = photos.filter((_, index) => index !== currentIndex);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [candidates[index], candidates[target]] = [candidates[target]!, candidates[index]!];
  }
  const selected = candidates.slice(0, Math.min(limit, candidates.length));
  lastPreviewBatchKey = batchKey;
  lastPreviewPhotoIds = selected.map((photo) => photo.id);
  return selected;
}

export function resetGalleryPhotoSelection() {
  lastGalleryPhotoId = null;
  lastPreviewPhotoIds = [];
  lastPreviewBatchKey = null;
}
