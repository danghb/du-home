import { useEffect, useState } from 'react';

export function useCurrentTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval: number | null = null;
    const update = () => setNow(new Date());
    const delay = 60_000 - (Date.now() % 60_000) + 50;
    const timeout = window.setTimeout(() => {
      update();
      interval = window.setInterval(update, 60_000);
    }, delay);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearTimeout(timeout);
      if (interval !== null) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return now;
}
