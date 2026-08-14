import { useEffect, useState, type PropsWithChildren } from 'react';
import { calculateViewportScale, canvasTransform, parseDisplayOrientation } from './display-orientation';

function viewportScale(orientation: ReturnType<typeof parseDisplayOrientation>) {
  return calculateViewportScale(window.innerWidth, window.innerHeight, orientation);
}

export function DisplayViewport({ children }: PropsWithChildren) {
  const orientation = parseDisplayOrientation(window.location.search);
  const [scale, setScale] = useState(() => viewportScale(orientation));
  useEffect(() => {
    const resize = () => setScale(viewportScale(orientation));
    resize();
    console.info('display viewport', { width: innerWidth, height: innerHeight, devicePixelRatio, orientation });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [orientation]);

  return (
    <main className="viewport" data-orientation={orientation}>
      <div className="design-canvas" style={{ transform: canvasTransform(scale, orientation) }}>{children}</div>
    </main>
  );
}
