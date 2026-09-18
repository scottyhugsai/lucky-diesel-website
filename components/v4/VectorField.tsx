'use client';

import { useEffect, useRef, useState } from 'react';

const MAX_DPR = 1.5;

/**
 * The hero's airflow field. WebGL via ogl, which is imported only after the
 * page has painted, and only when it can actually run:
 *
 *  - `prefers-reduced-motion` renders one still frame and stops
 *  - no WebGL, or a context that fails to create, renders nothing at all and
 *    the CSS gradient underneath stands in
 *  - off-screen or a hidden tab pauses the loop rather than burning a GPU
 *
 * It is decorative, so it is aria-hidden and never carries meaning.
 */
export function VectorField({ className = '' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let frame = 0;
    let stop: (() => void) | undefined;

    const start = async () => {
      try {
        const [{ Renderer, Program, Mesh, Triangle, Vec2, Vec3 }, shaders] = await Promise.all([
          import('ogl'),
          import('./vector-field-shader'),
        ]);
        if (disposed) return;

        const renderer = new Renderer({ canvas, alpha: true, antialias: false, dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR) });
        const gl = renderer.gl;
        gl.clearColor(0, 0, 0, 0);

        const styles = getComputedStyle(canvas);
        const rgb = (value: string, fallback: [number, number, number]): [number, number, number] => {
          const parts = value.match(/[\d.]+/g);
          return parts && parts.length >= 3
            ? [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255]
            : fallback;
        };
        const ink = rgb(styles.getPropertyValue('--vf-ink'), [0.04, 0.06, 0.05]);
        const signal = rgb(styles.getPropertyValue('--vf-signal'), [0.04, 0.49, 0.16]);

        const program = new Program(gl, {
          vertex: shaders.VECTOR_FIELD_VERTEX,
          fragment: shaders.VECTOR_FIELD_FRAGMENT,
          transparent: true,
          uniforms: {
            uTime: { value: 0 },
            uResolution: { value: new Vec2(1, 1) },
            uInk: { value: new Vec3(...ink) },
            uSignal: { value: new Vec3(...signal) },
          },
        });
        const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

        // Measure the parent: ogl writes inline width/height onto the canvas,
        // which would otherwise fight the stylesheet and pin it at 300x150.
        const box = canvas.parentElement ?? canvas;
        const resize = () => {
          const width = box.clientWidth;
          const height = box.clientHeight;
          if (!width || !height) return;
          renderer.setSize(width, height);
          program.uniforms.uResolution.value.set(width, height);
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(box);

        const draw = (time: number) => {
          program.uniforms.uTime.value = time / 1000;
          renderer.render({ scene: mesh });
        };

        const motionOk = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!motionOk) {
          draw(0);
          stop = () => observer.disconnect();
          return;
        }

        let running = false;
        const loop = (time: number) => {
          if (disposed) return;
          draw(time);
          frame = requestAnimationFrame(loop);
        };
        const play = () => {
          if (running || disposed) return;
          running = true;
          frame = requestAnimationFrame(loop);
        };
        const pause = () => {
          running = false;
          cancelAnimationFrame(frame);
        };

        // Only run while the hero is actually on screen and the tab is visible.
        const visibility = new IntersectionObserver(([entry]) => (entry?.isIntersecting ? play() : pause()), { threshold: 0 });
        visibility.observe(canvas);
        const onVisibility = () => (document.hidden ? pause() : play());
        document.addEventListener('visibilitychange', onVisibility);

        stop = () => {
          pause();
          visibility.disconnect();
          observer.disconnect();
          document.removeEventListener('visibilitychange', onVisibility);
          gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
      } catch {
        if (!disposed) setFailed(true);
      }
    };

    // After paint: the hero's text is the thing that has to arrive first.
    const idle = window.requestIdleCallback?.(() => void start(), { timeout: 1200 }) ?? window.setTimeout(() => void start(), 200);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      if (typeof idle === 'number') window.clearTimeout(idle);
      window.cancelIdleCallback?.(idle as number);
      stop?.();
    };
  }, []);

  if (failed) return null;
  return <canvas ref={canvasRef} aria-hidden="true" className={`v4-canvas absolute inset-0 block size-full ${className}`} />;
}
