import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { NavigateFunction } from 'react-router-dom';
import type { DisplayPageDefinition } from '../app/pages';

interface PageRotationOptions {
  enabled: boolean;
  durationsSeconds: Record<string, number>;
}

type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

function navigateTo(navigate: NavigateFunction, pathname: string, search: string) {
  const transitionDocument = document as TransitionDocument;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduceMotion && transitionDocument.startViewTransition) {
    transitionDocument.startViewTransition(() => {
      flushSync(() => navigate({ pathname, search }));
    });
    return;
  }
  navigate({ pathname, search });
}

export function usePageNavigation(
  pages: DisplayPageDefinition[],
  pathname: string,
  search: string,
  navigate: NavigateFunction,
  rotation: PageRotationOptions,
) {
  const pointerStart = useRef<number | null>(null);

  useEffect(() => {
    const enabled = pages.filter((page) => page.enabled).sort((a, b) => a.order - b.order);
    const currentIndex = enabled.findIndex((page) => page.path === pathname);
    if (currentIndex < 0) return;
    const go = (offset: number) => {
      const target = enabled[(currentIndex + offset + enabled.length) % enabled.length];
      if (target) navigateTo(navigate, target.path, search);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    const onPointerDown = (event: PointerEvent) => { pointerStart.current = event.clientX; };
    const onPointerUp = (event: PointerEvent) => {
      if (pointerStart.current === null) return;
      const delta = event.clientX - pointerStart.current;
      pointerStart.current = null;
      if (Math.abs(delta) < 80) return;
      go(delta < 0 ? 1 : -1);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [navigate, pages, pathname, search]);

  useEffect(() => {
    if (!rotation.enabled) return;
    const enabled = pages.filter((page) => page.enabled).sort((a, b) => a.order - b.order);
    const currentIndex = enabled.findIndex((page) => page.path === pathname);
    const current = enabled[currentIndex];
    const durationSeconds = current ? rotation.durationsSeconds[current.id] : undefined;
    if (currentIndex < 0 || !durationSeconds) return;
    const timer = window.setTimeout(() => {
      const target = enabled[(currentIndex + 1) % enabled.length];
      if (target) navigateTo(navigate, target.path, search);
    }, durationSeconds * 1_000);
    return () => window.clearTimeout(timer);
  }, [navigate, pages, pathname, rotation, search]);
}
