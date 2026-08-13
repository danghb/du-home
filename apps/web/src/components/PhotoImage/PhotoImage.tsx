import { useEffect, useState } from 'react';
import type { Photo } from '@family-display/contracts';
import { PhotoArtwork } from '../PhotoArtwork/PhotoArtwork';

interface PhotoImageProps {
  photo: Photo | null;
  className?: string | undefined;
  variant?: number;
  alt?: string | undefined;
}

export function PhotoImage({ photo, className = '', variant = 0, alt }: PhotoImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo?.thumbnailUrl]);

  if (!photo || failed) return <PhotoArtwork className={className} variant={variant} />;
  return <img className={className} src={photo.thumbnailUrl} alt={alt ?? photo.title} onError={() => setFailed(true)} />;
}
