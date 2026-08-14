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
  const [displayedPhoto, setDisplayedPhoto] = useState(photo);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!photo) {
      setDisplayedPhoto(null);
      setFailed(false);
      return;
    }
    if (photo.id === displayedPhoto?.id) return;
    let active = true;
    const preload = new Image();
    preload.onload = () => {
      if (!active) return;
      setFailed(false);
      setDisplayedPhoto(photo);
    };
    preload.onerror = () => {
      if (active && !displayedPhoto) setFailed(true);
    };
    preload.src = photo.thumbnailUrl;
    return () => { active = false; };
  }, [displayedPhoto, photo]);

  if (!displayedPhoto || failed) return <PhotoArtwork className={className} variant={variant} />;
  return <img className={className} src={displayedPhoto.thumbnailUrl} alt={alt ?? displayedPhoto.title} onError={() => setFailed(true)} />;
}
