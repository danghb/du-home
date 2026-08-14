import { useEffect, useState } from 'react';
import type { Photo } from '@family-display/contracts';
import { PhotoArtwork } from '../PhotoArtwork/PhotoArtwork';

interface PhotoImageProps {
  photo: Photo | null;
  className?: string | undefined;
  variant?: number;
  alt?: string | undefined;
  source?: 'thumbnail' | 'original';
}

export function PhotoImage({ photo, className = '', variant = 0, alt, source = 'thumbnail' }: PhotoImageProps) {
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
    preload.src = source === 'original' ? photo.mediaUrl : photo.thumbnailUrl;
    return () => { active = false; };
  }, [displayedPhoto, photo, source]);

  if (!displayedPhoto || failed) return <PhotoArtwork className={className} variant={variant} />;
  const imageUrl = source === 'original' ? displayedPhoto.mediaUrl : displayedPhoto.thumbnailUrl;
  return <img className={className} src={imageUrl} alt={alt ?? displayedPhoto.title} onError={() => setFailed(true)} />;
}
