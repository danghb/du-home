import { useEffect, useState, type PropsWithChildren } from 'react';

const DESIGN_WIDTH = 1080;
const DESIGN_HEIGHT = 1920;

function viewportScale() {
  return Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
}

export function DisplayViewport({ children }: PropsWithChildren) {
  const [scale, setScale] = useState(viewportScale);
  useEffect(() => {
    const resize = () => setScale(viewportScale());
    console.info('display viewport', { width: innerWidth, height: innerHeight, devicePixelRatio });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <main className="viewport">
      <div className="design-canvas" style={{ transform: `scale(${scale})` }}>{children}</div>
    </main>
  );
}
