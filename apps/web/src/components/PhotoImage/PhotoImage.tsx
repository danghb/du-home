import { useEffect, useState } from 'react';
import type { Photo } from '@family-display/contracts';
import { PhotoArtwork } from '../PhotoArtwork/PhotoArtwork';

interface PhotoImageProps {
  photo: Photo | null;
  className?: string | undefined;
  variant?: number;
  alt?: string | undefined;
  source?: 'thumbnail' | 'display';
}

export function PhotoImage({ photo, className = '', variant = 0, alt, source = 'thumbnail' }: PhotoImageProps) {
  const [displayedPhoto, setDisplayedPhoto] = useState(photo);
  const [failed, setFailed] = useState(false);
  const [motionActive, setMotionActive] = useState(Boolean(photo?.motionUrl && source === 'display'));
  useEffect(() => {
    if (!photo) {
      setDisplayedPhoto(null);
      setFailed(false);
      setMotionActive(false);
      return;
    }
    if (photo.id === displayedPhoto?.id) return;
    let active = true;
    const preload = new Image();
    preload.onload = () => {
      if (!active) return;
      setFailed(false);
      setDisplayedPhoto(photo);
      setMotionActive(Boolean(photo.motionUrl && source === 'display'));
    };
    preload.onerror = () => {
      if (active && !displayedPhoto) setFailed(true);
    };
    preload.src = source === 'display' ? photo.mediaUrl : photo.thumbnailUrl;
    return () => { active = false; };
  }, [displayedPhoto, photo, source]);

  if (!displayedPhoto || failed) return <PhotoArtwork className={className} variant={variant} />;
  const imageUrl = source === 'display' ? displayedPhoto.mediaUrl : displayedPhoto.thumbnailUrl;
  if (source === 'display' && displayedPhoto.motionUrl && motionActive) {
    return <video
      key={displayedPhoto.id}
      className={className}
      src={displayedPhoto.motionUrl}
      poster={imageUrl}
      aria-label={alt ?? displayedPhoto.title}
      autoPlay
      muted
      playsInline
      preload="auto"
      onEnded={() => setMotionActive(false)}
      onError={() => setMotionActive(false)}
    />;
  }
  return <img className={className} src={imageUrl} alt={alt ?? displayedPhoto.title} onError={() => setFailed(true)} />;
}
