'use client';

import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import { CommuteSceneStatic } from '@/components/commute-scene-static';
import type { CommuteSceneHandle } from '@/lib/commute-scene';

type SceneMode = 'static' | 'three';

/**
 * CoRide hero background scene.
 *
 * Renders behind all interactive content (`pointer-events-none`, absolutely
 * positioned) and never intercepts clicks. Behaviour:
 *
 *   - SSR / first paint: the static illustrated SVG frame.
 *   - If the user prefers reduced motion: keep the static frame (requirement).
 *   - Otherwise: lazily load the Three.js low-poly commute scene and fade the
 *     SVG out behind the transparent WebGL canvas. Any load error falls back
 *     to the static frame.
 */
export function CommuteScene({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CommuteSceneHandle | null>(null);
  const [mode, setMode] = useState<SceneMode>('static');

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;

      if (prefersReducedMotion || !containerRef.current) return;

      try {
        // Lazy chunk: `three` is only fetched in a motion-preferring browser.
        const { createCommuteScene } = await import('@/lib/commute-scene');
        if (cancelled || !containerRef.current) return;

        const handle = createCommuteScene(containerRef.current);
        if (!handle) return;
        handleRef.current = handle;
        setMode('three');
      } catch {
        // Keep the static frame — never let the scene break the hero.
      }
    }

    void boot();

    return () => {
      cancelled = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, []);

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-0 overflow-hidden',
        className
      )}
      aria-hidden="true"
    >
      <CommuteSceneStatic
        className={cn(
          'h-full w-full transition-opacity duration-700',
          mode === 'three' && 'opacity-0'
        )}
      />
      <div
        ref={containerRef}
        className={cn('absolute inset-0', mode !== 'three' && 'hidden')}
      />
    </div>
  );
}
