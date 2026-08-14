export function movePhotoIndex(currentIndex: number, offset: number, photoCount: number) {
  if (photoCount <= 0) return 0;
  return (currentIndex + offset + photoCount) % photoCount;
}

export function selectPhotoPreviews<T>(photos: T[], currentIndex: number, limit = 6) {
  if (photos.length < 2 || limit <= 0) return [];
  const previewCount = Math.min(limit, photos.length - 1);
  return Array.from(
    { length: previewCount },
    (_, offset) => photos[(currentIndex + offset + 1) % photos.length]!,
  );
}
